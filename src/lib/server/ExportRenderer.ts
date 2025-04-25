// src/lib/server/ExportRenderer.ts 
// (Conceptual - Requires Node.js environment and dependencies)

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BloomPass } from 'three/examples/jsm/postprocessing/BloomPass.js'; // Check if this is the right Bloom pass used in R3F/postprocessing
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'; // Needed for correct colorspace
// --- Potentially needed for R3F/postprocessing Bloom equivalence: ---
// import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'; 

import VisualizerManager, { VisualObject3D } from '../VisualizerManager';
import TimeManager from '../TimeManager';
// import { spawn } from 'child_process'; // For ffmpeg
// import { Writable } from 'stream';    // For ffmpeg stream
// const createGLContext = require('gl'); // Example headless GL

// --- Configuration ---
interface ExportOptions {
    width: number;          // e.g., 1280
    height: number;         // e.g., 720
    fps: number;            // e.g., 60
    startTimeSeconds: number;
    endTimeSeconds: number;
    outputFilename: string; // e.g., 'output.mp4'
    bpm: number;            // Current BPM
    tracks: any[];          // Pass necessary track data
    ffmpegPath?: string;
    // Add Bloom settings if needed, mirroring VisualizerView
    bloomIntensity?: number;
    bloomThreshold?: number;
    bloomSmoothing?: number; // Note: Bloom parameters might map differently between R3F and three.js passes
}

class ExportRenderer {
    private visualizerManager: VisualizerManager;
    private timeManager: TimeManager; // Assuming a Node-compatible version or wrapper
    private options: ExportOptions;

    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    private renderTarget: THREE.WebGLRenderTarget; // Used by composer

    // Headless WebGL context
    // private glContext: WebGLRenderingContext; 

    private objectCache: Map<string, THREE.Mesh> = new Map();
    private materialCache: Map<string, THREE.Material> = new Map();

    constructor(options: ExportOptions, timeManager: TimeManager, visualizerManager: VisualizerManager) {
        this.options = options;
        this.timeManager = timeManager;
        this.visualizerManager = visualizerManager;

        // --- Initialize Three.js Scene ---
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.options.width / this.options.height, 0.1, 1000);
        this.camera.position.set(0, 0, 15); // Match VisualizerView

        // --- Setup Headless WebGL & Renderer ---
        // this.glContext = createGLContext(this.options.width, this.options.height, { preserveDrawingBuffer: true });
        // this.renderer = new THREE.WebGLRenderer({ context: this.glContext, antialias: true, alpha: true });
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // Placeholder
        this.renderer.setSize(this.options.width, this.options.height);
        this.renderer.setPixelRatio(1);
        // Important: Ensure output color space is correct, especially with post-processing
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        // this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // Or another tone mapping if needed

        // --- Render Target for Composer ---
        // The composer needs a render target with depth buffer
        this.renderTarget = new THREE.WebGLRenderTarget(this.options.width, this.options.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            // type: THREE.FloatType, // Using FloatType might be better for post-processing quality
            depthBuffer: true, // EffectComposer usually requires depth buffer
            stencilBuffer: false,
        });


        // --- Add Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 10, 5);
        this.scene.add(directionalLight);

        // --- Setup Post-Processing ---
        this.composer = new EffectComposer(this.renderer, this.renderTarget);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // Configure Bloom - **MATCH VisualizerView settings**
        // Note: Mapping R3F/@react-postprocessing Bloom parameters to three.js passes might require checking library versions/specifics.
        // UnrealBloomPass is often used for the effect seen in R3F examples. Let's assume UnrealBloomPass for now.
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.options.width, this.options.height),
            this.options.bloomIntensity ?? 1.0, // intensity
            this.options.bloomThreshold ?? 0.1,  // threshold (radius in UnrealBloomPass, maps differently than threshold)
            this.options.bloomSmoothing ?? 0.2   // strength (smoothing in UnrealBloomPass)
        );
        // --- Adjust Bloom settings based on VisualizerView's Bloom component props ---
        // const bloomPass = new BloomPass(
        //     1,    // strength
        //     25,   // kernel size
        //     4,    // sigma
        //     256,  // resolution
        // );
        this.composer.addPass(bloomPass);
        
        // Add OutputPass to handle color space and encoding correctly after post-processing
        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);

        // --- Initialize VisualizerManager ---
        this.timeManager.setBPM(this.options.bpm);
        this.visualizerManager.setTracks(this.options.tracks); // Load initial track data
        this.visualizerManager.resetState(); // Ensure clean state
    }

    // --- updateSceneFromVisualObjects (Same as previous example, ensure it handles material updates correctly) ---
    private updateSceneFromVisualObjects(visualObjects: VisualObject3D[]): void {
        const currentObjectIds = new Set<string>();
        visualObjects.forEach(objData => currentObjectIds.add(objData.id));

        // Add/Update objects
        for (const objData of visualObjects) {
             let mesh = this.objectCache.get(objData.id);
             let material: THREE.MeshStandardMaterial;

             if (!mesh) {
                 // --- Create New Mesh ---
                 const geometry = objData.type === 'sphere'
                     ? new THREE.SphereGeometry(0.5, 32, 32)
                     : new THREE.BoxGeometry(1, 1, 1);

                 // --- Create or Get Cached Material ---
                 const materialKey = `${objData.color}-${objData.opacity}-${objData.emissive}-${objData.emissiveIntensity}-${objData.type}`; // More specific key
                 let cachedMaterial = this.materialCache.get(materialKey) as THREE.MeshStandardMaterial;
                 if (!cachedMaterial) {
                     const isTransparent = objData.opacity < 1.0;
                     cachedMaterial = new THREE.MeshStandardMaterial({
                         color: objData.color ?? '#ffffff',
                         opacity: objData.opacity ?? 1.0,
                         transparent: isTransparent,
                         depthWrite: !isTransparent,
                         emissive: objData.emissive ?? objData.color ?? '#ffffff', // Default from color
                         emissiveIntensity: objData.emissiveIntensity ?? 0,
                         toneMapped: false, // Essential for Bloom
                     });
                     this.materialCache.set(materialKey, cachedMaterial);
                 }
                 material = cachedMaterial;

                 mesh = new THREE.Mesh(geometry, material);
                 mesh.name = objData.id;
                 this.scene.add(mesh);
                 this.objectCache.set(objData.id, mesh);
             } else {
                  // --- Update Existing Mesh ---
                  material = mesh.material as THREE.MeshStandardMaterial;

                  // Update transforms
                  mesh.position.set(...objData.position);
                  mesh.rotation.set(...objData.rotation as [number, number, number]);
                  mesh.scale.set(...objData.scale);

                  // Update material properties only if they differ (more efficient)
                  const needsUpdate =
                      material.color.getHexString() !== (objData.color ?? '#ffffff').substring(1) ||
                      material.opacity !== (objData.opacity ?? 1.0) ||
                      material.emissive.getHexString() !== (objData.emissive ?? objData.color ?? '#ffffff').substring(1) ||
                      material.emissiveIntensity !== (objData.emissiveIntensity ?? 0);

                 if (needsUpdate) {
                    material.color.set(objData.color ?? '#ffffff');
                    material.opacity = objData.opacity ?? 1.0;
                    material.transparent = material.opacity < 1.0;
                    material.depthWrite = !material.transparent;
                    material.emissive.set(objData.emissive ?? objData.color ?? '#ffffff');
                    material.emissiveIntensity = objData.emissiveIntensity ?? 0;
                    material.needsUpdate = true;
                 }
             }
        }

        // Remove objects
        for (const existingId of this.objectCache.keys()) {
            if (!currentObjectIds.has(existingId)) {
                const meshToRemove = this.objectCache.get(existingId);
                if (meshToRemove) {
                    this.scene.remove(meshToRemove);
                    // Consider disposing geometry/material if not reused via cache
                    // meshToRemove.geometry.dispose();
                    this.objectCache.delete(existingId);
                }
            }
        }
    }


    // --- Main Export Function ---
    public async export(onProgress: (percent: number, message: string) => void): Promise<void> {
        const { width, height, fps, startTimeSeconds, endTimeSeconds, outputFilename, ffmpegPath = 'ffmpeg' } = this.options;
        const durationSeconds = endTimeSeconds - startTimeSeconds;
        const totalFrames = Math.ceil(durationSeconds * fps);
        const pixelBuffer = new Uint8Array(width * height * 4); // RGBA

        console.log(`Starting export: ${totalFrames} frames (${durationSeconds}s @ ${fps}fps) to ${outputFilename}`);
        onProgress(0, `Starting export: ${totalFrames} frames...`);

        // --- Reset ---
        this.visualizerManager.resetState();

        // --- Setup ffmpeg process (Conceptual) ---
        const ffmpegArgs = [
             '-y', // Overwrite output file without asking
             '-f', 'rawvideo', // Input format
             '-vcodec', 'rawvideo',
             '-s', `${width}x${height}`, // Input size
             '-pix_fmt', 'rgba', // Input pixel format (matching buffer)
             '-r', String(fps), // Input frame rate
             '-i', '-', // Input comes from stdin
             // Output options
             '-vcodec', 'libx264',
             '-preset', 'medium', 
             '-crf', '18',        
             '-pix_fmt', 'yuv420p',
             outputFilename
         ];
        // const ffmpeg = spawn(ffmpegPath, ffmpegArgs);
        // const ffmpegStdin = ffmpeg.stdin as Writable;
        // ffmpeg.stderr.on('data', (data) => { /* ... logging ... */ });
        // Handle ffmpeg exit/error

        // --- Frame-by-Frame Rendering Loop ---
        for (let i = 0; i < totalFrames; i++) {
            const currentTime = startTimeSeconds + i / fps;
            const currentBeat = this.timeManager.timeToBeat(currentTime); // Use conversion

            // Set exact time
            this.timeManager.seekTo(currentBeat);

            // Get visual state
            const visualObjects = this.visualizerManager.getVisualObjects();

            // Update Three.js scene
            this.updateSceneFromVisualObjects(visualObjects);

            // Render using the EffectComposer
            this.composer.render(); // Renders the scene with post-processing to its internal buffer

            // Read pixel data from the *renderer's* drawing buffer after composer has rendered
            this.renderer.readRenderTargetPixels(
                this.composer.readBuffer, // Read from the composer's output buffer
                0, 0, width, height,
                pixelBuffer
            );

            // --- Pipe buffer to ffmpeg (Conceptual) ---
            // const success = ffmpegStdin.write(Buffer.from(pixelBuffer));
            // if (!success) await new Promise(resolve => ffmpegStdin.once('drain', resolve));

            // --- Update Progress ---
            const progressPercent = ((i + 1) / totalFrames) * 100;
            if ((i + 1) % 10 === 0 || i === totalFrames - 1) { // Update progress less frequently
                 onProgress(progressPercent, `Rendering frame ${i + 1}/${totalFrames}`);
            }
        }

        // --- Finish ffmpeg ---
        // ffmpegStdin.end();
        console.log('All frames rendered. Waiting for ffmpeg...');
        onProgress(100, 'Finalizing video file...');

        // await new Promise<void>((resolve, reject) => { /* Wait for ffmpeg exit */ });

        // --- Cleanup ---
        this.renderer.dispose();
        // this.renderTarget.dispose(); // Composer might manage its own target
        this.composer.dispose(); // Dispose composer resources if necessary
        this.objectCache.forEach(mesh => { /* dispose geometry */ });
        this.materialCache.forEach(material => material.dispose());
        // this.glContext.destroy();

        console.log(`Export complete: ${outputFilename}`);
        onProgress(100, `Export complete: ${outputFilename}`); // Final success message
    }
}

export default ExportRenderer;

// --- TODO ---
// 1. Set up actual Node.js environment with 'three', 'gl' (or similar), and potentially 'ffmpeg-fluent' or 'child_process'.
// 2. Refactor TimeManager or create a Node-safe version.
// 3. Ensure Synthesizers/Effects used by VisualizerManager are Node-safe.
// 4. Implement actual ffmpeg spawning and piping.
// 5. Create an API endpoint (e.g., /api/export) in your framework (Next.js?) that receives the request from PlaybarView, instantiates ExportRenderer, calls export(), and potentially uses WebSockets to send progress back to the ExportView modal.
// 6. Match Bloom settings exactly to VisualizerView's @react-three/postprocessing settings. 