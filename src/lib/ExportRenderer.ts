import * as THREE from 'three';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { ExportSliceActions } from '../store/exportSlice'; // Adjust path if needed
import type TimeManager from './TimeManager'; // Adjust path if needed

// Remove CCapture declaration
// declare const CCapture: any;

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
  actions: Pick<ExportSliceActions, 'updateExportProgress' | 'finishExport' | 'failExport' | 'setCancelExportFn' | 'setEncoderLoading'>;
}

export class ExportRenderer {
  private deps: ExportRendererDeps;
  // Replace capturer with ffmpeg instance
  // private capturer: any = null; 
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
    const { settings, actions } = this.deps;
    const exportDurationSeconds = 5; 
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
            
            // --- FFmpeg Encoding --- 
            // Update progress manually before starting exec
            actions.updateExportProgress(0.5, "Encoding video...");

            // Remove setProgress - it's likely gone
            // ffmpeg.setProgress(({ ratio }: { ratio: number }) => { 
            //    const encodingProgress = 0.5 + (ratio * 0.5);
            //    actions.updateExportProgress(encodingProgress, `Encoding... ${Math.round(ratio * 100)}%`);
            // });

            console.log("Running FFmpeg command...");
            const outputFilename = 'output.mp4';
            const args = [
                '-framerate', `${fps}`,
                '-i', 'frame-%05d.png',
                '-map', '0:v:0', 
                '-c:v', 'libx264', 
                '-pix_fmt', 'yuv420p',
                '-preset', 'ultrafast', 
                '-crf', '23', 
                '-movflags', '+faststart',
                outputFilename
            ];
            // Use ffmpeg.exec() instead of run()
            await ffmpeg.exec(args);
            console.log("FFmpeg command finished.");
            // ffmpeg.setProgress(() => {}); // Remove clear progress

            actions.updateExportProgress(0.99, "Finalizing video..."); 

            const data = await ffmpeg.readFile(outputFilename);
            // Create Blob directly from the Uint8Array
            if (data instanceof Uint8Array) {
                const blob = new Blob([data], { type: 'video/mp4' }); 
                const blobUrl = URL.createObjectURL(blob);
                console.log(`Video processed: ${outputFilename}, Size: ${blob.size} bytes`);
                actions.finishExport(blobUrl); 
                this.triggerDownload(blobUrl, `export-${Date.now()}.mp4`);
            } else {
                throw new Error("Failed to read processed video data from FFmpeg FS.");
            }
            resolve(); 
        } catch (error: any) { 
            console.error("Error during export process:", error);
            if (this.isRunning) { actions.failExport(error?.message || 'Unknown error'); }
            reject(error); 
        } finally { 
            this.isRunning = false;
            actions.setCancelExportFn(null);
            this.cleanupFFmpegFS(); 
            this.deps.invalidate(); 
        }
    });
  }

  /**
   * Loop to render and capture frames, writing them to FFmpeg's FS.
   */
  private async renderAndCaptureFrames(): Promise<void> {
    const ffmpeg = this.ffmpeg!;
    const { canvas, timeManager, invalidate, actions } = this.deps;
    const fps = parseInt(this.deps.settings.fps, 10);
    console.log("Starting render and capture frame loop...");

    for (let i = 0; i < this.totalFrames; i++) {
        if (this.abortController?.signal.aborted) return;
        const currentTime = i / fps;
        // Update progress for frame capture phase (0.0 to ~0.5)
        const captureProgress = (i + 1) / (this.totalFrames * 2); 
        try {
            const currentBeat = timeManager.timeToBeat(currentTime);
            timeManager.seekTo(currentBeat);
            invalidate();
            await new Promise(resolve => requestAnimationFrame(resolve));
            const frameDataUrl = canvas.toDataURL('image/png');
            const frameFilename = `frame-${String(i).padStart(5, '0')}.png`;
            
            // Use ffmpeg.writeFile() with data fetched using fetchFile from @ffmpeg/util
            await ffmpeg.writeFile(frameFilename, await fetchFile(frameDataUrl));

            this.frameCount = i + 1;
            actions.updateExportProgress(captureProgress, `Capturing frame ${this.frameCount}/${this.totalFrames}`);
        } catch (error: any) {
            console.error(`Error during frame ${i} capture:`, error);
            throw new Error(`Failed capturing frame ${i}: ${error.message || 'Unknown error'}`);
        }
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