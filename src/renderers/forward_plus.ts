import * as renderer from '../renderer';
import * as shaders from '../shaders/shaders';
import { Stage } from '../stage/stage';

export class ForwardPlusRenderer extends renderer.Renderer {
    // TODO-2: add layouts, pipelines, textures, etc. needed for Forward+ here
    // you may need extra uniforms such as the camera view matrix and the canvas resolution
    sceneUniformsBindGroupLayout: GPUBindGroupLayout;
    sceneUniformsBindGroup: GPUBindGroup;

    depthTexture: GPUTexture;
    depthTextureView: GPUTextureView;

    renderPipeline: GPURenderPipeline;
    renderPipelineLayout: GPUPipelineLayout;
    computePipeline: GPUComputePipeline;
    computePipelineLayout: GPUPipelineLayout;
    constructor(stage: Stage) {
        super(stage);

        // TODO-2: initialize layouts, pipelines, textures, etc. needed for Forward+ here
        this.sceneUniformsBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "forward+ scene uniforms bind group layout",
            entries: [
                { // camera
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "uniform" }
                },
                { // lightSet
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "read-only-storage" }
                }
            ]
        });

        this.sceneUniformsBindGroup = renderer.device.createBindGroup({
            label: "forward+ scene uniforms bind group",
            layout: this.sceneUniformsBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.camera.uniformsBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.lights.lightSetStorageBuffer }
                }
            ]
        });


        this.depthTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.depthTextureView = this.depthTexture.createView();


        this.computePipelineLayout = renderer.device.createPipelineLayout({
            label: "forward+ compute pipeline layout",
            bindGroupLayouts: [
                // TODO (aajiang): Place data here.
            ]
        });

        this.computePipeline = renderer.device.createComputePipeline({
            label: "forward+ compute pipeline",
            layout: this.computePipelineLayout,
            compute: {
                module: renderer.device.createShaderModule({
                    label: "forward+ cluster compute shader",
                    code: shaders.clusteringComputeSrc
                })
            }
        })

        this.renderPipelineLayout = renderer.device.createPipelineLayout({
            label: "forward++ render pipeline layout",
            bindGroupLayouts: [
                this.sceneUniformsBindGroupLayout,
                renderer.modelBindGroupLayout,
                renderer.materialBindGroupLayout
            ]
        })

        this.renderPipeline = renderer.device.createRenderPipeline({
            layout: this.renderPipelineLayout,
            depthStencil: {
                depthWriteEnabled:true,
                depthCompare: "less",
                format: "depth24plus"
            },
            vertex: {
                module: renderer.device.createShaderModule({
                    label: "forward+ vert shader",
                    code: shaders.naiveVertSrc
                }),
                buffers: [ renderer.vertexBufferLayout ]
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    label: "forward vert shader",
                    code: shaders.forwardPlusFragSrc
                }),
                targets: [
                    {
                        format: renderer.canvasFormat
                    }
                ]
            }
        });

    }

    override draw() {
        // TODO-2: run the Forward+ rendering pass:
        // - run the clustering compute shader
        // - run the main rendering pass, using the computed clusters for efficient lighting

        const computeEncoder = renderer.device.createCommandEncoder();
        const computePass = computeEncoder.beginComputePass({label: "forward+ compute pass"});

        computePass.setPipeline(this.computePipeline);
        //computePass.setBindGroup(0, this.sceneUniformsBindGroup);
        computePass.dispatchWorkgroups(1, 1, 1);
        computePass.end();

        renderer.device.queue.submit([computeEncoder.finish()]);
        
        
        const renderEncoder = renderer.device.createCommandEncoder();
        const canvasTextureView = renderer.context.getCurrentTexture().createView();

        const renderPass = renderEncoder.beginRenderPass({
            label: "forward+ render pass",
            colorAttachments: [
                {
                    view: canvasTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                }
            ],
            depthStencilAttachment: {
                view: this.depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp:"clear",
                depthStoreOp: "store"
            }
        });
        renderPass.setPipeline(this.renderPipeline);

        renderPass.setBindGroup(shaders.constants.bindGroup_scene, this.sceneUniformsBindGroup)
        this.scene.iterate(node => {
            renderPass.setBindGroup(shaders.constants.bindGroup_model, node.modelBindGroup);
        }, material => {
            renderPass.setBindGroup(shaders.constants.bindGroup_material, material.materialBindGroup);
        }, primitive => {
            renderPass.setVertexBuffer(0, primitive.vertexBuffer);
            renderPass.setIndexBuffer(primitive.indexBuffer, 'uint32');
            renderPass.drawIndexed(primitive.numIndices);
        });

        renderPass.end();

        renderer.device.queue.submit([renderEncoder.finish()]);


    }
}
