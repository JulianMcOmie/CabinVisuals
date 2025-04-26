"use client"

import React, { useState } from "react"
import { Download, FileAudio, Video, Check, Info, Share } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/src/components/ui/dialog"
import { Button } from "@/src/components/ui/button"
import { Progress } from "@/src/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select"
import { Label } from "@/src/components/ui/label"

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
  exportError?: string | null;
  downloadUrl?: string | null;
}

// --- Export Settings Interface --- 
export interface ExportSettings {
    resolution: string; // e.g., "1080p"
    fps: string;
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
    exportError,
    downloadUrl,
}: ExportViewProps) {
  // State for the settings within the modal itself
  const [resolution, setResolution] = useState("1080p");
  const [fps, setFps] = useState("60");

  // We control the open state from the parent (PlaybarView)
  const handleOpenChange = (open: boolean) => {
      if (!open) {
          onClose(); // Call parent's onClose when the dialog is dismissed
      }
  };

  const handleInitiateExport = () => {
    onExportStart({ resolution, fps });
  };

  // Determine current state for rendering logic
  const showSettings = !isExporting && !exportCompleted && !exportError;
  const showProgress = isExporting;
  const showCompletion = exportCompleted && !exportError;
  const showError = !!exportError;

  // Resolution options map
  const resolutionOptions: { [key: string]: string } = {
    "720p": "1280x720",
    "1080p": "1920x1080",
    "1440p": "2560x1440",
    "4k": "3840x2160",
  };

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
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">
            Export Project
          </DialogTitle>
          {!showError && (
             <DialogDescription>
                {showSettings ? 'Configure the settings for your video export.' : 
                 showProgress ? 'Your video is being rendered...' : 
                 showCompletion ? 'Your video is ready!' : ''}
             </DialogDescription>
          )}
        </DialogHeader>

        {/* Display Error if present */} 
        {showError && (
            <div className="my-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                <p className="font-bold">Export Failed</p>
                <p>{exportError}</p>
            </div>
        )}

        {/* Settings Form (Hidden during/after export) */} 
        {showSettings && (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="resolution" className="text-right">
                Resolution
              </Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(resolutionOptions).map(([key, value]) => (
                    <SelectItem key={key} value={key} className="text-white focus:bg-[#444] focus:text-white">
                      {key} ({value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fps" className="text-right">
                FPS
              </Label>
              <Select value={fps} onValueChange={setFps}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select FPS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 FPS</SelectItem>
                  <SelectItem value="60">60 FPS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Progress Bar and Status (Shown during export) */} 
        {showProgress && (
          <div className="my-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground mt-2 text-center">{statusMessage}</p>
          </div>
        )}

        {/* Completion Message and Download Link */} 
        {showCompletion && (
            <div className="my-4 text-center">
                <p className="text-green-600 font-semibold mb-3">{statusMessage || 'Export Complete!'}</p>
                {downloadUrl ? (
                    <Button asChild className="w-full"> 
                        <a href={downloadUrl} download={`cabin_export_${resolution}_${fps}fps.mp4`}>
                            <Download className="mr-2 h-4 w-4" /> Download Video
                        </a>
                    </Button>
                ) : (
                    <p className="text-sm text-muted-foreground mt-1">Download link will appear shortly.</p>
                )}
            </div>
        )}

        <DialogFooter>
          {/* Show Cancel during export, Close otherwise */} 
          <Button variant="outline" onClick={onCancel} disabled={isExporting && !exportCompleted && !exportError}>
            {isExporting ? 'Cancel' : 'Close'}
          </Button>
          {/* Show Start Export only when settings are visible */} 
          {showSettings && (
            <Button onClick={handleInitiateExport}>Start Export</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ExportView; // Add default export 