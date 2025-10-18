import * as renderer from '../renderer';
import * as shaders from '../shaders/shaders';
import { Stage } from '../stage/stage';

export class ClusteredDeferredRenderer extends renderer.Renderer {
    // TODO-3: add layouts, pipelines, textures, etc. needed for Forward+ here
    // you may need extra uniforms such as the camera view matrix and the canvas resolution
    gBufferBindGroupLayout: GPUBindGroupLayout;
    gBufferBindGroup: GPUBindGroup;
    
    sceneUniformsBindGroupLayout: GPUBindGroupLayout;
    sceneUniformsBindGroup: GPUBindGroup;

    depthTexture: GPUTexture;
    depthTextureView: GPUTextureView;

    gBufferPassPipelineLayout: GPUPipelineLayout;
    gBufferPassPipeline: GPURenderPipeline;

    gBufferAlbedoDepth: GPUTexture;
    gBufferNormal: GPUTexture;
    gBufferPos: GPUTexture;

    lightPassPipelineLayout:GPUPipelineLayout;
    lightPassPipeline: GPURenderPipeline;

    constructor(stage: Stage) {
        super(stage);

        // TODO-3: initialize layouts, pipelines, textures, etc. needed for Forward+ here
        // you'll need two pipelines: one for the G-buffer pass and one for the fullscreen pass

        this.gBufferBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "gbuffer uniform bind group layout",
            entries: [
                { // camera
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" }
                }
            ]
        })

        this.gBufferBindGroup = renderer.device.createBindGroup({
            label: "gbuffer bind group",
            layout: this.gBufferBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.camera.uniformsBuffer }
                }
            ]
        })

        this.sceneUniformsBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "deferred scene uniforms bind group layout",
            entries: [
                { // camera
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
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
                },
                { // Albedo Depth Tex
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                      sampleType: 'float',   
                      viewDimension: '2d',  
                      multisampled: false
                    }
                },
                { // Normal Tex
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                      sampleType: 'float',   
                      viewDimension: '2d',  
                      multisampled: false
                    }
                },
                { // Pos Tex
                    binding: 6,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                      sampleType: 'float',   
                      viewDimension: '2d',  
                      multisampled: false
                    }
                },
                { // Default Sampler
                    binding: 7,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {
                      type: 'filtering'
                    }
                }
            ]
        });

        this.depthTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.depthTextureView = this.depthTexture.createView();



        this.gBufferPassPipelineLayout = renderer.device.createPipelineLayout({
            label: "gbuffer render pipeline layout",
            bindGroupLayouts: [
                this.gBufferBindGroupLayout,
                renderer.modelBindGroupLayout,
                renderer.materialBindGroupLayout
            ]
        });

        this.gBufferAlbedoDepth = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: 'rgba16float', 
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
            });
            
        this.gBufferNormal = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: 'rgba16float', 
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
            });

        this.gBufferPos = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: 'rgba16float', 
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
            });
    

        this.gBufferPassPipeline = renderer.device.createRenderPipeline({
            layout: this.gBufferPassPipelineLayout,
            depthStencil: {
                depthWriteEnabled:true,
                depthCompare: "less",
                format: "depth24plus"
            },
            vertex: {
                module: renderer.device.createShaderModule({
                    label: "gbuffer vert shader",
                    code: shaders.clusteredDeferredFullscreenVertSrc
                }),
                buffers: [ renderer.vertexBufferLayout ]
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    label: "gbuffer vert shader",
                    code: shaders.clusteredDeferredFullscreenFragSrc
                }),
                targets: [
                    {format: "rgba16float"},
                    {format: "rgba16float"},
                    {format: "rgba16float"}
                ]
            }
        });

        this.lightPassPipelineLayout = renderer.device.createPipelineLayout({
            label: "deferred render pipeline layout",
            bindGroupLayouts: [
                this.sceneUniformsBindGroupLayout,
            ]
        })

        const screenQuadVertexLayout: GPUVertexBufferLayout = {
                arrayStride: 2 * 4,
                attributes: [
                    {
                    shaderLocation: 0, // @location(0)
                    offset: 0,
                    format: 'float32x2'
                    }
                ]
        };

        this.lightPassPipeline = renderer.device.createRenderPipeline({
            layout: this.lightPassPipelineLayout,
            depthStencil: {
                depthWriteEnabled:true,
                depthCompare: "less",
                format: "depth24plus"
            },
            vertex: {
                module: renderer.device.createShaderModule({
                    label: "passthrough vert shader",
                    code: shaders.passthroughVertSrc
                }),
                buffers: [ screenQuadVertexLayout ]
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    label: "lighting pass frag shader",
                    code: shaders.clusteredDeferredFragSrc
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
        // TODO-3: run the Forward+ rendering pass:
        // - run the clustering compute shader
        // - run the G-buffer pass, outputting position, albedo, and normals
        // - run the fullscreen pass, which reads from the G-buffer and performs lighting calculations
        const gBufferAlbedoView  = this.gBufferAlbedoDepth.createView();
        const gBufferNormalView  = this.gBufferNormal.createView();
        const gBufferPosView = this.gBufferPos.createView();

        const computeEncoder = renderer.device.createCommandEncoder();
        this.lights.doLightClustering(computeEncoder);

        renderer.device.queue.submit([computeEncoder.finish()]);
                

        // gBuffer Pass
        const gBufferRenderEncoder = renderer.device.createCommandEncoder();
        
        const gBufferRenderPass = gBufferRenderEncoder.beginRenderPass({
            label: "forward+ render pass",
            colorAttachments: [
                {
                    view: gBufferAlbedoView,
                    clearValue: [0, 0, 0, 1],
                    loadOp: "clear",
                    storeOp: "store"
                }, 
                {
                    view: gBufferNormalView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                },
                {
                    view: gBufferPosView,
                    clearValue: [0, 0, 0, 1],
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
        gBufferRenderPass.setPipeline(this.gBufferPassPipeline);
        
        gBufferRenderPass.setBindGroup(shaders.constants.bindGroup_scene, this.gBufferBindGroup)
        this.scene.iterate(node => {
            gBufferRenderPass.setBindGroup(shaders.constants.bindGroup_model, node.modelBindGroup);
        }, material => {
            gBufferRenderPass.setBindGroup(shaders.constants.bindGroup_material, material.materialBindGroup);
        }, primitive => {
            gBufferRenderPass.setVertexBuffer(0, primitive.vertexBuffer);
            gBufferRenderPass.setIndexBuffer(primitive.indexBuffer, 'uint32');
            gBufferRenderPass.drawIndexed(primitive.numIndices);
        });
        
        gBufferRenderPass.end();
        
        renderer.device.queue.submit([gBufferRenderEncoder.finish()]);
        
        // Lighting pass

        const sampler = renderer.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
        });

        this.sceneUniformsBindGroup = renderer.device.createBindGroup({
            label: "deferred scene uniforms bind group",
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
                    resource: { buffer: this.lights.computeOutputBuffer }
                },
                {
                    binding: 3,
                    resource: { buffer: this.lights.additionalUniformsBuffer }
                },
                {
                    binding: 4,
                    resource: gBufferAlbedoView
                },
                {
                    binding: 5,
                    resource: gBufferNormalView
                },
                {
                    binding: 6,
                    resource: gBufferPosView
                },
                {
                    binding: 7,
                    resource: sampler
                }
            ]
        });

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
        renderPass.setPipeline(this.lightPassPipeline);

        renderPass.setBindGroup(shaders.constants.bindGroup_scene, this.sceneUniformsBindGroup)

        const quadVertices = new Float32Array([
            -1.0, -1.0,
            1.0, -1.0,
            -1.0,  1.0,
            1.0,  1.0 
        ]);
        
        const quadIndices = new Uint32Array([
            0, 1, 2,
            2, 1, 3
        ]);
        
        const vertexBuffer = renderer.device.createBuffer({
            size: quadVertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        renderer.device.queue.writeBuffer(vertexBuffer, 0, quadVertices);
        
        // Index buffer
        const indexBuffer = renderer.device.createBuffer({
            size: quadIndices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        renderer.device.queue.writeBuffer(indexBuffer, 0, quadIndices);
        
        const numIndices = quadIndices.length;

        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setIndexBuffer(indexBuffer, 'uint32');
        renderPass.drawIndexed(numIndices);

        renderPass.end();

        renderer.device.queue.submit([renderEncoder.finish()]);
        
    }
}
