"use client"

import { useState } from "react"
import { Download, FileAudio, Video, Check, Info, Share } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog"
import { Button } from "../components/ui/button"
import { Progress } from "../components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Label } from "../components/ui/label"

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

// --- Interface matching PlaybarView state --- 
interface ExportViewProps {
  isOpen: boolean;
  onClose: () => void;
  progress: number; // 0 to 100
  statusMessage: string;
  isExporting: boolean;
  exportCompleted: boolean;
  onExportStart: (settings: ExportSettings) => void; // Callback to start export
  onCancel: () => void; // Callback for cancel
  // Potentially add outputFilename if needed for download link
  // outputFilename?: string;
}

// --- Export Settings Interface --- 
export interface ExportSettings {
    resolution: string; // e.g., "1080p"
    fps: "30" | "60";
    audioFormat: "mp3" | "wav";
}

// --- Renamed component to ExportView ---
export function ExportView({ 
    isOpen, 
    onClose, 
    progress, 
    statusMessage, 
    isExporting,
    exportCompleted,
    onExportStart, 
    onCancel, 
    // outputFilename = "project_export.mp4"
}: ExportViewProps) {
  // State for the settings within the modal itself
  const [audioFormat, setAudioFormat] = useState<"mp3" | "wav">("mp3");
  const [resolution, setResolution] = useState("1080p");
  const [fps, setFps] = useState<"30" | "60">("60"); // Default to 60

  // We control the open state from the parent (PlaybarView)
  const handleOpenChange = (open: boolean) => {
      if (!open) {
          onClose(); // Call parent's onClose when the dialog is dismissed
      }
  };

  const handleInitiateExport = () => {
    onExportStart({ resolution, fps, audioFormat });
  };

  const resolutionOptions = {
    "720p": "1280x720",
    "1080p": "1920x1080",
    "1440p": "2560x1440",
    "4K": "3840x2160",
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] p-0 overflow-hidden text-white"
        style={{ backgroundColor: COLORS.background, borderColor: COLORS.border }}
        onInteractOutside={(e: Event) => {
             if (isExporting) e.preventDefault(); // Prevent closing during export
        }}
        onEscapeKeyDown={(e: KeyboardEvent) => {
             if (isExporting) e.preventDefault(); // Prevent closing during export
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
              <p className="text-sm text-gray-400">Create shareable video from your project</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {exportCompleted ? (
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
                   {/* Use statusMessage from props for final message */}
                   {statusMessage}
                </p>
              </div>

              {/* --- TODO: Actual Download Button --- */}
              {/* This needs the actual filename/URL from the backend */}
              <div
                className="rounded-md border p-4 flex items-center justify-between"
                style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface }}
              >
                <div className="flex items-center">
                  <Video className="h-5 w-5" />
                  <span className="ml-2 text-white">{/* outputFilename */}</span>
                </div>
                <Button
                  className="flex items-center hover:shadow-[0_0_15px_rgba(0,195,255,0.5)] transform hover:-translate-y-0.5 transition-all"
                  style={{
                    backgroundColor: COLORS.electricBlue,
                    borderColor: COLORS.electricBlue,
                    color: "white",
                  }}
                  // onClick={() => { /* TODO: Trigger download */ }}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
              </div>
              {/* Close button after completion */} 
              <div className="flex justify-end pt-4 border-t" style={{ borderColor: COLORS.border }}>
                  <Button variant="outline" onClick={onClose} style={{ backgroundColor: "#3a3a3a", borderColor: "#555", color: "white" }}>
                      Close
                  </Button>
              </div>
            </div>
          ) : isExporting ? (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-white font-medium">{statusMessage}</h3> {/* Use status message from props */} 
                  <span className="text-sm text-gray-400">{progress.toFixed(0)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* More detailed status (could be derived from statusMessage) */}
              <div className="space-y-2">
                 {/* Example: Show stages based on progress */} 
                 <div className="flex items-center text-sm">
                   <Check className="h-4 w-4 mr-2 text-green-500" /> 
                   <span className="text-gray-300">Preparing export...</span>
                 </div>
                 <div className="flex items-center text-sm">
                   {progress > 5 ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <div className="h-4 w-4 mr-2 rounded-full border-2 border-gray-600" />} 
                   <span className="text-gray-300">Rendering frames...</span>
                 </div>
                 <div className="flex items-center text-sm">
                   {progress > 95 ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <div className="h-4 w-4 mr-2 rounded-full border-2 border-gray-600" />} 
                   <span className="text-gray-300">Encoding video...</span>
                 </div>
              </div>

              <div className="flex justify-end pt-4 border-t" style={{ borderColor: COLORS.border }}>
                {/* --- TODO: Implement actual cancel functionality --- */}
                <Button
                  variant="outline"
                  onClick={onCancel} // Use parent's cancel handler
                  style={{ backgroundColor: "#3a3a3a", borderColor: "#555", color: "white" }}
                  disabled // Disable for now unless backend supports cancel
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {/* Side-by-side layout */}
              <div className="flex gap-5">
                {/* Preview - Left side */}
                <div className="w-2/5">
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
                    <p className="text-xs text-gray-500">Select export quality and format</p>
                  </div>
                </div>

                {/* Controls - Right side */}
                <div className="w-3/5 space-y-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Export Settings</h3>

                  {/* Resolution */}
                  <div className="space-y-1">
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
                    <Label className="text-xs text-gray-300">Frame Rate</Label>
                    <div className="flex rounded-md overflow-hidden border" style={{ borderColor: COLORS.border }}>
                      <button
                        className={`flex-1 py-1.5 px-3 text-xs font-medium transition-colors ${
                          fps === "30" ? "bg-[#3a3a3a] text-white" : "bg-[#252525] text-gray-300 hover:bg-[#333]"
                        }`}
                        onClick={() => setFps("30")}
                      >
                        30 FPS
                      </button>
                      <button
                        className={`flex-1 py-1.5 px-3 text-xs font-medium transition-colors ${
                          fps === "60" ? "bg-[#3a3a3a] text-white" : "bg-[#252525] text-gray-300 hover:bg-[#333]"
                        }`}
                        onClick={() => setFps("60")}
                      >
                        60 FPS
                      </button>
                    </div>
                  </div>

                  {/* Audio Format - Currently not used by backend, keep for UI */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Audio Format</Label>
                    <div className="flex rounded-md overflow-hidden border" style={{ borderColor: COLORS.border }}>
                      <button
                        className={`flex-1 py-1.5 px-3 text-xs font-medium transition-colors ${
                          audioFormat === "mp3"
                            ? "bg-[#3a3a3a] text-white"
                            : "bg-[#252525] text-gray-300 hover:bg-[#333]"
                        }`}
                        onClick={() => setAudioFormat("mp3")}
                      >
                        <div className="flex items-center justify-center">
                          <FileAudio className="h-3 w-3 mr-1" />
                          MP3
                        </div>
                      </button>
                      <button
                        className={`flex-1 py-1.5 px-3 text-xs font-medium transition-colors ${
                          audioFormat === "wav"
                            ? "bg-[#3a3a3a] text-white"
                            : "bg-[#252525] text-gray-300 hover:bg-[#333]"
                        }`}
                        onClick={() => setAudioFormat("wav")}
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

              <div className="flex justify-between pt-4 mt-4 border-t" style={{ borderColor: COLORS.border }}>
                <Button
                  variant="outline"
                  onClick={onClose} // Use parent's close handler
                  style={{ backgroundColor: "#3a3a3a", borderColor: "#555", color: "white" }}
                >
                  Cancel
                </Button>
                <Button
                  className="text-white hover:shadow-[0_0_15px_rgba(0,195,255,0.5)] transform hover:-translate-y-0.5 transition-all"
                  style={{
                    backgroundColor: COLORS.electricBlue,
                    borderColor: COLORS.electricBlue,
                  }}
                  onClick={handleInitiateExport} // Call parent's export starter
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