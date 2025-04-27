import * as THREE from 'three';
// Remove the incorrect import below - ExportSettings is defined in this file now
// import type { ExportSettings } from '../components/ExportView'; 
import type { ExportSliceActions } from '../store/exportSlice'; // Adjust path if needed
import type TimeManager from './TimeManager'; // Adjust path if needed

// Attempt to declare CCapture globally.
// This assumes CCapture.js is loaded via a script tag or similar mechanism.
// If using an npm package like 'ccapture.js-npmbuild', you might import it instead:
// import CCapture from 'ccapture.js-npmbuild';
declare const CCapture: any;

// --- Export Settings Interface ---
// Moved here and exported so ExportView can import it
export interface ExportSettings {
    resolution: string; // e.g., "1080p"
    fps: "30" | "60";
    audioFormat: "mp3" | "wav"; // Still included, though not used for video encoding yet
}

// Interface for the dependencies required by the renderer
export interface ExportRendererDeps {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  canvas: HTMLCanvasElement; // The actual canvas element
  timeManager: TimeManager;
  invalidate: () => void;
  settings: ExportSettings; // Uses the exported type
  actions: Pick<ExportSliceActions, 'updateExportProgress' | 'finishExport' | 'failExport' | 'setCancelExportFn'>;
}

export class ExportRenderer {
  private deps: ExportRendererDeps;
  private capturer: any = null; // CCapture instance
  private isRunning: boolean = false;
  private frameCount: number = 0;
  private totalFrames: number = 0;
  private abortController: AbortController | null = null;

  constructor(dependencies: ExportRendererDeps) {
    if (!dependencies.canvas) {
      throw new Error("ExportRenderer requires a valid canvas element dependency.");
    }
    this.deps = dependencies;
  }

  /**
   * Starts the frame capture and rendering process.
   * Returns a promise that resolves or rejects based on the export outcome.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Export is already running.');
      return Promise.resolve(); // Indicate immediate completion if already running
    }
    if (typeof CCapture === 'undefined') {
      const errorMsg = 'CCapture library not found. Ensure it is loaded (e.g., via script tag in public/index.html).';
      this.deps.actions.failExport(errorMsg);
      return Promise.reject(new Error(errorMsg)); // Reject the start promise
    }

    this.isRunning = true;
    this.frameCount = 0;
    this.abortController = new AbortController(); // Create a new controller for this run
    const { settings, actions } = this.deps;

    // --- Configuration ---
    const exportDurationSeconds = 5; // Hardcoded 5 seconds for now
    const fps = parseInt(settings.fps, 10);
    this.totalFrames = Math.floor(exportDurationSeconds * fps);

    // Register the cancel function with the store
    actions.setCancelExportFn(() => this.cancel());

    console.log(`Starting export: ${this.totalFrames} frames, ${fps} FPS, duration ${exportDurationSeconds}s`);

    return new Promise(async (resolve, reject) => {
        try {
            this.capturer = new CCapture({
              format: 'webm', // Output format (webm is good for browser, no external encoder needed)
              // format: 'png', // Use 'png' to output individual frames
              framerate: fps,
              verbose: false, // Set true for more console logs from CCapture
              display: false, // Don't show CCapture's own progress display
              name: `cabin-visuals-export-${Date.now()}`, // Filename base
              timeLimit: exportDurationSeconds, // Max duration (redundant with frame limit but good practice)
              autoSaveTime: 0, // Disable auto-saving during capture
            });

            this.capturer.start(); // Initialize CCapture
            await this.renderFrameLoop(); // Execute the frame-by-frame rendering

            // If loop completes without being cancelled or throwing error:
            if (this.isRunning) {
              console.log("Frame loop completed successfully. Stopping CCapture...");
              this.capturer.stop(); // Finalize the capture process
              console.log("Saving captured file...");
              this.capturer.save(); // Trigger the download prompt
              actions.finishExport(); // Update store state to finished
              resolve(); // Resolve the start() promise
            } else {
                 // This case means it was cancelled, cancellation handled in cancel()/loop
                 console.log("Export was cancelled before completion.");
                 // failExport or similar should have been called already by cancel() or the loop check
                 resolve(); // Resolve anyway, as cancellation isn't an unexpected error
            }
            // Ensure live view updates after export finishes
            this.deps.invalidate();

        } catch (error: any) {
            console.error("Error during export process:", error);
            // Ensure failExport is called if an error is caught here
            if (this.isRunning) { // Avoid double-calling if cancel already called failExport
                 actions.failExport(error?.message || 'Unknown error during capture process.');
            }
            this.cleanup(); // Perform cleanup actions
            reject(error); // Reject the start() promise
        } finally {
            this.isRunning = false; // Ensure running state is reset
            // Ensure the cancel function is cleared from the store if it hasn't been already
            actions.setCancelExportFn(null);
            // Ensure clock restarts via VisualizerView's useEffect reacting to isExporting=false
            // And trigger one more invalidate for safety
            this.deps.invalidate();
        }
    });
  }

  /**
   * The core loop that steps through time, renders, and captures each frame.
   */
  private async renderFrameLoop(): Promise<void> {
    const { gl, scene, camera, canvas, timeManager, invalidate, settings, actions } = this.deps;
    const fps = parseInt(settings.fps, 10);

    console.log("Starting render frame loop...");

    for (let i = 0; i < this.totalFrames; i++) {
        // Check for cancellation signal at the beginning of each frame
        if (this.abortController?.signal.aborted) {
            console.log(`Cancellation detected at frame ${i}. Aborting loop.`);
            this.cleanup(); // Perform cleanup actions
            // Don't call failExport here, the cancel() action handles the state update
            throw new Error("Export cancelled by user."); // Throw to stop the process
        }

        const currentTime = i / fps;
        // Progress based on frame number (0.0 to 1.0)
        const progress = (i + 1) / this.totalFrames;

        try {
            // 1. Set Time: Use seekTo with calculated beat
            const currentBeat = timeManager.timeToBeat(currentTime);
            timeManager.seekTo(currentBeat);

            // 2. Invalidate: Request R3F to re-render the scene with the new time
            invalidate();

            // 3. Yield/Wait: Let the browser process the invalidate and render the frame
            // Using requestAnimationFrame is generally the most reliable way.
            await new Promise(resolve => requestAnimationFrame(resolve));
            // Optional small delay if rAF isn't enough? (Unlikely needed, can cause issues)
            // await new Promise(resolve => setTimeout(resolve, 5));

            // 4. Capture: Read the newly rendered frame from the canvas
            // CCapture's capture can be async depending on format/internal workers
            await this.capturer.capture(canvas);

            // 5. Update Progress: Inform the UI about the progress
            this.frameCount = i + 1;
            actions.updateExportProgress(progress, `Rendering frame ${this.frameCount}/${this.totalFrames}`);

        } catch (error: any) {
            console.error(`Error during frame ${i} processing (Time: ${currentTime.toFixed(3)}s):`, error);
            // Stop the export process immediately on frame error
            throw new Error(`Failed at frame ${i}: ${error.message || 'Unknown frame error'}`);
        }

        // 6. Optional Yield: Give browser a tiny breather (can sometimes help responsiveness)
        // await new Promise(resolve => setTimeout(resolve, 0));
    }
    console.log("Render frame loop finished.");
  }

  /**
   * Signals the export process to stop.
   */
  cancel(): void {
    if (this.isRunning && this.abortController && !this.abortController.signal.aborted) {
      console.log('Cancellation signal sent to ExportRenderer.');
      this.abortController.abort(); // Signal the loop to stop
      // The loop/start method will detect the signal and handle cleanup/state.
      // The cancelExport action in the store handles the immediate UI state update.
    } else {
        console.log('Cancel called but export not running or already aborted.');
    }
  }

  /**
   * Cleans up resources like the CCapture instance.
   */
  private cleanup(): void {
      console.log("Running ExportRenderer cleanup...");
      if (this.capturer) {
          try {
              // Attempt to stop; may error if already stopped/failed, which is fine.
              this.capturer.stop();
          } catch (e) {
              // console.warn("Ignoring error during capturer.stop() in cleanup:", e);
          }
          this.capturer = null; // Release reference
      }
      // Abort controller is handled by its signal
      this.isRunning = false; // Explicitly mark as not running
  }
} 