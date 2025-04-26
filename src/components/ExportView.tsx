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