"use client"

import { useState, useEffect } from "react"
import * as THREE from 'three'; // Import THREE
import { Download, FileAudio, Video, Check, Info, Share } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog"
import { Button } from "../components/ui/button"
import { Progress } from "../components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Label } from "../components/ui/label"
import useStore from "../store/store"; // Import main store
import { ExportRenderer, ExportRendererDeps, ExportSettings } from "../lib/ExportRenderer"; // Import renderer
import type TimeManager from "../lib/TimeManager"; // Import types needed for props
import type VisualizerManager from "../lib/VisualizerManager";

// Define the colors to match the app's aesthetic
const COLORS = {
  accent: "#5a8ea3", // Subtle blue-gray
  highlight: "#c8a45b", // Muted gold/amber
  green: "#6a9955", // Muted green
  background: "#1e1e1e", // Dark background
  surface: "#252525", // Slightly lighter surface
  border: "#3a3a3a", // Border color
  activeBg: "#2d3540", // Active element background
  electricBlue: "#00c3ff", // Vibrant electric blue accent
  selectedBlue: "#e0f7ff", // Whitish blue for selection
}

// --- Define Props Interface --- 
interface ExportViewProps {
  // Required R3F/App instances passed from VisualizerView
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  canvasRef: React.RefObject<HTMLCanvasElement>; // Pass the ref itself
  visualizerManager: VisualizerManager;
  timeManager: TimeManager;
  invalidate: () => void;
}

export function ExportView(props: ExportViewProps) {
  const { gl, scene, camera, canvasRef, visualizerManager, timeManager, invalidate } = props;

  // Local state for dialog settings
  const [audioFormat, setAudioFormat] = useState<"mp3" | "wav">("mp3");
  const [resolution, setResolution] = useState("1080p");
  const [fps, setFps] = useState<"30" | "60">("60");

  // Get state and actions from the store
  const {
    isExporting,
    exportProgress,
    exportStatusMessage,
    exportError,
    startExport,
    cancelExport,
    resetExportState,
    isExportViewOpen,
    closeExportView,
  } = useStore(state => state);

  // Determine if export can be initiated based on props and state
  // Simplified check: Ensure main objects and the canvas ref *value* exist
  const canInitiateExport = !!(gl && scene && camera && canvasRef.current && visualizerManager && timeManager && !isExporting);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isExportViewOpen) {
      if (!isExporting) {
          resetExportState();
      }
    }
  }, [isExportViewOpen, isExporting, resetExportState]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isExporting) {
          // Ask user if they want to cancel? Or just close?
          // For now, just call the parent's onClose.
          // Cancellation must be done via the Cancel button.
      }
      closeExportView();
    }
    // Dialog opening is handled by the parent setting `isOpen`
  };

  const handleInitiateExport = () => {
    // Use props directly for checks and dependencies
    if (!gl || !scene || !camera || !canvasRef.current || !visualizerManager || !timeManager || !invalidate) {
      console.error("Cannot start export: Essential rendering dependencies are missing.");
      return;
    }
    if (isExporting) {
        console.warn("Export already in progress.");
        return;
    }

    const currentSettings: ExportSettings = { resolution, fps, audioFormat };

    // Prepare dependencies for the renderer using props
    const rendererDeps: ExportRendererDeps = {
        canvas: canvasRef.current, // Get current canvas element from ref
        gl,
        scene,
        camera,
        timeManager,
        invalidate,
        settings: currentSettings,
        // Store actions remain the same
        actions: {
            updateExportProgress: useStore.getState().updateExportProgress,
            finishExport: useStore.getState().finishExport,
            failExport: useStore.getState().failExport,
            setCancelExportFn: useStore.getState().setCancelExportFn,
            setEncoderLoading: useStore.getState().setEncoderLoading,
        },
    };

    const renderer = new ExportRenderer(rendererDeps);
    startExport(currentSettings, renderer);
  };

  const handleCancelExport = () => {
      if (isExporting) {
          cancelExport(); // Call the cancel action from the store
      }
  }

  const resolutionOptions = {
    "720p": "1280x720",
    "1080p": "1920x1080",
    "1440p": "2560x1440",
    "4K": "3840x2160",
  }

  // Calculate progress percentage for the UI component
  const progressPercentage = exportProgress * 100;

  // Determine if the export has completed (for UI rendering)
  // We consider completion if progress is 1 and not exporting, and no error
  const exportCompletedSuccessfully = exportProgress === 1 && !isExporting && !exportError;

  return (
    <Dialog open={isExportViewOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] p-0 overflow-hidden text-white"
        style={{ backgroundColor: COLORS.background, borderColor: COLORS.border }}
        onInteractOutside={(e: Event) => {
             // Prevent closing via overlay click during export
             if (isExporting) e.preventDefault(); 
        }}
        onEscapeKeyDown={(e: KeyboardEvent) => {
             // Prevent closing via Escape key during export
             if (isExporting) e.preventDefault(); 
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: COLORS.border }}>
          <div className="flex items-center">
            <div
              className="h-8 w-8 rounded-md flex items-center justify-center mr-3"
              style={{ backgroundColor: COLORS.electricBlue }}
            >
              <Share className="h-4 w-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-white">
                Export Project
              </DialogTitle>
              <p className="text-sm text-gray-400">Create shareable video from your project (First 5 seconds)</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">

          {/* State 1: Export Completed Successfully */}  
          {exportCompletedSuccessfully ? (
            <div className="space-y-6">
              <div className="flex items-center justify-center flex-col">
                 <div
                  className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: "rgba(0, 195, 255, 0.15)" }}
                >
                  <Check className="h-8 w-8" style={{ color: COLORS.electricBlue }} />
                </div>
                <h3 className="text-xl font-medium text-white mb-2">Export Complete</h3>
                <p className="text-gray-400 text-center max-w-md">
                   {exportStatusMessage || "Your video export is complete. The download should begin shortly."} 
                </p>
              </div>
              {/* No download button needed here, CCapture handles it */}
               <div className="flex justify-end pt-4 border-t" style={{ borderColor: COLORS.border }}>
                    <Button
                        variant="outline"
                        onClick={closeExportView} 
                        style={{ backgroundColor: "#3a3a3a", borderColor: "#555", color: "white" }}
                        className="hover:bg-[#555] transition-colors"
                        >
                        Close
                    </Button>
               </div>
            </div>
          )
          /* State 2: Export In Progress */
          : isExporting ? (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  {/* Use status message from store */}
                  <h3 className="text-white font-medium">
                      {exportStatusMessage || "Processing..."}
                  </h3> 
                  {/* Use progress from store */}
                  <span className="text-sm text-gray-400">{progressPercentage.toFixed(0)}%</span>
                </div>
                {/* Use progress from store */}
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {/* Optional: More detailed status indicators based on message/progress */} 
              {/* ... (Could show steps like 'Rendering frames...', 'Saving file...') ... */}

              <div className="flex justify-end pt-4 border-t" style={{ borderColor: COLORS.border }}>
                <Button
                  variant="outline"
                  onClick={handleCancelExport} // Use cancel action from store
                  className="hover:bg-[#555] transition-colors" 
                  style={{ backgroundColor: "#3a3a3a", borderColor: "#555", color: "white" }}
                  // Disable if cancellation isn't possible (e.g., already finishing)
                  // disabled={!cancelExportFn} // We disable based on isExporting for simplicity
                >
                  Cancel Export
                </Button>
              </div>
            </div>
          )
          /* State 3: Idle / Ready to Export (or Failed) */
          : (
            <div> 
              {/* Show Error Message if export failed */}
              {exportError && (
                  <div className="mb-4 p-3 rounded-md border border-red-700 bg-red-900/30 text-red-300 text-sm">
                      <p><b>Export Failed:</b> {exportError}</p>
                  </div>
              )}

              {/* Settings UI (Resolution, FPS, etc.) */} 
              <div className="flex gap-5">
                {/* Preview Area - Left side */} 
                <div className="w-2/5">
                    {/* ... (Static preview placeholder remains the same) ... */} 
                    <div
                        className="aspect-video rounded-md overflow-hidden border flex items-center justify-center"
                        style={{ borderColor: COLORS.border, backgroundColor: "#111" }}
                    >
                        <div className="text-center">
                        <div className="flex justify-center mb-1">
                            <Video className="h-6 w-6 text-gray-500" />
                        </div>
                        <p className="text-xs text-gray-400">Video preview</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-1 mt-2">
                        <Info className="h-3 w-3 text-gray-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-500">Select export quality and format (Audio format ignored for now)</p>
                    </div>
                    {!gl && (
                        <p className="text-xs text-yellow-500 mt-2">Warning: Rendering context not available.</p>
                    )} 
                </div>

                {/* Controls - Right side */} 
                <div className="w-3/5 space-y-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Export Settings</h3>

                  {/* Resolution */} 
                  <div className="space-y-1">
                      {/* ... (Resolution select remains the same) ... */} 
                       <Label htmlFor="resolution" className="text-xs text-gray-300">
                      Resolution
                    </Label>
                    <Select value={resolution} onValueChange={setResolution}>
                      <SelectTrigger
                        id="resolution"
                        className="w-full h-9 text-sm text-white"
                        style={{ backgroundColor: "#3a3a3a" }}
                      >
                        <SelectValue placeholder="Select resolution" />
                      </SelectTrigger>
                      <SelectContent style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
                        {Object.entries(resolutionOptions).map(([key, value]) => (
                          <SelectItem key={key} value={key} className="text-white focus:bg-[#444] focus:text-white">
                            {key} ({value})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* FPS */} 
                  <div className="space-y-1">
                    {/* ... (FPS button group remains the same) ... */} 
                     <Label className="text-xs text-gray-300">Frame Rate</Label>
                    <div className="flex rounded-md overflow-hidden border" style={{ borderColor: COLORS.border }}>
                      <button
                        className={`flex-1 py-1.5 px-3 text-xs font-medium transition-colors ${ 
                          fps === "30" ? "text-white" : "bg-[#252525] text-gray-300 hover:bg-[#333]"
                        }`}
                        style={{ 
                            backgroundColor: fps === "30" ? 'rgba(0, 195, 255, 0.4)' : undefined,
                            boxShadow: fps === "30" ? `inset 0 0 0 1px ${COLORS.electricBlue}` : undefined
                        }}
                        onClick={() => setFps("30")}
                      >
                        30 FPS
                      </button>
                      <button
                        className={`flex-1 py-1.5 px-3 text-xs font-medium transition-colors ${ 
                          fps === "60" ? "text-white" : "bg-[#252525] text-gray-300 hover:bg-[#333]"
                        }`}
                        style={{ 
                            backgroundColor: fps === "60" ? 'rgba(0, 195, 255, 0.4)' : undefined,
                            boxShadow: fps === "60" ? `inset 0 0 0 1px ${COLORS.electricBlue}` : undefined
                        }}
                        onClick={() => setFps("60")}
                      >
                        60 FPS
                      </button>
                    </div>
                  </div>

                  {/* Audio Format (UI only for now) */} 
                  <div className="space-y-1">
                    {/* ... (Audio button group remains the same) ... */} 
                      <Label className="text-xs text-gray-300">Audio Format (Ignored)</Label>
                    <div className="flex rounded-md overflow-hidden border" style={{ borderColor: COLORS.border }}>
                      <button
                        className={`flex-1 py-1.5 px-3 text-xs font-medium transition-colors ${ 
                          audioFormat === "mp3"
                            ? "text-white"
                            : "bg-[#252525] text-gray-300 hover:bg-[#333]"
                        }`}
                        style={{ 
                            backgroundColor: audioFormat === "mp3" ? 'rgba(0, 195, 255, 0.4)' : undefined,
                            boxShadow: audioFormat === "mp3" ? `inset 0 0 0 1px ${COLORS.electricBlue}` : undefined
                        }}
                        onClick={() => setAudioFormat("mp3")}
                        disabled={true} // Disable as it's not used
                      >
                        <div className="flex items-center justify-center">
                          <FileAudio className="h-3 w-3 mr-1" />
                          MP3
                        </div>
                      </button>
                      <button
                        className={`flex-1 py-1.5 px-3 text-xs font-medium transition-colors ${ 
                          audioFormat === "wav"
                            ? "text-white"
                            : "bg-[#252525] text-gray-300 hover:bg-[#333]"
                        }`}
                        style={{ 
                            backgroundColor: audioFormat === "wav" ? 'rgba(0, 195, 255, 0.4)' : undefined,
                            boxShadow: audioFormat === "wav" ? `inset 0 0 0 1px ${COLORS.electricBlue}` : undefined
                        }}
                        onClick={() => setAudioFormat("wav")}
                        disabled={true} // Disable as it's not used
                      >
                        <div className="flex items-center justify-center">
                          <FileAudio className="h-3 w-3 mr-1" />
                          WAV
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */} 
              <div className="flex justify-between pt-4 mt-4 border-t" style={{ borderColor: COLORS.border }}>
                <Button
                  variant="outline"
                  onClick={closeExportView} // Use parent's close handler
                  style={{ backgroundColor: "#3a3a3a", borderColor: "#555", color: "white" }}
                  className="hover:bg-[#555] transition-colors"
                >
                  Close
                </Button>
                <Button
                  className="text-white hover:shadow-[0_0_15px_rgba(0,195,255,0.5)] transform hover:-translate-y-0.5 transition-all"
                  style={{
                    backgroundColor: canInitiateExport ? COLORS.electricBlue : '#555', // Dim if disabled
                    borderColor: canInitiateExport ? COLORS.electricBlue : '#777',
                    cursor: canInitiateExport ? 'pointer' : 'not-allowed' // Indicate disabled state
                  }}
                  onClick={handleInitiateExport} 
                  disabled={!canInitiateExport} // Disable if context missing or already exporting
                >
                  Export
                </Button>
              </div>
            </div>
          )}
        </div> 
      </DialogContent>
    </Dialog>
  )
}

export default ExportView; // Add default export 