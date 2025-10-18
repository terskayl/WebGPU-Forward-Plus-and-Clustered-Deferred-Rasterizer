// TODO-3: implement the Clustered Deferred fullscreen fragment shader

// Similar to the Forward+ fragment shader, but with vertex information coming from the G-buffer instead.

@group(${bindGroup_scene}) @binding(0) var<uniform> cameraUniforms: CameraUniforms;

@group(${bindGroup_material}) @binding(0) var diffuseTex: texture_2d<f32>;
@group(${bindGroup_material}) @binding(1) var diffuseTexSampler: sampler;

struct FragmentInput
{
    @location(0) pos: vec3f,
    @location(1) nor: vec3f,
    @location(2) uv: vec2f
}

struct FragmentOutput
{
    @location(0) albedoDepth: vec4f,
    @location(1) nor: vec4f,
    @location(2) pos: vec4f
}

@fragment
fn main(in: FragmentInput) -> FragmentOutput
{
    let diffuseColor = textureSample(diffuseTex, diffuseTexSampler, in.uv);
    if (diffuseColor.a < 0.5f) {
        discard;
    }

    let viewSpace = cameraUniforms.viewMat * vec4(in.pos, 1.0); 

    let albedoDepth = vec4<f32>(diffuseColor.rgb, viewSpace.z);
    var out: FragmentOutput;
    out.albedoDepth = albedoDepth;
    out.nor = vec4(in.nor, 0.0);
    out.pos = vec4(in.pos, 1.0);
    return out;
}
