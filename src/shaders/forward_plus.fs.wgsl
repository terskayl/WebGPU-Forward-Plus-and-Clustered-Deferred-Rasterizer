// TODO-2: implement the Forward+ fragment shader

// See naive.fs.wgsl for basic fragment shader setup; this shader should use light clusters instead of looping over all lights

// ------------------------------------
// Shading process:
// ------------------------------------
// Determine which cluster contains the current fragment.
// Retrieve the number of lights that affect the current fragment from the cluster’s data.
// Initialize a variable to accumulate the total light contribution for the fragment.
// For each light in the cluster:
//     Access the light's properties using its index.
//     Calculate the contribution of the light based on its position, the fragment’s position, and the surface normal.
//     Add the calculated contribution to the total light accumulation.
// Multiply the fragment’s diffuse color by the accumulated light contribution.
// Return the final color, ensuring that the alpha component is set appropriately (typically to 1).

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

@group(${bindGroup_material}) @binding(0) var diffuseTex: texture_2d<f32>;
@group(${bindGroup_material}) @binding(1) var diffuseTexSampler: sampler;

struct FragmentInput {
    @location(0) pos: vec3f,
    @location(1) nor: vec3f,
    @location(2) uv: vec2f
}

@fragment
fn main(in: FragmentInput, @builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4f
{

    let tileGridDimX: i32 = (uniforms.canvasX + uniforms.pixelDimX - 1) / uniforms.pixelDimX;
    let tileGridDimY: i32 = (uniforms.canvasY + uniforms.pixelDimY - 1) / uniforms.pixelDimY;


    //let uv = frag_coord.xy / vec2<f32>(f32(uniforms.canvasX), f32(uniforms.canvasY));
    //let tileGridCoord = floor(uv * vec2<f32>(f32(tileGridDimX), f32(tileGridDimY)) );

    let tileGridCoord = floor(frag_coord.xy / vec2<f32>(f32(uniforms.pixelDimX), f32(uniforms.pixelDimX)));

    //let x = i32(frag_coord.x) /uniforms.pixelDimX;
    //return vec4<f32>(0.1 * f32(x) , 0.0, 0.0, 1.0);

    let tileGridCoordId = i32(tileGridCoord.y) * tileGridDimX + i32(tileGridCoord.x);
    let depth = (cameraUniforms.viewMat * vec4<f32>(in.pos, 1.0)).z;

    //var cluster = computeOutput.clusters[tileGridCoordId + i32(tileGridDimX * tileGridDimY * i32(floor(-depth * 1.0)))]; // LINK DEPTH, replace with proper func
    let depthLayerWidth = (cameraUniforms.farPlane - cameraUniforms.nearPlane) / f32(uniforms.depthSlices);
    
    // With linear depth
    //var cluster = computeOutput.clusters[tileGridCoordId + i32(tileGridDimX * tileGridDimY * i32(floor(-depth / depthLayerWidth)))]; // LINK DEPTH, replace with proper func
    // With logaritmic depth
    let depthInd = clamp(f32(uniforms.depthSlices) * log(-depth / cameraUniforms.nearPlane) / log(cameraUniforms.farPlane / cameraUniforms.nearPlane),0.0, f32(uniforms.depthSlices - 1));
    let clusterId = tileGridCoordId + i32(tileGridDimX * tileGridDimY * i32(floor(depthInd)));
    //var cluster = computeOutput.clusters[clusterId]; 
    

    var read = f32(computeOutput.clusters[clusterId].lightIndices[0]);
    var readInt = computeOutput.clusters[clusterId].lightIndices[0];
        
    let diffuseColor = textureSample(diffuseTex, diffuseTexSampler, in.uv);
    if (diffuseColor.a < 0.5f) {
        discard;
    }

    var totalLightContrib = vec3f(0, 0, 0);
            // TODO: SIZE OF BUFFER?
    for (var i = 0u; i < 128; i += 1) {
        let lightIdx = computeOutput.clusters[clusterId].lightIndices[i];
        if (lightIdx > 0) {
            let light = lightSet.lights[lightIdx - 1];
            totalLightContrib += calculateLightContrib(light, in.pos, normalize(in.nor));
        } else {
            break;
        }
    }

    var finalColor = diffuseColor.rgb * totalLightContrib;

    //if (depth < -10 || depth > -7) {
    //    finalColor = vec3<f32>(1.0, 0.0, 0.0);
    //}


    return vec4(finalColor, 1);

    //return vec4<f32>( vec3<f32>(f32(readInt) / f32(tileGridDimX * tileGridDimY * 10)), 1.0);
}