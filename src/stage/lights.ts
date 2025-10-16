import { vec3 } from "wgpu-matrix";
import { device } from "../renderer";

import * as shaders from '../shaders/shaders';
import { Camera } from "./camera";

// h in [0, 1]
function hueToRgb(h: number) {
    let f = (n: number, k = (n + h * 6) % 6) => 1 - Math.max(Math.min(k, 4 - k, 1), 0);
    return vec3.lerp(vec3.create(1, 1, 1), vec3.create(f(5), f(3), f(1)), 0.8);
}

export class Lights {
    private camera: Camera;

    numLights = 500;
    static readonly maxNumLights = 5000;
    static readonly numFloatsPerLight = 8; // vec3f is aligned at 16 byte boundaries

    static readonly lightIntensity = 0.1;

    lightsArray = new Float32Array(Lights.maxNumLights * Lights.numFloatsPerLight);
    lightSetStorageBuffer: GPUBuffer;

    timeUniformBuffer: GPUBuffer;

    moveLightsComputeBindGroupLayout: GPUBindGroupLayout;
    moveLightsComputeBindGroup: GPUBindGroup;
    moveLightsComputePipeline: GPUComputePipeline;

    // TODO-2: add layouts, pipelines, textures, etc. needed for light clustering here
    computeOutputBuffer: GPUBuffer;
    additionalUniformsBuffer: GPUBuffer;

    computeOutputBindGroupLayout: GPUBindGroupLayout;

    computePipeline: GPUComputePipeline;
    computePipelineLayout: GPUPipelineLayout;
    
    // How many pixels per cluster in screen space?
    pixelDimX: number = 128;
    pixelDimY: number = 128;
    
    tileGridDimX: number;
    tileGridDimY: number;

    canvasWidth: number;
    canvasHeight: number;

    constructor(camera: Camera) {
        let canvas = document.getElementById("mainCanvas") as HTMLCanvasElement;
    
        const devicePixelRatio = window.devicePixelRatio;
        this.canvasWidth = canvas.clientWidth * devicePixelRatio;
        this.canvasHeight = canvas.clientHeight * devicePixelRatio;
        // TODO: Recalc canvas dims and tileGrid number and compute output buffer on RESIZE

        this.tileGridDimX = Math.floor((this.canvasWidth + this.pixelDimX - 1) / this.pixelDimX);
        this.tileGridDimY = Math.floor((this.canvasHeight + this.pixelDimY - 1) / this.pixelDimY);

        this.camera = camera;

        this.lightSetStorageBuffer = device.createBuffer({
            label: "lights",
            size: 16 + this.lightsArray.byteLength, // 16 for numLights + padding
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        this.populateLightsBuffer();
        this.updateLightSetUniformNumLights();

        this.timeUniformBuffer = device.createBuffer({
            label: "time uniform",
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.moveLightsComputeBindGroupLayout = device.createBindGroupLayout({
            label: "move lights compute bind group layout",
            entries: [
                { // lightSet
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" }
                },
                { // time
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "uniform" }
                }
            ]
        });

        this.moveLightsComputeBindGroup = device.createBindGroup({
            label: "move lights compute bind group",
            layout: this.moveLightsComputeBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.lightSetStorageBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.timeUniformBuffer }
                }
            ]
        });

        this.moveLightsComputePipeline = device.createComputePipeline({
            label: "move lights compute pipeline",
            layout: device.createPipelineLayout({
                label: "move lights compute pipeline layout",
                bindGroupLayouts: [ this.moveLightsComputeBindGroupLayout ]
            }),
            compute: {
                module: device.createShaderModule({
                    label: "move lights compute shader",
                    code: shaders.moveLightsComputeSrc
                }),
                entryPoint: "main"
            }
        });

        // TODO-2: initialize layouts, pipelines, textures, etc. needed for light clustering here

        const additionalUniformsBufferHost = new Int32Array(4);
        // Canvas dim, and grid dim, in one vec4
        this.additionalUniformsBuffer = device.createBuffer({
            label: "vertex additional uniforms buffer",
            size: 4 * 4, // 4 * sizeof(int)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })
        additionalUniformsBufferHost[0] = this.canvasWidth;
        additionalUniformsBufferHost[1] = this.canvasHeight;
        additionalUniformsBufferHost[2] = this.pixelDimX;
        additionalUniformsBufferHost[3] = this.pixelDimY;
        device.queue.writeBuffer(this.additionalUniformsBuffer, 0, additionalUniformsBufferHost);

        const computeOutputBufferHost = new Int32Array(this.tileGridDimX * this.tileGridDimY)
        this.computeOutputBuffer = device.createBuffer({
            label: "compute output buffer",
            size: computeOutputBufferHost.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        // Init to all zeros
        device.queue.writeBuffer(this.computeOutputBuffer, 0, computeOutputBufferHost);

        
        this.computeOutputBindGroupLayout = device.createBindGroupLayout({
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

        this.computePipelineLayout = device.createPipelineLayout({
            label: "forward+ compute pipeline layout",
            bindGroupLayouts: [
                // TODO (aajiang): Place data here.
                this.computeOutputBindGroupLayout
            ]
        });

        this.computePipeline = device.createComputePipeline({
            label: "forward+ compute pipeline",
            layout: this.computePipelineLayout,
            compute: {
                module: device.createShaderModule({
                    label: "forward+ cluster compute shader",
                    code: shaders.clusteringComputeSrc
                })
            }
        });



    }

    private populateLightsBuffer() {
        for (let lightIdx = 0; lightIdx < Lights.maxNumLights; ++lightIdx) {
            // light pos is set by compute shader so no need to set it here
            const lightColor = vec3.scale(hueToRgb(Math.random()), Lights.lightIntensity);
            this.lightsArray.set(lightColor, (lightIdx * Lights.numFloatsPerLight) + 4);
        }

        device.queue.writeBuffer(this.lightSetStorageBuffer, 16, this.lightsArray);
    }

    updateLightSetUniformNumLights() {
        device.queue.writeBuffer(this.lightSetStorageBuffer, 0, new Uint32Array([this.numLights]));
    }

    doLightClustering(encoder: GPUCommandEncoder) {
        // TODO-2: run the light clustering compute pass(es) here
        // implementing clustering here allows for reusing the code in both Forward+ and Clustered Deferred

        let computeOutputBindGroup = device.createBindGroup({
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
        });

        const computePass = encoder.beginComputePass({label: "forward+ compute pass"});

        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, computeOutputBindGroup);
        computePass.dispatchWorkgroups(this.tileGridDimX * this.tileGridDimY, 1, 1);
        computePass.end();
    }

    // CHECKITOUT: this is where the light movement compute shader is dispatched from the host
    onFrame(time: number) {
        device.queue.writeBuffer(this.timeUniformBuffer, 0, new Float32Array([time]));

        // not using same encoder as render pass so this doesn't interfere with measuring actual rendering performance
        const encoder = device.createCommandEncoder();

        const computePass = encoder.beginComputePass();
        computePass.setPipeline(this.moveLightsComputePipeline);

        computePass.setBindGroup(0, this.moveLightsComputeBindGroup);

        const workgroupCount = Math.ceil(this.numLights / shaders.constants.moveLightsWorkgroupSize);
        computePass.dispatchWorkgroups(workgroupCount);

        computePass.end();

        device.queue.submit([encoder.finish()]);
    }
}
