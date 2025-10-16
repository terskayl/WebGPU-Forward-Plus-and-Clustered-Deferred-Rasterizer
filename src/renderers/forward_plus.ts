import { vec2, Vec2, Vec2Arg } from 'wgpu-matrix';
import * as renderer from '../renderer';
import * as shaders from '../shaders/shaders';
import { Stage } from '../stage/stage';

export class ForwardPlusRenderer extends renderer.Renderer {
    // TODO-2: add layouts, pipelines, textures, etc. needed for Forward+ here
    // you may need extra uniforms such as the camera view matrix and the canvas resolution
    computeOutputBuffer: GPUBuffer;
    computeOutputBindGroupLayout: GPUBindGroupLayout;
    computeOutputBindGroup: GPUBindGroup;

    computePipeline: GPUComputePipeline;
    computePipelineLayout: GPUPipelineLayout;

    additionalUniformsBuffer: GPUBuffer;

    sceneUniformsBindGroupLayout: GPUBindGroupLayout;
    sceneUniformsBindGroup: GPUBindGroup;

    depthTexture: GPUTexture;
    depthTextureView: GPUTextureView;

    renderPipeline: GPURenderPipeline;
    renderPipelineLayout: GPUPipelineLayout;

    // How many tiles cover the screen in each direction?
    tileGridDimX: number = 33;
    tileGridDimY: number = 32;


    constructor(stage: Stage) {
        super(stage);
        
        this.camera.uniforms.pixelDims = new Int32Array([renderer.canvas.width, renderer.canvas.height]);

        const additionalUniformsBufferHost = new Int32Array(4);
        this.additionalUniformsBuffer = renderer.device.createBuffer({
            label: "vertex additional uniforms buffer",
            size: 2 * 4 + 8, // 2 * sizeof(int) + 8 to pad to 16 bytes
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })
        additionalUniformsBufferHost[0] = renderer.canvas.width;
        additionalUniformsBufferHost[1] = renderer.canvas.height;
        additionalUniformsBufferHost[2] = this.tileGridDimX;
        additionalUniformsBufferHost[3] = this.tileGridDimY;
        renderer.device.queue.writeBuffer(this.additionalUniformsBuffer, 0, additionalUniformsBufferHost);

        // TODO-2: initialize layouts, pipelines, textures, etc. needed for Forward+ here
        const computeOutputBufferHost = new Int32Array(this.tileGridDimX * this.tileGridDimY)
        this.computeOutputBuffer = renderer.device.createBuffer({
            label: "compute output buffer",
            size: computeOutputBufferHost.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        // Init to all zeros
        renderer.device.queue.writeBuffer(this.computeOutputBuffer, 0, computeOutputBufferHost);

        this.computeOutputBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "compute output bind group layout",
            entries: [
                { // compute output
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" }
                }, 
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "uniform" }
                }
            ]
        })
        this.computeOutputBindGroup = renderer.device.createBindGroup({
            label: "compute output bind group",
            layout: this.computeOutputBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.computeOutputBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.additionalUniformsBuffer }
                }
            ]
        })

        this.computePipelineLayout = renderer.device.createPipelineLayout({
            label: "forward+ compute pipeline layout",
            bindGroupLayouts: [
                // TODO (aajiang): Place data here.
                this.computeOutputBindGroupLayout
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
        });

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
                },
                { // compute output
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "storage" } // TODO, can I read only this?
                },
                { // additional uniforms
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {type: "uniform" }
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
                },
                {
                    binding: 2,
                    resource: { buffer: this.computeOutputBuffer }
                },
                {
                    binding: 3,
                    resource: { buffer: this.additionalUniformsBuffer }
                }
            ]
        });


        this.depthTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.depthTextureView = this.depthTexture.createView();



        this.renderPipelineLayout = renderer.device.createPipelineLayout({
            label: "forward++ render pipeline layout",
            bindGroupLayouts: [
                this.sceneUniformsBindGroupLayout,
                renderer.modelBindGroupLayout,
                renderer.materialBindGroupLayout
            ]
        });

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
        computePass.setBindGroup(0, this.computeOutputBindGroup);
        computePass.dispatchWorkgroups(this.tileGridDimX * this.tileGridDimY, 1, 1);
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
