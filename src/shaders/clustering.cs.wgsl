// TODO-2: implement the light clustering compute shader

// ------------------------------------
// Calculating cluster bounds:
// ------------------------------------
// For each cluster (X, Y, Z):
//     - Calculate the screen-space bounds for this cluster in 2D (XY).
//     - Calculate the depth bounds for this cluster in Z (near and far planes).
//     - Convert these screen and depth bounds into view-space coordinates.
//     - Store the computed bounding box (AABB) for the cluster.

// ------------------------------------
// Assigning lights to clusters:
// ------------------------------------
// For each cluster:
//     - Initialize a counter for the number of lights in this cluster.

//     For each light:
//         - Check if the light intersects with the cluster’s bounding box (AABB).
//         - If it does, add the light to the cluster's light list.
//         - Stop adding lights if the maximum number of lights is reached.

//     - Store the number of lights assigned to this cluster.
struct Uniforms {
    canvasX: i32,
    canvasY: i32,
    tileGridX: i32,
    tileGridY: i32
}

@group(${bindGroup_scene}) @binding(0) var<storage, read_write> computeOutput: array<i32>;
@group(${bindGroup_scene}) @binding(1) var<uniform> uniforms: Uniforms;

@compute
@workgroup_size(1)
fn main(@builtin(global_invocation_id) globalIdx: vec3u) {
    
    var output = i32(globalIdx.x);
    if ((globalIdx.x | 1) == globalIdx.x) {
        output *= 2;
    }
    computeOutput[globalIdx.x] = output;
    return;
}