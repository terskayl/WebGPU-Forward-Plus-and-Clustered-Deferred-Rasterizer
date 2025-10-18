struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@location(0) pos: vec2<f32>) -> VSOut {
    var out: VSOut;
    out.position = vec4<f32>(pos, 0.0, 1.0);
    out.uv = (pos + vec2<f32>(1.0)) * 0.5;
    out.uv.y = 1 - out.uv.y; // NDC reasons - flip horizontally
    return out;
}
