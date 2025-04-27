import { StateCreator } from 'zustand';
import { ExportRenderer, ExportSettings } from '../lib/ExportRenderer';
import { AppState } from './store';

// --- State Definition ---
export interface ExportSliceState {
  isExporting: boolean;
  exportProgress: number;
  exportStatusMessage: string;
  exportError: string | null;
  cancelExportFn: (() => void) | null;
  exportResultUrl: string | null;
  isEncoderLoading: boolean;
}

// --- Actions Definition ---
export interface ExportSliceActions {
  startExport: (settings: ExportSettings, rendererInstance: ExportRenderer) => Promise<void>;
  updateExportProgress: (progress: number, message: string) => void;
  finishExport: (blobUrl: string) => void;
  failExport: (errorMessage: string) => void;
  setCancelExportFn: (fn: (() => void) | null) => void;
  cancelExport: () => void;
  resetExportState: () => void;
  setEncoderLoading: (isLoading: boolean) => void;
}

// --- Combined Slice Type ---
export type ExportSlice = ExportSliceState & ExportSliceActions;

// --- Initial State ---
const initialState: ExportSliceState = {
  isExporting: false,
  exportProgress: 0,
  exportStatusMessage: '',
  exportError: null,
  cancelExportFn: null,
  exportResultUrl: null,
  isEncoderLoading: false,
};

// --- Slice Creator ---
export const createExportSlice: StateCreator<
  AppState, // Type for the entire Zustand store
  [],       // Middleware (e.g., devtools, persist)
  [],       // Middleware
  ExportSlice // Return type of this slice creator
> = (set, get) => ({
  ...initialState,

  /**
   * Starts the export process managed by the provided ExportRenderer instance.
   */
  startExport: async (settings, rendererInstance) => {
    // Reset state, mark as exporting, but don't clear encoder loading status yet
    set(state => ({ 
        ...initialState, 
        isExporting: true, 
        exportStatusMessage: 'Initializing export...',
        isEncoderLoading: state.isEncoderLoading, // Preserve loading status
    }));
    console.log("Export slice: startExport action called.");
    try {
        // Delegate the actual export process to the renderer instance.
        // The renderer's start() method returns a promise that resolves on completion/cancel
        // or rejects on error. The renderer calls back actions like updateExportProgress.
        await rendererInstance.start();
        // If start() resolves without error, it means finishExport or similar was called by the renderer
        // or it was cancelled gracefully.
        console.log("Export slice: Renderer process finished (resolved/cancelled).");
    } catch (error: any) {
        // Catch errors originating from the renderer.start() call itself or unhandled rejections
        console.error("Export slice: Error caught during renderer.start():", error);
        // Ensure the state reflects failure if it wasn't already set by failExport action
        if (get().isExporting) { // Check if failExport wasn't already called by the renderer
             get().failExport(error.message || 'Unknown export error during start');
        }
    }
  },

  /**
   * Updates the progress and status message during export.
   * Typically called by the ExportRenderer.
   */
  updateExportProgress: (progress, message) => {
    set({ 
        exportProgress: Math.min(1, Math.max(0, progress)), // Clamp progress between 0 and 1
        exportStatusMessage: message 
    });
  },

  /**
   * Marks the export as successfully completed.
   * Typically called by the ExportRenderer after CCapture finishes.
   */
  finishExport: (blobUrl) => {
    console.log("Export slice: finishExport action called.");
    set({
      isExporting: false,
      exportProgress: 1, // Ensure progress is 100%
      exportStatusMessage: 'Export complete! Video ready.',
      exportError: null,
      cancelExportFn: null, // Clear cancel function
      exportResultUrl: blobUrl, // Store the generated URL
      isEncoderLoading: false, // Encoder is no longer needed
    });
  },

  /**
   * Marks the export as failed with an error message.
   * Can be called by the ExportRenderer or the startExport action.
   */
  failExport: (errorMessage) => {
    console.log(`Export slice: failExport action called with message: ${errorMessage}`);
    set({
      isExporting: false,
      exportError: errorMessage,
      exportStatusMessage: `Export failed: ${errorMessage}`,
      cancelExportFn: null, // Clear cancel function
      exportResultUrl: null, // Clear any potential URL on failure
      isEncoderLoading: false, // Ensure loading state is reset
    });
     // Optionally reset state fully after a delay
    // setTimeout(() => get().resetExportState(), 8000);
  },

  /**
   * Stores the function provided by ExportRenderer to trigger cancellation.
   */
  setCancelExportFn: (fn) => {
    set({ cancelExportFn: fn });
  },

  /**
   * Action called by the UI (e.g., Cancel button) to initiate cancellation.
   */
  cancelExport: () => {
    const cancelFn = get().cancelExportFn;
    if (cancelFn) {
        console.log("Export slice: cancelExport action called, triggering cancelFn.");
        cancelFn(); // Call the function stored from ExportRenderer
        set({ 
            isExporting: false, // Mark as not exporting immediately
            exportStatusMessage: 'Cancelling export...', 
            cancelExportFn: null, // Clear the function
            exportResultUrl: null,
            isEncoderLoading: false,
        });
    } else {
        console.warn("Export slice: cancelExport called but no cancel function is set.");
    }
  },

  /**
   * Resets the export state back to its initial default values.
   */
  resetExportState: () => {
    console.log("Export slice: resetExportState action called.");
    // Revoke previous object URL if it exists to prevent memory leaks
    const currentUrl = get().exportResultUrl;
    if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
    }
    set({ ...initialState }); // Reset to initial state
  },

  // Action to update encoder loading status
  setEncoderLoading: (isLoading: boolean) => {
      set({ 
          isEncoderLoading: isLoading, 
          exportStatusMessage: isLoading ? "Loading video encoder..." : get().exportStatusMessage 
      });
  }
}); 