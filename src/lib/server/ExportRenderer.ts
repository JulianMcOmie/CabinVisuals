// src/lib/server/ExportRenderer.ts 
// (Conceptual - Requires Node.js environment and dependencies)

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BloomPass } from 'three/examples/jsm/postprocessing/BloomPass.js'; // Check if this is the right Bloom pass used in R3F/postprocessing
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'; // Needed for correct colorspace
// --- Potentially needed for R3F/postprocessing Bloom equivalence: ---
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'; 

import VisualizerManager, { VisualObject3D } from '../VisualizerManager';
import TimeManager from '../TimeManager';
// @ts-ignore - No types available for 'gl'
import GL from 'gl'; // Headless GL context
import NodeTimeManager from './NodeTimeManager'; // Assuming this path
import { spawn } from 'child_process'; // Import for ffmpeg
import { Writable } from 'stream'; // Import for ffmpeg stdin typing

// --- Configuration for the Renderer Instance --- (Separated from Project Data)
interface ExportRendererOptions {
    width: number;
    height: number;
    fps: number;
    outputFilename: string;
    bloomParams?: { strength: number; threshold: number; radius: number };
    ffmpegPath?: string; // Optional path to ffmpeg executable
}

// --- Progress Update Structure ---
interface ProgressUpdate {
    percent: number;
    message: string;
}

type OnProgressCallback = (update: ProgressUpdate) => void;

// Helper function to flip the pixel buffer vertically
function flipBufferVertically(buffer: Uint8Array, width: number, height: number): Uint8Array {
    const flippedBuffer = new Uint8Array(width * height * 4);
    const bytesPerRow = width * 4;
    for (let y = 0; y < height; y++) {
        const sourceRow = buffer.subarray(y * bytesPerRow, (y + 1) * bytesPerRow);
        const targetY = height - 1 - y;
        flippedBuffer.set(sourceRow, targetY * bytesPerRow);
    }
    return flippedBuffer;
}

// --- Main Renderer Class ---
class ExportRenderer {
    private options: ExportRendererOptions;
    private timeManager: NodeTimeManager; // Use NodeTimeManager
    private visualizerManager: VisualizerManager; // Use pre-configured instance

    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    private renderTarget: THREE.WebGLRenderTarget;
    private glContext: WebGLRenderingContext;
    private bloomPass?: UnrealBloomPass;

    // Caching for performance
    private objectCache: Map<string, THREE.Mesh> = new Map(); // Cache THREE.Mesh objects by VisualObject3D ID
    private geometryCache: Map<string, THREE.BufferGeometry> = new Map(); // Cache geometries by type
    private materialCache: Map<string, THREE.Material> = new Map(); // Cache materials by properties signature

    constructor(options: ExportRendererOptions, timeManager: NodeTimeManager, visualizerManager: VisualizerManager) {
        console.log('Initializing ExportRenderer...', options);
        this.options = options;
        this.timeManager = timeManager; // Use provided instance
        this.visualizerManager = visualizerManager; // Use provided instance

        // --- Setup Headless WebGL & Renderer ---
        this.glContext = GL(this.options.width, this.options.height, { preserveDrawingBuffer: true });
        this.renderer = new THREE.WebGLRenderer({
            context: this.glContext,
            antialias: true,
        });
        this.renderer.setSize(this.options.width, this.options.height);
        this.renderer.setPixelRatio(1);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // --- Setup Scene & Camera ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this.camera = new THREE.PerspectiveCamera(75, this.options.width / this.options.height, 0.1, 1000);
        this.camera.position.set(0, 0, 15); // Match VisualizerView

        // --- Add Lighting (matching VisualizerView Scene) ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 10, 5);
        this.scene.add(directionalLight);

        // --- Setup Post-Processing Render Target & Composer ---
        this.renderTarget = new THREE.WebGLRenderTarget(this.options.width, this.options.height, {
            depthBuffer: true, // Required for Composer
            stencilBuffer: false,
        });
        this.composer = new EffectComposer(this.renderer, this.renderTarget);
        this.composer.setSize(this.options.width, this.options.height);

        // --- Setup Post-Processing Passes (Defer configuration to export call) ---
        this.setupPostProcessingPasses(this.options.bloomParams); // Setup passes based on initial options

        // --- Reset Visualizer Manager State ---
        // The caller (API endpoint) should manage the initial state and tracks
        // this.visualizerManager.resetState(); // Let caller handle reset before export

        console.log('ExportRenderer initialized successfully.');
    }

    // --- Setup Post-Processing Passes --- (Separated for clarity)
    private setupPostProcessingPasses(bloomParamsInput?: { strength: number; threshold: number; radius: number }): void {
        // Default params based on VisualizerView.tsx
        const defaultBloomParams = { strength: 1.0, threshold: 0.1, radius: 0.2 };
        const bloomParams = { ...defaultBloomParams, ...bloomParamsInput }; // Merge defaults with input

        // Clear existing passes
        this.composer.passes = [];

        // 1. Render Pass
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // 2. Bloom Pass (using UnrealBloomPass)
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.options.width, this.options.height),
            bloomParams.strength, bloomParams.radius, bloomParams.threshold
        );
        this.composer.addPass(this.bloomPass);
        console.log('Bloom Pass added:', bloomParams);

        // 3. Output Pass (ensures correct output format/colorspace)
        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);

        console.log('Post-processing passes configured.');
    }

    // --- Scene Update Logic with Caching ---
    private updateSceneFromVisualObjects(): void {
        const visualObjects = this.visualizerManager.getVisualObjects();
        const currentObjectIds = new Set<string>(visualObjects.map(obj => obj.id));

        // --- Add/Update Objects --- 
        for (const objData of visualObjects) {
            let mesh = this.objectCache.get(objData.id);
            let material: THREE.MeshStandardMaterial;

            if (!mesh) {
                // --- Create New Mesh ---
                let geometry = this.geometryCache.get(objData.type);
                if (!geometry) {
                    geometry = objData.type === 'sphere'
                        ? new THREE.SphereGeometry(0.5, 32, 32) // Base radius 0.5
                        : new THREE.BoxGeometry(1, 1, 1); // Default to unit cube
                    this.geometryCache.set(objData.type, geometry);
                }

                // --- Create or Get Cached Material ---
                const isTransparent = (objData.opacity ?? 1.0) < 1.0;
                const emissiveColor = objData.emissive ?? objData.color ?? '#ffffff';
                const emissiveIntensity = objData.emissiveIntensity ?? 0;
                const materialKey = `std_${objData.color}_${objData.opacity}_${emissiveColor}_${emissiveIntensity}_${isTransparent}`;
                
                let cachedMaterial = this.materialCache.get(materialKey) as THREE.MeshStandardMaterial;
                if (!cachedMaterial) {
                    cachedMaterial = new THREE.MeshStandardMaterial({
                        color: objData.color ?? '#ffffff',
                        opacity: objData.opacity ?? 1.0,
                        transparent: isTransparent,
                        depthWrite: !isTransparent,
                        emissive: emissiveColor,
                        emissiveIntensity: emissiveIntensity,
                        toneMapped: false, // Crucial for bloom
                    });
                    this.materialCache.set(materialKey, cachedMaterial);
                }
                material = cachedMaterial;

                // Create mesh and add to scene/cache
                mesh = new THREE.Mesh(geometry, material);
                mesh.name = objData.id; // For debugging
                this.scene.add(mesh);
                this.objectCache.set(objData.id, mesh);
            } else {
                 // --- Update Existing Mesh ---
                 material = mesh.material as THREE.MeshStandardMaterial;
                 // Only update properties if they differ (check cache key logic if issues)
            }
            
            // Update transforms regardless of cache hit
            mesh.position.set(...objData.position);
            mesh.rotation.set(...objData.rotation);
            mesh.scale.set(...objData.scale);
            mesh.visible = true; // Ensure visibility
        }

        // --- Hide or Remove Stale Objects --- 
        for (const [id, mesh] of this.objectCache.entries()) {
            if (!currentObjectIds.has(id)) {
                // Option 1: Hide (faster if objects reappear frequently)
                mesh.visible = false; 
                // Option 2: Remove (better memory if objects are unique per frame)
                // this.scene.remove(mesh);
                // this.objectCache.delete(id);
                // Consider geometry/material disposal if removing completely
            }
        }
    }

    // --- Frame Rendering Logic ---
    private renderFrame(beat: number): Uint8Array {
        // 1. Update time
        this.timeManager.seekTo(beat);

        // 2. Update scene contents
        this.updateSceneFromVisualObjects();

        // 3. Render using EffectComposer
        this.composer.render();

        // 4. Read pixels from the composer's output buffer
        const buffer = new Uint8Array(this.options.width * this.options.height * 4);
        this.renderer.readRenderTargetPixels(
            this.composer.readBuffer,
            0, 0, this.options.width, this.options.height,
            buffer
        );
        
        // 5. Flip the buffer vertically for ffmpeg
        const flippedBuffer = flipBufferVertically(buffer, this.options.width, this.options.height);

        return flippedBuffer;
    }

    // --- Main Export Function --- (Now includes ffmpeg logic)
    public async export(durationSeconds: number, onProgress: OnProgressCallback): Promise<void> {
        const { width, height, fps, outputFilename } = this.options;
        const totalFrames = Math.floor(durationSeconds * fps);
        const timeStep = 1 / fps; // Time increment per frame in seconds

        console.log(`Starting export: ${totalFrames} frames (${durationSeconds}s @ ${fps}fps) to ${outputFilename}`);
        onProgress({ percent: 0, message: `Starting export: ${totalFrames} frames...` });

        // --- Setup ffmpeg Process --- 
        const ffmpegPath = this.options.ffmpegPath || 'ffmpeg';
        const ffmpegArgs = [
             '-y', // Overwrite output file without asking
             '-f', 'rawvideo', // Input format: raw video data
             '-vcodec', 'rawvideo',
             '-s', `${width}x${height}`, // Input frame size
             '-pix_fmt', 'rgba', // Input pixel format (from WebGL readPixels)
             '-r', String(fps), // Input frame rate
             '-i', '-', // Input comes from stdin
             // Output options - H.264 MP4
             '-c:v', 'libx264', // Video codec: H.264
             '-preset', 'medium', // Encoding speed/quality preset (e.g., ultrafast, fast, medium, slow)
             '-crf', '23', // Constant Rate Factor (quality, lower is better, 18-28 reasonable range)
             '-pix_fmt', 'yuv420p', // Output pixel format for broad compatibility
             outputFilename
         ];

        console.log(`Spawning ffmpeg: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);
        let ffmpeg;
        try {
            ffmpeg = spawn(ffmpegPath, ffmpegArgs);
        } catch (err) {
            console.error(`Failed to spawn ffmpeg at path: ${ffmpegPath}`, err);
            throw new Error(`ffmpeg not found or failed to start. Is it installed and in PATH? Path used: ${ffmpegPath}`);
        }
        
        const ffmpegStdin = ffmpeg.stdin as Writable;
        let ffmpegClosed: Promise<number | null>;
        let ffmpegErrorOutput = '';

        // Capture stderr for debugging
        ffmpeg.stderr.on('data', (data) => {
            const message = data.toString();
            ffmpegErrorOutput += message;
            // console.error(`ffmpeg stderr: ${message}`); // Log verbose ffmpeg output
        });

        // Promise to track when ffmpeg finishes
        ffmpegClosed = new Promise((resolve, reject) => {
            ffmpeg.on('close', (code) => {
                console.log(`ffmpeg process exited with code ${code}`);
                if (code === 0) {
                    resolve(code);
                } else {
                    // Include stderr in the rejection error
                    reject(new Error(`ffmpeg process exited with error code ${code}. Stderr:\n${ffmpegErrorOutput}`));
                }
            });
            ffmpeg.on('error', (err) => {
                console.error('ffmpeg process error event:', err);
                reject(new Error(`ffmpeg process error: ${err.message}`));
            });
        });

        try {
            // --- Frame-by-Frame Rendering Loop ---
            console.log('Starting frame rendering loop...');
            for (let frame = 0; frame < totalFrames; frame++) {
                const currentTime = frame * timeStep;
                const currentBeat = this.timeManager.timeToBeat(currentTime);

                // Render the frame
                const pixelBuffer = this.renderFrame(currentBeat); // Uint8Array (RGBA)

                // Convert to Node Buffer and write to ffmpeg stdin
                const frameBuffer = Buffer.from(pixelBuffer);
                
                // Handle backpressure: wait if ffmpeg's buffer is full
                if (!ffmpegStdin.write(frameBuffer)) {
                    await new Promise(resolve => ffmpegStdin.once('drain', resolve));
                }

                // Update progress (less frequently)
                if ((frame + 1) % Math.max(1, Math.floor(fps / 5)) === 0 || frame === totalFrames - 1) {
                    const percentComplete = ((frame + 1) / totalFrames) * 100;
                    onProgress({
                        percent: parseFloat(percentComplete.toFixed(1)),
                        message: `Rendering frame ${frame + 1} of ${totalFrames}`
                    });
                }
                
                // Yield to event loop occasionally to prevent blocking (optional)
                // if (frame % 100 === 0) {
                //     await new Promise(resolve => setImmediate(resolve));
                // }
            }
            console.log('Frame rendering loop finished.');

            // --- Finish ffmpeg ---
            console.log('Closing ffmpeg stdin...');
            ffmpegStdin.end();

            onProgress({ percent: 99, message: "Encoding video file..." });
            
            // Wait for ffmpeg to finish processing
            await ffmpegClosed;

            console.log(`Export successfully completed: ${outputFilename}`);
            onProgress({ percent: 100, message: `Export complete: ${outputFilename}` });

        } catch (error) {
            console.error('Error during export render loop or ffmpeg processing:', error);
            // Ensure ffmpeg is terminated if an error occurs mid-stream
            if (ffmpeg && !ffmpeg.killed) {
                console.log('Terminating ffmpeg process due to error...');
                ffmpeg.kill('SIGKILL');
            }
            // Rethrow or handle the error appropriately (e.g., send error message via WebSocket)
            throw error; // Propagate error
        } finally {
            // --- Cleanup --- (Optional: Depends on context reuse)
            this.dispose(); // Call cleanup method
        }
    }

    // --- Cleanup Method ---
    public dispose(): void {
        console.log('Disposing ExportRenderer resources...');
        try {
            this.renderer.dispose();
            this.renderTarget.dispose();
            // Composer doesn't have a direct dispose, rely on render target disposal
            this.objectCache.forEach(mesh => {
                if (mesh.parent) mesh.parent.remove(mesh);
                // Don't dispose cached geometry/material here, they might be shared
            });
            this.geometryCache.forEach(geometry => geometry.dispose());
            this.materialCache.forEach(material => material.dispose());
            this.objectCache.clear();
            this.geometryCache.clear();
            this.materialCache.clear();
            // Requires node-webgl or similar fork for destroy() method
            // if (typeof (this.glContext as any).destroy === 'function') {
            //     (this.glContext as any).destroy();
            // }
            console.log('ExportRenderer disposed.');
        } catch (err) {
            console.error('Error during ExportRenderer disposal:', err);
        }
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