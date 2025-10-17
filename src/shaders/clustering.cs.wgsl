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
    pixelDimY: i32,
    depthSlices: i32
}

@group(${bindGroup_scene}) @binding(0) var<storage, read_write> computeOutput: ClusterSet;
@group(${bindGroup_scene}) @binding(1) var<uniform> uniforms: Uniforms;
@group(${bindGroup_scene}) @binding(2) var<uniform> cameraUniforms: CameraUniforms;
@group(${bindGroup_scene}) @binding(3) var<storage, read> lights: LightSet;

@compute
@workgroup_size(1)
fn main(@builtin(global_invocation_id) globalIdx: vec3u) {

    // TODO: SEEMS LIKE NOT UPDATING WITH CAMERA MOVE

    let tileGridDimX = (uniforms.canvasX + uniforms.pixelDimX - 1) / uniforms.pixelDimX;
    let tileGridDimY = (uniforms.canvasY + uniforms.pixelDimY - 1) / uniforms.pixelDimY;
    
    // Screenspace UV bounds
    let SSXMin = globalIdx.x * u32(uniforms.pixelDimX);
    let SSXMax = SSXMin + u32(uniforms.pixelDimX) - 1;

    let SSYMin = globalIdx.y * u32(uniforms.pixelDimY);
    let SSYMax = SSYMin + u32(uniforms.pixelDimY) - 1;

    let UVXMin = f32(SSXMin) / f32(uniforms.canvasX);
    let NDCXMin = 2.0 * UVXMin - 1.0;
    let UVXMax = f32(SSXMax) / f32(uniforms.canvasX);
    let NDCXMax = 2.0 * UVXMax - 1.0;

    let UVYMin = f32(SSYMin) / f32(uniforms.canvasY);
    let NDCYMin = 1.0 - 2.0 * UVYMin;
    let UVYMax = f32(SSYMax) / f32(uniforms.canvasY);
    let NDCYMax = 1.0 - 2.0 * UVYMax;

    // Linear Depth Spliting
    //let depthLayerWidth = (cameraUniforms.farPlane - cameraUniforms.nearPlane) / f32(cameraUniforms.farPlane);
    //let depthMin = depthLayerWidth * f32(globalIdx.z);
    //let depthMax = depthMin + depthLayerWidth;

    // Log Depth Spliting
    let depthMin = cameraUniforms.nearPlane * pow(cameraUniforms.farPlane / cameraUniforms.nearPlane, f32(globalIdx.z) / f32(uniforms.depthSlices));
    let depthMax = cameraUniforms.nearPlane * pow(cameraUniforms.farPlane / cameraUniforms.nearPlane, f32(globalIdx.z + 1u) / f32(uniforms.depthSlices));


    let tanHalfFov = tan(cameraUniforms.fov * 0.5);
    let maxCorner = vec3<f32>(NDCXMax * depthMax * tanHalfFov * cameraUniforms.aspectRatio,
                                NDCYMax * depthMax * tanHalfFov,
                                -depthMin);
    // must take x and y from further min corner, as that has more extreme values
    // acutally must test both.
    var minCorner= vec3<f32>(NDCXMin * depthMax * tanHalfFov * cameraUniforms.aspectRatio,
                                NDCYMin * depthMax * tanHalfFov,
                                -depthMax);
    minCorner = min(minCorner, vec3<f32>(NDCXMin * depthMin * tanHalfFov * cameraUniforms.aspectRatio,
                                NDCYMin * depthMin * tanHalfFov,
                                -depthMax));

    var sum = 0;
    for (var i: u32 = 0; i < lights.numLights; i += 1) {
        let light = lights.lights[i];
        let lightViewPos = vec3<f32>((cameraUniforms.viewMat * vec4<f32>(light.pos, 1.0)).xyz); 
        let closestPoint = max(min(lightViewPos, maxCorner), minCorner);
        // TODO HOOK UP RADIUS
        if (distance(lightViewPos, closestPoint) < 2.0) {
        //let bool = lightViewPos == closestPoint; 
        //if (bool.x && bool.y && bool.z) {    
            computeOutput.clusters[u32(tileGridDimY) * u32(tileGridDimX) * globalIdx.z + u32(tileGridDimX) * globalIdx.y + globalIdx.x].lightIndices[sum] = i32(i) + 1; // ADD ONE TO ALLOW ZERO TO DENOTE NONE
            sum += 1;
        }
        if (sum >= 32) {
            break;
        }
    }
    
    //computeOutput.clusters[u32(tileGridDimY) * u32(tileGridDimX) * globalIdx.z + u32(tileGridDimX) * globalIdx.y + globalIdx.x].lightIndices[0] = i32(u32(tileGridDimY) * u32(tileGridDimX) * globalIdx.z + u32(tileGridDimX) * globalIdx.y + globalIdx.x);
    
    //computeOutput.clusters[u32(tileGridDimY) * u32(tileGridDimX) * globalIdx.z + u32(tileGridDimX) * globalIdx.y + globalIdx.x].lightIndices[0] = sum;


    
    return;
}