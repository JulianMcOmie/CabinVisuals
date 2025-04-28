import * as THREE from 'three';
import { FFmpeg, type ProgressEventCallback } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { ExportSliceActions } from '../store/exportSlice'; // Adjust path if needed
import type TimeManager from './TimeManager'; // Adjust path if needed
import type { EffectComposer as PostProcessingEffectComposer } from 'postprocessing'; // Import type if needed, or just use Function

// Remove CCapture declaration
// declare const CCapture: any;

// --- Export Settings Interface ---
// Moved here and exported so ExportView can import it
export interface ExportSettings {
    resolution: string; // e.g., "1080p"
    fps: "30" | "60";
    audioFormat: "mp3" | "wav"; // Still included, though not used for video encoding yet
}

// Define the dependencies including the new callback
export interface ExportRendererDeps {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  canvas: HTMLCanvasElement; // The actual canvas element
  timeManager: TimeManager;
  invalidate: () => void;
  settings: ExportSettings; // Uses the exported type
  actions: Pick<ExportSliceActions, 'updateExportProgress' | 'finishExport' | 'failExport' | 'setCancelExportFn' | 'setEncoderLoading'>;
  resizeComposer: (width: number, height: number) => void; // Add the new dependency
}

// Add a helper function to parse resolution strings (can be outside the class or static)
function parseResolution(resolution: string): { width: number; height: number } {
    switch (resolution) {
        case '480p': return { width: 854, height: 480 };
        case '720p': return { width: 1280, height: 720 };
        case '1080p': return { width: 1920, height: 1080 };
        case '1440p': return { width: 2560, height: 1440 };
        case '4K': return { width: 3840, height: 2160 };
        default:
            console.warn(`Unsupported resolution: ${resolution}, defaulting to 1080p`);
            return { width: 1920, height: 1080 }; // Default fallback
    }
}

export class ExportRenderer {
  private deps: ExportRendererDeps;
  private ffmpeg: FFmpeg | null = null;
  private isEncoderLoaded: boolean = false; // Track loading state explicitly
  private isRunning: boolean = false;
  private frameCount: number = 0;
  private totalFrames: number = 0;
  private abortController: AbortController | null = null;

  constructor(dependencies: ExportRendererDeps) {
    if (!dependencies.canvas) {
      throw new Error("ExportRenderer requires a valid canvas element dependency.");
    }
    // Check for the new dependency
    if (typeof dependencies.resizeComposer !== 'function') {
        throw new Error("ExportRenderer requires a valid resizeComposer function dependency.");
    }
    this.deps = dependencies;
  }

  // --- FFmpeg Initialization (can be called separately or within start) ---
  /**
   * Loads the FFmpeg library. This can be slow and should ideally be 
   * triggered before the user clicks the final Export button.
   */
  async loadEncoder(): Promise<boolean> {
    if (this.isEncoderLoaded) return true;
    this.deps.actions.setEncoderLoading(true);
    try {
      if (!this.ffmpeg) { 
        console.log('Creating FFmpeg instance...');
        // Use new FFmpeg() constructor
        this.ffmpeg = new FFmpeg(); 
      }
      console.log('Loading FFmpeg core...');
      // Add corePath if necessary, pointing to where ffmpeg-core.js is served from (e.g., /public)
      // await this.ffmpeg.load({ coreURL: '/ffmpeg-core.js' });
      await this.ffmpeg.load(); 
      this.isEncoderLoaded = true; 
      console.log('FFmpeg core loaded successfully.');
      this.deps.actions.setEncoderLoading(false);
      return true;
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
      this.deps.actions.failExport("Failed to load video encoder."); 
      this.deps.actions.setEncoderLoading(false);
      this.isEncoderLoaded = false; 
      this.ffmpeg = null; 
      return false;
    }
  }

  /**
   * Starts the frame capture and rendering process using FFmpeg.
   */
  async start(): Promise<void> {
    if (this.isRunning) return Promise.resolve();
    if (!this.isEncoderLoaded) {
        const loaded = await this.loadEncoder();
        if (!loaded) return Promise.reject(new Error("FFmpeg failed to load"));
    }
    const ffmpeg = this.ffmpeg!;
    this.isRunning = true;
    this.frameCount = 0;
    this.abortController = new AbortController();
    // Destructure resizeComposer from deps
    const { settings, actions, gl, camera, resizeComposer } = this.deps;

    // --- Store original state ---
    const originalSize = new THREE.Vector2();
    gl.getSize(originalSize);
    const originalPixelRatio = gl.getPixelRatio();
    let originalAspect: number | null = null;
    let perspectiveCamera: THREE.PerspectiveCamera | null = null;
    if (camera instanceof THREE.PerspectiveCamera) {
        perspectiveCamera = camera;
        originalAspect = perspectiveCamera.aspect;
        console.log(`Original Renderer Size: ${originalSize.x}x${originalSize.y}, PixelRatio: ${originalPixelRatio}, Aspect: ${originalAspect}`);
    } else {
         console.log(`Original Renderer Size: ${originalSize.x}x${originalSize.y}, PixelRatio: ${originalPixelRatio}. Camera is not PerspectiveCamera.`);
         console.warn("Camera is not a PerspectiveCamera. Aspect ratio cannot be stored or updated, output might be distorted.");
    }

    // --- Prepare for export resolution ---
    // const { width: targetWidth, height: targetHeight } = parseResolution(settings.resolution);
    // console.log(`Setting export resolution: ${targetWidth}x${targetHeight}`);
    let targetWidth = 4096;
    let targetHeight = 2160;
    // Set export size and update camera BEFORE the try block or frame loop
    gl.setPixelRatio(1); // Use pixel ratio 1 for exact resolution
    gl.setSize(targetWidth, targetHeight, false); // false = don't update style
    if (perspectiveCamera) {
        perspectiveCamera.aspect = targetWidth / targetHeight;
        perspectiveCamera.updateProjectionMatrix();
        console.log(`Updated camera aspect for export: ${perspectiveCamera.aspect}`);
    }
    
    // !!! Resize the composer !!!
    console.log("Resizing composer for export dimensions...");
    resizeComposer(targetWidth, targetHeight);

    const exportDurationSeconds = 0.5;
    const fps = parseInt(settings.fps, 10);
    this.totalFrames = Math.floor(exportDurationSeconds * fps);
    actions.setCancelExportFn(() => this.cancel());
    actions.updateExportProgress(0, "Preparing frames...");
    console.log(`Starting export: ${this.totalFrames} frames, ${fps} FPS, duration ${exportDurationSeconds}s`);

    return new Promise(async (resolve, reject) => {
        try {
            this.cleanupFFmpegFS(true);
            await this.renderAndCaptureFrames();
            if (this.abortController?.signal.aborted) throw new Error("Cancelled");

            // --- DEBUG: Check if frame files exist before encoding ---
            try {
                const files = await ffmpeg.listDir('/');
                const frameFiles = files.filter(f => f.name.startsWith('frame-') && !f.isDir);
                console.log(`DEBUG: Found ${frameFiles.length} frame files in FS before encoding. First few:`, frameFiles.slice(0, 5).map(f => f.name));
                if (frameFiles.length !== this.totalFrames) {
                    console.warn(`DEBUG: Mismatch between expected frames (${this.totalFrames}) and found files (${frameFiles.length})`);
                }
            } catch (e) {
                console.error("DEBUG: Error listing directory before encoding:", e);
            }
            // --- End Debug ---
            
            actions.updateExportProgress(0.5, "Encoding video...");
            console.log("Starting FFmpeg encoding process..."); // Log start

            const outputFilename = 'output.mp4';
            const args = [
                '-framerate', `${fps}`,
                '-i', 'frame-%05d.png',
                '-map', '0:v:0',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-preset', 'medium',
                '-crf', '15',
                '-movflags', '+faststart',
                outputFilename
            ];

            console.log("Executing FFmpeg command:", args); // Keep this log
            try {
                // Add the progress callback to ffmpeg.exec
                ffmpeg.on('progress', (event: { progress: number; time?: number }) => {
                    // The frame capture stage accounts for the first 50% (0.0 to 0.5)
                    // The encoding stage accounts for the second 50% (0.5 to 1.0)
                    const encodingProgress = event.progress; // 0.0 to 1.0
                    const overallProgress = 0.5 + (encodingProgress * 0.5); // Map to 0.5 - 1.0
                    
                    // Prevent progress going slightly over 1 due to floating point math
                    const clampedProgress = Math.min(overallProgress, 0.99); 

                    actions.updateExportProgress(
                        clampedProgress, 
                        `Encoding video... ${(encodingProgress * 100).toFixed(0)}%`
                    );
                });

                await ffmpeg.exec(args);
                console.log("FFmpeg command finished execution successfully."); // Log success
            } catch (execError) {
                console.error("FFmpeg command failed execution:", execError); // Log specific exec error
                throw execError; // Re-throw to be caught by the outer catch
            }

            actions.updateExportProgress(0.99, "Finalizing video...");
            console.log("Attempting to read output file from FFmpeg FS:", outputFilename); // Log before read

            // --- DEBUG: Check if output file exists after encoding --- (Keep this block)
            try {
                const filesAfter = await ffmpeg.listDir('/');
                const outputFile = filesAfter.find(f => f.name === outputFilename && !f.isDir);
                console.log(`DEBUG: Output file '${outputFilename}' ${outputFile ? 'found' : 'NOT found'} in FS after encoding.`);
                if (!outputFile) {
                    console.error("DEBUG: output.mp4 was not created by FFmpeg.");
                    await new Promise(res => setTimeout(res, 100));
                    const filesLater = await ffmpeg.listDir('/');
                    console.log("DEBUG: Filesystem content after short delay:", filesLater);
                }
            } catch (e) {
                console.error("DEBUG: Error listing directory after encoding:", e);
            }
            // --- End Debug ---

            let rawData: unknown = null; // Read into an 'unknown' type first
            try {
                rawData = await ffmpeg.readFile(outputFilename);
                // Log the raw result details
                console.log(`Read ${outputFilename} from FFmpeg FS. Type: ${typeof rawData}, Potential Size: ${(rawData as any)?.byteLength ?? 'N/A'}`); 
            } catch (readError) {
                 console.error(`Failed to read ${outputFilename} from FFmpeg FS:`, readError); // Log specific read error
                 // Attempt to list files again for more context on read failure
                 try {
                     const files = await ffmpeg.listDir('/');
                     console.error("FFmpeg FS contents after failed read:", files);
                 } catch (listError) {
                    console.error("Could not list FFmpeg FS contents after failed read:", listError);
                 }
                 throw readError; // Re-throw
            }

            // Explicitly check if it's the type we expect
            if (rawData instanceof Uint8Array) {
                const data: Uint8Array = rawData; // Now assign to a correctly typed variable
                console.log(`Data confirmed as Uint8Array. Size: ${data.byteLength}`);

                if (data.byteLength > 0) { // Check size *after* confirming type
                    console.log("Creating Blob from video data..."); // Log before blob
                    const blob = new Blob([data], { type: 'video/mp4' });
                    console.log(`Blob created. Size: ${blob.size}, Type: ${blob.type}`); // Log blob info

                    // --- DEBUG: Check blob size --- (Keep this check)
                    if (blob.size === 0) {
                        console.error("DEBUG: Created Blob has size 0. Input data from readFile might be empty or invalid.");
                        // Consider throwing an error here if blob size 0 is always failure
                    }
                    // --- End Debug ---

                    const blobUrl = URL.createObjectURL(blob);
                    console.log("Created Blob URL:", blobUrl); // Log URL
                    actions.finishExport(blobUrl);
                    console.log("Triggering final video download..."); // Log before download
                    this.triggerDownload(blobUrl, `export-${Date.now()}.mp4`);
                    console.log("Final video download triggered."); // Log after download call
                } else {
                     // Handle empty Uint8Array case
                    console.error(`Failed to process video data. Read data is an empty Uint8Array.`);
                    throw new Error(`Read ${outputFilename} data from FFmpeg FS, but it was empty.`);
                }
            } else {
                 // Handle case where readFile returned something unexpected
                console.error(`Failed to process video data. Expected Uint8Array but received type: ${typeof rawData}`);
                throw new Error(`Failed to read ${outputFilename} data as Uint8Array from FFmpeg FS.`);
            }
            resolve();
        } catch (error: any) {
            // Enhanced error logging
            console.error("-----------------------------------------");
            console.error("Error during export process in 'start':", error);
            if (error && typeof error === 'object') { // Log properties if it's an object
                console.error("Error properties:", Object.keys(error).map(key => `${key}: ${error[key]}`));
            }
             console.error("Current state:", {
                 isRunning: this.isRunning,
                 frameCount: this.frameCount,
                 totalFrames: this.totalFrames,
                 isEncoderLoaded: this.isEncoderLoaded,
                 wasCancelled: this.abortController?.signal.aborted ?? false,
             });
            console.error("-----------------------------------------");

            if (this.isRunning && !(this.abortController?.signal.aborted)) { // Only fail if not cancelled
                actions.failExport(error?.message || 'Unknown error during encoding/finalizing');
            } else if (this.abortController?.signal.aborted) {
                console.log("Export process caught error, but was cancelled.");
                // Optionally call failExport with a specific "Cancelled" message if needed
                // actions.failExport("Export cancelled by user.");
            }
            reject(error);
        } finally {
            console.log("Export finished or failed. Restoring original state...");
            // --- Restore original state ---
            gl.setPixelRatio(originalPixelRatio);
            gl.setSize(originalSize.x, originalSize.y, false);
            if (perspectiveCamera && originalAspect !== null) {
                perspectiveCamera.aspect = originalAspect;
                perspectiveCamera.updateProjectionMatrix();
                console.log(`Restored camera aspect: ${perspectiveCamera.aspect}`);
            }
            
            // !!! Restore composer size !!!
            console.log("Restoring composer to original dimensions...");
            resizeComposer(originalSize.x, originalSize.y);

            this.isRunning = false;
            actions.setCancelExportFn(null);
            this.cleanupFFmpegFS();
            this.deps.invalidate(); // Invalidate one last time with restored settings
        }
    });
  }

  /**
   * Loop to render and capture frames, writing them to FFmpeg's FS.
   */
  private async renderAndCaptureFrames(): Promise<void> {
    const ffmpeg = this.ffmpeg!;
    const { canvas, timeManager, invalidate, actions, gl } = this.deps;
    const fps = parseInt(this.deps.settings.fps, 10);
    console.log("Starting render and capture frame loop...");

    // Store original clear settings
    const originalClearColor = new THREE.Color();
    gl.getClearColor(originalClearColor);
    const originalClearAlpha = gl.getClearAlpha();

    try {
      for (let i = 0; i < this.totalFrames; i++) {
          console.log(`Export Frame ${i} of ${this.totalFrames}`);
          if (this.abortController?.signal.aborted) {
            console.log("Export cancelled. Exiting frame loop.");
            return;
          }
          const currentTime = i / fps;
          const captureProgress = (i + 1) / (this.totalFrames * 2); 
          try {
              const currentBeat = timeManager.timeToBeat(currentTime);
              timeManager.seekTo(currentBeat);

              // --- Prepare canvas for opaque capture ---
              gl.setClearColor(0x000000, 1.0); // Set background to black, alpha to 1
              gl.clear(true, true, true); // Clear color, depth, and stencil buffers
              // --- End preparation ---
              
              invalidate(); // Render the scene onto the black background
              await new Promise(resolve => requestAnimationFrame(resolve)); // Wait for render
              
              // Capture as PNG (should now be opaque)
              const frameDataUrl = canvas.toDataURL('image/png'); 
              const frameFilename = `frame-${String(i).padStart(5, '0')}.png`;
              
              
              // --- DEBUG: Check frame data before writing ---
              if (!frameDataUrl || frameDataUrl === 'data:,') {
                  console.error(`DEBUG: Frame ${i}: Got empty data URL from canvas!`);
                  throw new Error(`Canvas returned empty data for frame ${i}`);
              }
              // console.log(`DEBUG: Frame ${i}: Data URL length: ${frameDataUrl.length}`); // Optional: Verbose, commented out
              // --- End Debug ---

              const frameData = await fetchFile(frameDataUrl);
              // --- DEBUG: Check fetched data size ---
              // console.log(`DEBUG: Frame ${i}: Fetched data size: ${frameData.byteLength}`); // Optional: Verbose, commented out
              // --- End Debug ---
              await ffmpeg.writeFile(frameFilename, frameData);

              // --- DEBUG: Confirm write by trying to read size (might fail/be slow) ---
              // try {
              //     const writtenFile = await ffmpeg.readFile(frameFilename);
              //     console.log(`DEBUG: Frame ${i}: Verified write, size: ${writtenFile.byteLength}`);
              // } catch(readErr) {
              //     console.error(`DEBUG: Frame ${i}: Failed to read back file after write!`, readErr);
              // }
              // --- End Debug ---

              this.frameCount = i + 1;
              actions.updateExportProgress(captureProgress, `Capturing frame ${this.frameCount}/${this.totalFrames}`);
          } catch (error: any) {
              console.error(`Error during frame ${i} capture:`, error);
              // Restore clear color even if a single frame fails
              gl.setClearColor(originalClearColor, originalClearAlpha);
              throw new Error(`Failed capturing frame ${i}: ${error.message || 'Unknown error'}`);
          }
      }
    } finally {
        // --- Restore original clear settings --- 
        console.log("Restoring original renderer clear color and alpha.");
        gl.setClearColor(originalClearColor, originalClearAlpha);
        // --- End restoration ---
    }
    console.log("Render and capture frame loop finished.");
  }
  
  /**
   * Triggers a browser download for the given blob URL.
   */
  private triggerDownload(blobUrl: string, filename: string): void {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.style.display = 'none';
      a.click();
      document.body.removeChild(a);
      // Note: Object URL should be revoked later (e.g., when dialog closes or new export starts)
      // The resetExportState in the slice now handles revocation.
  }

  /**
   * Signals the export process to stop via AbortController.
   */
  cancel(): void {
    if (this.isRunning && this.abortController && !this.abortController.signal.aborted) {
      console.log('Cancellation signal sent to ExportRenderer.');
      this.abortController.abort(); 
      // The loop/start method will detect the signal.
    } else {
        console.log('Cancel called but export not running or already aborted.');
    }
  }

  /**
   * Cleans up files from FFmpeg's virtual file system.
   */
  private async cleanupFFmpegFS(includeOutput: boolean = false): Promise<void> {
      if (!this.ffmpeg || !this.isEncoderLoaded) return; // Check if loaded
      const ffmpeg = this.ffmpeg;
      console.log("Running FFmpeg FS cleanup...", { includeOutput });
      try {
          // Use ffmpeg.listDir() 
          const files = await ffmpeg.listDir('/');
          for (const file of files) {
              if (file.isDir) continue; // Skip directories
              // Unlink frame files
              if (file.name.startsWith('frame-')) {
                   try { await ffmpeg.deleteFile(file.name); } catch {} 
              }
              // Optionally unlink output
              if (includeOutput && file.name === 'output.mp4') {
                   try { await ffmpeg.deleteFile(file.name); } catch {}
              }
          }
      } catch (error) {
          console.warn("Error during FFmpeg FS cleanup:", error);
      }
  }
  
  // Optional: Method to terminate the FFmpeg worker if needed (e.g., on component unmount)
  // terminate(): void {
  //     if (this.ffmpeg && this.ffmpeg.isLoaded()) {
  //         this.ffmpeg.exit(); // May not be necessary, depends on resource usage
  //         this.ffmpeg = null;
  //         console.log("FFmpeg terminated.");
  //     }
  // }
} 