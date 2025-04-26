"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import useStore from '../store/store';
import { trackToTrackData, midiBlockToData, serializeSynth, serializeEffect } from '../utils/persistenceUtils';
import { Download, FileAudio, Video, Check, Info, Share } from "lucide-react"

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// --- Export Settings Interface --- 
export interface ExportSettings {
    resolution: string; // e.g., "1080p"
    fps: "30" | "60";
    audioFormat: "mp3" | "wav";
}

// --- Mock WebSocket for Frontend Testing --- (Replace with real WebSocket connection)
const mockWebSocket = {
  listeners: new Map<string, (data: any) => void>(),
  addEventListener: function(type: string, listener: (data: any) => void) {
    this.listeners.set(type, listener);
  },
  removeEventListener: function(type: string) {
    this.listeners.delete(type);
  },
  send: function(data: any) { // Not used by client in this example
    console.log('Mock WS Send:', data);
  },
  // Function to simulate receiving a message
  simulateReceive: function(data: any) {
    const listener = this.listeners.get('message');
    if (listener) {
      listener({ data: JSON.stringify(data) });
    }
  },
  close: function() {
    this.listeners.clear();
    console.log('Mock WS Closed');
  }
};

// --- Component ---
export function ExportView({ open, onOpenChange }: ExportViewProps) {
  // Access state needed for export
  const { tracks, bpm, numMeasures } = useStore(state => ({
      tracks: state.tracks,
      bpm: state.bpm, // Access bpm directly
      numMeasures: state.numMeasures, // Access numMeasures
  }));

  const [resolution, setResolution] = useState('1280x720');
  const [fps, setFps] = useState('60');
  
  // --- Export Job State ---
  const [jobId, setJobId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('idle'); // idle, queued, rendering, encoding, complete, error
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleStartExport = async () => {
    setIsExporting(true);
    setError(null);
    setExportStatus('starting');
    setExportProgress(0);
    setExportMessage('Preparing export data...');
    setJobId(null);
    setDownloadUrl(null);

    try {
      // --- Prepare Data for API --- 
      const [width, height] = resolution.split('x').map(Number);
      const frameRate = parseInt(fps, 10);
      
      // Calculate duration from state
      const beatsPerMeasure = 4; // Common assumption, make configurable if needed
      const totalBeats = numMeasures * beatsPerMeasure;
      const duration = bpm > 0 ? (totalBeats * 60) / bpm : 0;
      
      const currentBPM = bpm; // Use state bpm
      
      // Serialize tracks, synths, effects into the format expected by the API
      const serializedTracks = tracks.map((track, index) => {
          // We need trackId for synth/effect serialization if not on track object
          const trackId = track.id;
          
          // Serialize synth
          const synthData = track.synthesizer 
              ? serializeSynth(track.synthesizer, trackId) 
              : null;

          // Serialize effects with order
          const effectData = track.effects
              .map((effect, effectIndex) => serializeEffect(effect, trackId, effectIndex))
              .filter((data): data is NonNullable<typeof data> => data !== null);
              
          return {
              id: track.id,
              name: track.name,
              isMuted: track.isMuted,
              isSoloed: track.isSoloed,
              midiBlocks: track.midiBlocks, // Assuming midiBlocks are serializable as is
              synthesizer: synthData ? { type: synthData.type, settings: synthData.settings } : null,
              effects: effectData.map(e => ({ id: e.id, type: e.type, settings: e.settings })), 
          };
      });
      
      const requestBody = {
          width,
          height,
          fps: frameRate,
          durationSeconds: duration, // Use calculated duration
          // TODO: Add bloomParams if configurable in UI
          // bloomParams: { strength: 1.0, threshold: 0.1, radius: 0.2 }, 
          projectData: {
              bpm: currentBPM,
              tracks: serializedTracks,
          }
      };

      setExportMessage('Sending request to server...');

      // --- Call API Endpoint --- 
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
          let errorMsg = `Export request failed: ${response.statusText}`;
          try {
              const errorData = await response.json();
              errorMsg += ` - ${errorData.message || 'Unknown server error'}`;
          } catch (e) { /* Ignore JSON parsing error */ }
          throw new Error(errorMsg);
      }

      const result = await response.json();
      setJobId(result.jobId);
      setExportStatus('queued');
      setExportMessage('Export job queued on server. Waiting for progress...');
      // Now wait for WebSocket updates

    } catch (err: any) {
      console.error('Error starting export:', err);
      setError(err.message || 'Failed to start export.');
      setExportStatus('error');
      setIsExporting(false);
    }
  };

  // --- Effect for WebSocket Communication (Simulated) ---
  useEffect(() => {
    if (!jobId) return;

    console.log(`Listening for updates for Job ID: ${jobId}`);
    // Replace mockWebSocket with actual WebSocket connection logic
    const ws = mockWebSocket; // Use mock for now

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received WS message:', data);

        // Check if message is for our job ID (important if WS is shared)
        // if (data.jobId !== jobId) return; 

        setExportStatus(data.status || 'unknown');
        setExportProgress(data.progress || 0);
        setExportMessage(data.message || '');

        if (data.status === 'complete') {
          setDownloadUrl(data.url || null); // Expecting `/api/download/:jobId` or similar
          setIsExporting(false);
          ws.close();
        } else if (data.status === 'error') {
          setError(data.error || 'An unknown error occurred during export.');
          setIsExporting(false);
          ws.close();
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.addEventListener('message', handleMessage);

    // ---- Simulation Logic ----
    // Simulate progress updates for the mock websocket
    let simulatedProgress = 5;
    const interval = setInterval(() => {
        if (exportStatus === 'rendering' || exportStatus === 'encoding' || exportStatus === 'queued') {
            simulatedProgress += Math.random() * 15;
            if (simulatedProgress >= 99 && exportStatus !== 'encoding') {
                 ws.simulateReceive({ jobId, status: 'encoding', progress: 99, message: 'Encoding video file...' });
            } else if (simulatedProgress < 99) {
                 ws.simulateReceive({ jobId, status: 'rendering', progress: Math.min(98, Math.round(simulatedProgress)), message: `Rendering frame ${Math.round(simulatedProgress * 72)} of 7200` });
            } else if (simulatedProgress >= 100) {
                 ws.simulateReceive({ jobId, status: 'complete', progress: 100, message: `Export complete: export_${jobId}.mp4`, url: `/api/download/${jobId}` });
                 clearInterval(interval);
            }
        } else {
             clearInterval(interval); // Stop if status changes to complete/error/idle
        }
    }, 800); 
    // ---- End Simulation Logic ----

    return () => {
      console.log(`Cleaning up WebSocket listener for Job ID: ${jobId}`);
      ws.removeEventListener('message');
      ws.close();
      clearInterval(interval);
    };
  }, [jobId, exportStatus]);

  const handleCancel = () => {
    setIsExporting(false);
    setJobId(null);
    setExportStatus('idle');
    setExportProgress(0);
    setExportMessage('');
    setError(null);
    setDownloadUrl(null);
    // TODO: Add API call to attempt cancellation on the backend if desired
  };

  // --- Render Logic ---
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Project Video</DialogTitle>
          <DialogDescription>
            Choose your settings and start the server-side video export.
          </DialogDescription>
        </DialogHeader>
        
        {/* Settings Form (Show only when not exporting and not complete/error) */} 
        {!isExporting && !downloadUrl && !error && (
          <div className="grid gap-4 py-4">
            {/* Resolution Select */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="resolution" className="text-right">
                Resolution
              </Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger id="resolution" className="col-span-3">
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1920x1080">1080p (1920x1080)</SelectItem>
                  <SelectItem value="1280x720">720p (1280x720)</SelectItem>
                  <SelectItem value="640x360">360p (640x360)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* FPS Select */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fps" className="text-right">
                FPS
              </Label>
              <Select value={fps} onValueChange={setFps}>
                <SelectTrigger id="fps" className="col-span-3">
                  <SelectValue placeholder="Select frame rate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60 FPS</SelectItem>
                  <SelectItem value="30">30 FPS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Placeholder for future Bloom config */}
          </div>
        )}

        {/* Progress/Status/Result Display (Show when exporting or finished) */} 
        {(isExporting || downloadUrl || error) && (
            <div className="py-4 space-y-3 text-sm">
                 <p><strong>Status:</strong> <span className="capitalize">{exportStatus}</span></p>
                 {isExporting && exportStatus !== 'queued' && exportStatus !== 'starting' && (
                     <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                         <div 
                             className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-linear" 
                             style={{ width: `${exportProgress}%` }}
                         ></div>
                     </div>
                 )}
                 <p><strong>Progress:</strong> {exportProgress.toFixed(1)}%</p>
                 <p><strong>Message:</strong> {exportMessage || '-'}</p>
                 {error && (
                     <p className="text-red-500 pt-2"><strong>Error:</strong> {error}</p>
                 )}
                 {/* Download Button */} 
                 {downloadUrl && (
                     <Button asChild className="mt-4 w-full">
                         {/* Use a simple link for now. Needs API endpoint for secure download */}
                         <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                             Download Video (Link expires eventually)
                         </a>
                         {/* <a href={downloadUrl} download={`export_${jobId}.mp4`}>Download Video</a> */}
                     </Button>
                 )}
             </div>
         )}

        {/* Footer Buttons */}
        <DialogFooter>
          {!isExporting && !downloadUrl && !error && (
              <Button type="button" onClick={handleStartExport}>
                Start Export
              </Button>
          )}
          {isExporting && (
               <Button type="button" variant="outline" onClick={handleCancel}>
                 Cancel Export (Backend cancellation not implemented)
               </Button>
           )}
           {!isExporting && (downloadUrl || error) && (
               <DialogClose asChild>
                   <Button type="button" variant="outline">Close</Button>
               </DialogClose>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add default export if this is the main export of the file
// export default ExportView;