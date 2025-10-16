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
    pixelDimY: i32
}

@group(${bindGroup_scene}) @binding(1) var<storage, read> lightSet: LightSet;
@group(${bindGroup_scene}) @binding(2) var<storage, read_write> computeOutput: array<i32>;
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

    let tileGridDimX = (uniforms.canvasX + uniforms.pixelDimX - 1) / uniforms.pixelDimX;
    let tileGridDimY = (uniforms.canvasY + uniforms.pixelDimY - 1) / uniforms.pixelDimY;


    //let uv = frag_coord.xy / vec2<f32>(f32(uniforms.canvasX), f32(uniforms.canvasY));
    //let tileGridCoord = floor(uv * vec2<f32>(f32(tileGridDimX), f32(tileGridDimY)) );

    let tileGridCoord = floor(frag_coord.xy / vec2<f32>(f32(uniforms.pixelDimX), f32(uniforms.pixelDimX)));

    //let x = i32(frag_coord.x) /uniforms.pixelDimX;
    //return vec4<f32>(0.1 * f32(x) , 0.0, 0.0, 1.0);

    let tileGridCoordId = i32(tileGridCoord.y) * tileGridDimX + i32(tileGridCoord.x);
    var read = f32(computeOutput[tileGridCoordId]);
    read /= f32(tileGridDimX * tileGridDimY);
    return vec4<f32>(vec3<f32>(read), 1.0);

    //return vec4<f32>(uv, 0.0, 1.0);

}