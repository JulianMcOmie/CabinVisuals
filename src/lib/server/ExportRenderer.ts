// src/lib/server/ExportRenderer.ts 
// (Conceptual - Requires Node.js environment and dependencies)

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'; // Needed for correct colorspace
// --- Potentially needed for R3F/postprocessing Bloom equivalence: ---
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'; 

import VisualizerManager, { VisualObject3D } from '../VisualizerManager';
import TimeManager from '../TimeManager';
// @ts-ignore - No types available for 'gl'
import GL from 'gl'; // Headless GL context
import NodeTimeManager from './NodeTimeManager'; // Assuming this path
import { spawn } from 'child_process'; // For ffmpeg
import { Writable } from 'stream';    // For ffmpeg stream
// const createGLContext = require('gl'); // Example headless GL

// --- Configuration ---
interface ExportOptions {
    // Direct rendering options
    width: number;
    height: number;
    fps: number;
    durationSeconds: number; // Total duration to export
    outputFilename: string; // Where to save the file
    
    // Project-specific data (passed to managers)
    projectData: {
        bpm: number;
        tracks: any[]; // Use actual Track type if available
        // Add other relevant project settings here if needed
    };
    
    // Optional features/configs
    bloomParams?: { strength: number; threshold: number; radius: number }; 
    ffmpegPath?: string; // Optional path to ffmpeg executable
    
    // Remove duplicated/misplaced fields:
    // startTimeSeconds: number; // Should be implicit (0) or part of projectData if needed
    // endTimeSeconds: number;   // Use durationSeconds instead
    // bpm: number;            // Moved inside projectData
    // tracks: any[];          // Moved inside projectData
    // bloomIntensity?: number; // Use bloomParams structure
    // bloomThreshold?: number;// Use bloomParams structure
    // bloomSmoothing?: number;// Use bloomParams structure
}

interface ProgressUpdate {
    percent: number;
    message: string;
}

type OnProgressCallback = (update: ProgressUpdate) => void;

class ExportRenderer {
    private width: number; // Store width/height directly
    private height: number;
    private timeManager: NodeTimeManager; // Use NodeTimeManager
    private visualizerManager: VisualizerManager;
    // private options: ExportOptions; // Remove this.options dependency

    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    private renderTarget: THREE.WebGLRenderTarget;
    private glContext: any; // Use any for gl context as type is ignored
    private bloomPass?: UnrealBloomPass;

    // Caches
    private objectCache: Map<string, THREE.Mesh> = new Map();
    private materialCache: Map<string, THREE.Material> = new Map();

    // Corrected Constructor Signature
    constructor(width: number, height: number, timeManager: NodeTimeManager, visualizerManager: VisualizerManager) {
        this.width = width; // Assign from params
        this.height = height;
        this.timeManager = timeManager; // Assign from params (NodeTimeManager)
        this.visualizerManager = visualizerManager; // Assign from params

        // --- Initialize Three.js Scene ---
        this.scene = new THREE.Scene();
        // Use this.width / this.height
        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.camera.position.set(0, 0, 15);

        // --- Setup Headless WebGL & Renderer ---
        // Use this.width, this.height
        this.glContext = GL(this.width, this.height, { preserveDrawingBuffer: true });
        this.renderer = new THREE.WebGLRenderer({
            context: this.glContext,
            antialias: true,
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(1);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // --- Render Target for Composer ---
        // Use this.width, this.height
        this.renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
            depthBuffer: true,
            stencilBuffer: false,
        });

        // --- Add Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 10, 5);
        this.scene.add(directionalLight);

        // --- Setup EffectComposer (passes added later) ---
        this.composer = new EffectComposer(this.renderer, this.renderTarget);
        this.composer.setSize(this.width, this.height);

        // Remove initialization based on this.options from constructor
        // this.timeManager.setBPM(this.options.bpm);
        // this.visualizerManager.setTracks(this.options.tracks);
        // this.visualizerManager.resetState(); 
        console.log('ExportRenderer initialized.');
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

    // --- Post-Processing Setup ---
    // Use this.width, this.height passed in constructor
    private setupPostProcessing(bloomParamsInput?: { strength: number; threshold: number; radius: number }): void {
        const defaultBloomParams = {
            strength: 1.0,
            threshold: 0.1,
            radius: 0.2
        };
        const bloomParams = { ...defaultBloomParams, ...bloomParamsInput };

        this.composer.passes = []; // Clear existing passes

        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Use this.width, this.height for bloom pass size
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.width, this.height),
            bloomParams.strength,
            bloomParams.radius,
            bloomParams.threshold
        );
        this.composer.addPass(this.bloomPass);
        console.log('Bloom Pass added:', bloomParams);

        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);

        console.log('Post-processing setup complete.');
    }

    // --- Frame Rendering Logic ---
    // Use this.width, this.height from constructor
    private renderFrame(beat: number): Uint8Array {
        this.timeManager.seekTo(beat);
        this.updateSceneFromVisualObjects(this.visualizerManager.getVisualObjects());
        this.composer.render();

        const buffer = new Uint8Array(this.width * this.height * 4);
        this.renderer.readRenderTargetPixels(
            this.composer.readBuffer, 0, 0, this.width, this.height, buffer
        );

        // Potential buffer flipping logic remains here

        return buffer;
    }

    // Corrected Export Method Signature
    public async export(options: ExportOptions, onProgress: OnProgressCallback): Promise<void> {
        // Destructure options passed to this method
        const { width, height, fps, durationSeconds, outputFilename, projectData, bloomParams, ffmpegPath = 'ffmpeg' } = options;
        
        // Use width/height from options for validation/ffmpeg, not constructor ones directly here
        if (width !== this.width || height !== this.height) {
             console.warn('Export dimensions differ from ExportRenderer constructor - using export dimensions.');
             // Note: Renderer is already configured with constructor dimensions.
             // Reconfiguration would be complex. Proceeding with mismatched dimensions might cause issues.
             // Consider throwing an error or ensuring dimensions match before calling.
        }
        
        console.log(`Starting export: ${width}x${height}@${fps}fps, Duration: ${durationSeconds}s`);
        onProgress({ percent: 0, message: "Initializing export..." });

        // --- Initialize Managers based on projectData from options ---
        if (projectData?.bpm) {
            this.timeManager.setBPM(projectData.bpm);
            console.log(`Set BPM to ${projectData.bpm}`);
        }
        // Cast needed here if VisualizerManager expects TimeManager
        this.visualizerManager.setTracks(projectData.tracks);
        this.visualizerManager.resetState();

        // Setup post-processing based on options
        this.setupPostProcessing(bloomParams);

        // --- Prepare for Frame-by-Frame Rendering ---
        const totalFrames = Math.floor(durationSeconds * fps);
        const timeStep = 1 / fps;
        console.log(`Total frames to render: ${totalFrames}`);

        // --- Setup ffmpeg ---
        const ffmpegArgs = [
             '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo',
             '-s', `${width}x${height}`, // Use dimensions from options
             '-pix_fmt', 'rgba', '-r', String(fps), '-i', '-',
             // '-vf', 'vflip', // Optional flip
             '-vcodec', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
             outputFilename
         ];
         // ... (ffmpeg spawning logic remains the same) ...
         
         // --- Frame loop & cleanup logic remains the same --- 
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