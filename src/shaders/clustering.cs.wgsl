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
    pixelDimX: i32,
    pixelDimY: i32
}

@group(${bindGroup_scene}) @binding(0) var<storage, read_write> computeOutput: ClusterSet;
@group(${bindGroup_scene}) @binding(1) var<uniform> uniforms: Uniforms;
@group(${bindGroup_scene}) @binding(2) var<uniform> cameraUniforms: CameraUniforms;
@group(${bindGroup_scene}) @binding(3) var<storage, read> lights: LightSet;

@compute
@workgroup_size(1)
fn main(@builtin(global_invocation_id) globalIdx: vec3u) {

    let tileGridDimX = (uniforms.canvasX + uniforms.pixelDimX - 1) / uniforms.pixelDimX;
    let tileGridDimY = (uniforms.canvasY + uniforms.pixelDimY - 1) / uniforms.pixelDimY;
    
    var output = 1;//i32(globalIdx.x * globalIdx.y);
    if (((globalIdx.x + u32(tileGridDimX) * globalIdx.y) | 1) == (globalIdx.x + u32(tileGridDimX) * globalIdx.y)) {
        output = 2;
    }
    // LINK DEPTH
    computeOutput.clusters[u32(tileGridDimY) * u32(tileGridDimX) * globalIdx.z + u32(tileGridDimX) * globalIdx.y + globalIdx.x].lightIndices[0] = output;
    

    return;
}