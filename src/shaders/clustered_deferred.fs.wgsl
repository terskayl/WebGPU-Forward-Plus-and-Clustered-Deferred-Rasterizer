// TODO-3: implement the Clustered Deferred G-buffer fragment shader

// This shader should only store G-buffer information and should not do any shading.


struct Uniforms {
    canvasX: i32,
    canvasY: i32,
    pixelDimX: i32,
    pixelDimY: i32,
    depthSlices: i32
}

@group(${bindGroup_scene}) @binding(0) var<uniform> cameraUniforms: CameraUniforms;
@group(${bindGroup_scene}) @binding(1) var<storage, read> lightSet: LightSet;
@group(${bindGroup_scene}) @binding(2) var<storage, read_write> computeOutput: ClusterSet;
@group(${bindGroup_scene}) @binding(3) var<uniform> uniforms: Uniforms;

@group(${bindGroup_scene}) @binding(4) var albedoDepthTex: texture_2d<f32>;
@group(${bindGroup_scene}) @binding(5) var normalTex: texture_2d<f32>;
@group(${bindGroup_scene}) @binding(6) var posTex: texture_2d<f32>;
@group(${bindGroup_scene}) @binding(7) var texSampler: sampler;

struct FragmentInput {
    @location(0) uv: vec2f
}

@fragment
fn main(in: FragmentInput, @builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4f
{

    let albedoDepth = textureSample(albedoDepthTex, texSampler, in.uv);
    let nor = textureSample(normalTex, texSampler, in.uv);
    let pos = textureSample(posTex, texSampler, in.uv);

    let tileGridDimX: i32 = (uniforms.canvasX + uniforms.pixelDimX - 1) / uniforms.pixelDimX;
    let tileGridDimY: i32 = (uniforms.canvasY + uniforms.pixelDimY - 1) / uniforms.pixelDimY;
    
    let tileGridCoord = floor(frag_coord.xy / vec2<f32>(f32(uniforms.pixelDimX), f32(uniforms.pixelDimX)));
    let tileGridCoordId = i32(tileGridCoord.y) * tileGridDimX + i32(tileGridCoord.x);
    let depth = albedoDepth.w;

    let depthLayerWidth = (cameraUniforms.farPlane - cameraUniforms.nearPlane) / f32(uniforms.depthSlices);
    
    // With logaritmic depth
    let depthInd = clamp(f32(uniforms.depthSlices) * log(-depth / cameraUniforms.nearPlane) / log(cameraUniforms.farPlane / cameraUniforms.nearPlane),0.0, f32(uniforms.depthSlices - 1));
    var cluster = computeOutput.clusters[tileGridCoordId + i32(tileGridDimX * tileGridDimY * i32(floor(depthInd)))]; // LINK DEPTH, replace with proper func
    
    var read = f32(cluster.lightIndices[0]);
    var readInt = cluster.lightIndices[0];


    // We must re-calculate position
    
    // Screenspace UV bounds
    let SSX = u32(frag_coord.x) * u32(uniforms.pixelDimX);
    let UVX = f32(SSX) / f32(uniforms.canvasX);
    let NDCX = 2.0 * UVX - 1.0;

    let SSY = u32(frag_coord.y) * u32(uniforms.pixelDimY);
    let UVY = f32(SSY) / f32(uniforms.canvasY);
    let NDCY = 1.0 - 2.0 * UVY;

    let tanHalfFov = tan(cameraUniforms.fov * 0.5);
    let viewSpacePos = vec3<f32>(NDCX * depth * tanHalfFov * cameraUniforms.aspectRatio,
                                NDCY * depth * tanHalfFov,
                                depth);

    var totalLightContrib = vec3f(0, 0, 0);
            // TODO: SIZE OF BUFFER?
    for (var i = 0u; i < 128; i += 1) {
        let lightIdx = cluster.lightIndices[i];
        if (lightIdx > 0) {
            var light = lightSet.lights[lightIdx - 1];
            totalLightContrib += calculateLightContrib(light, pos.xyz, normalize(nor.xyz));
        } else {
            break;
        }
    }

    var finalColor = albedoDepth.rgb * (totalLightContrib + 0.1);

    return vec4(finalColor, 1);

    //return vec4<f32>( vec3<f32>(read / f32(tileGridDimX * tileGridDimY * 64)), 1.0);


}