'use client';

import React, { useState, useEffect, useRef } from 'react';
import useStore from '../../store/store';
import styles from './PlaybarView.module.css';
import { Repeat, Upload } from 'lucide-react';
import { Play, Square, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExportView, { ExportSettings } from '../ExportView';

// Define WebSocket URL (adjust based on your server setup)
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'; 

// Main PlaybarView component
const PlaybarView: React.FC = () => {
  const { 
    currentBeat, 
    isPlaying, 
    bpm, 
    play, 
    pause, 
    stop, 
    setBPM, 
    loopEnabled,
    toggleLoop,
    isInstrumentSidebarVisible,
    toggleInstrumentSidebar,
    setSelectedWindow,
    tracks,
    timeManager
  } = useStore();

  const [exportButtonHover, setExportButtonHover] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusMessage, setExportStatusMessage] = useState('Preparing export...');
  const [exportCompleted, setExportCompleted] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // WebSocket Ref
  const ws = useRef<WebSocket | null>(null);

  // --- WebSocket Connection Effect ---
  useEffect(() => {
    // Don't connect until needed (e.g., modal opens or export starts)
    // For simplicity, let's connect when the component mounts and manage registration later
    if (!ws.current) {
      console.log(`Attempting to connect WebSocket: ${WS_URL}`);
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        console.log('WebSocket Connected');
        // If we already have a job ID when connection opens, register it
        if (exportJobId) {
          console.log(`WebSocket open, registering existing jobId: ${exportJobId}`);
          ws.current?.send(JSON.stringify({ type: 'register', jobId: exportJobId }));
        }
      };

      ws.current.onclose = (event) => {
        console.log(`WebSocket Disconnected: code=${event.code}, reason=${event.reason}`);
        ws.current = null; // Ensure ref is cleared on close
        // Optional: Implement reconnection logic here if needed
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket Error:', error);
        setExportError('WebSocket connection error.'); // Show error in UI
        setIsExporting(false); // Stop exporting state on WS error
        // ws.current might be null here already depending on when error occurs
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string);
          console.log('WebSocket Message Received:', message);

          // Only process messages for the current job
          if (message.jobId === exportJobId) {
            switch (message.type) {
              case 'status': // Initial status update
              case 'progress':
                setExportProgress(message.percent ?? exportProgress);
                setExportStatusMessage(message.message ?? exportStatusMessage);
                setIsExporting(true); // Ensure exporting is true on progress
                setExportCompleted(false);
                setExportError(null);
                break;
              case 'complete':
                setExportProgress(100);
                setExportStatusMessage(message.message || 'Export complete!');
                setExportUrl(message.url);
                setExportCompleted(true);
                setIsExporting(false);
                setExportError(null);
                // Consider closing WS here or keep open for other tasks
                break;
              case 'error':
                setExportStatusMessage(`Export failed: ${message.message}`);
                setExportError(message.message);
                setExportCompleted(false); // Ensure not marked completed
                setIsExporting(false);
                // Keep WS open potentially, or close based on error type
                break;
              case 'registered': // Confirmation from server
                 console.log(`WebSocket registered successfully for job ${message.jobId}`);
                 break;
              default:
                console.warn('Unknown WebSocket message type:', message.type);
            }
          } else if (message.jobId) {
             console.warn(`WebSocket message received for different job (${message.jobId}), current job is ${exportJobId}`);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
    }

    // Cleanup function to close WebSocket on component unmount
    return () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        console.log('Closing WebSocket connection.');
        ws.current.close();
      }
      ws.current = null;
    };
  // Run only once on mount to establish connection
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array

  const handlePlaybarClick = () => {
    setSelectedWindow(null);
  };
  
  const handleOpenExportModal = () => {
    setSelectedWindow(null);
    setIsExporting(false);
    setExportCompleted(false);
    setExportProgress(0);
    setExportStatusMessage('Configure export settings.');
    setExportError(null);
    setExportJobId(null);
    setExportUrl(null);
    setShowExportModal(true);
  };

  const handleStartExport = async (settings: ExportSettings) => {
    setIsExporting(true);
    setExportCompleted(false);
    setExportProgress(0);
    setExportStatusMessage('Sending request to server...');
    setExportError(null);
    setExportJobId(null);
    setExportUrl(null);

    console.log('Starting export with settings:', settings);

    const estimatedDuration = 30;

    const payload = {
        width: settings.resolution === "720p" ? 1280 :
               settings.resolution === "1080p" ? 1920 :
               settings.resolution === "1440p" ? 2560 : 3840,
        height: settings.resolution === "720p" ? 720 :
                settings.resolution === "1080p" ? 1080 :
                settings.resolution === "1440p" ? 1440 : 2160,
        fps: parseInt(settings.fps, 10),
        durationSeconds: estimatedDuration,
        bpm: bpm,
        tracks: tracks,
        bloomParams: {
            strength: 1.0,
            threshold: 0.1,
            radius: 0.2
        }
    };
    console.log('Sending payload to /api/export:', payload);

    try {
        const response = await fetch('/api/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Export request accepted, Job ID:', result.jobId);
        setExportJobId(result.jobId);
        setExportStatusMessage('Waiting for server connection...');

        // --- Register Job ID with WebSocket ---
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            console.log(`WebSocket connected, sending register message for jobId: ${result.jobId}`);
            ws.current.send(JSON.stringify({ type: 'register', jobId: result.jobId }));
            setExportStatusMessage('Server connected. Waiting for progress...');
        } else {
            console.warn('WebSocket not connected when export started. Registration will occur onopen.');
            // onopen handler will pick up exportJobId and register
        }

    } catch (error) {
        console.error("Export failed:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        setExportStatusMessage(`Export failed: ${errorMessage}`);
        setExportError(errorMessage);
        setIsExporting(false);
        setExportCompleted(false);
        setExportJobId(null);
    }
  };

  const handleCloseOrCancel = () => {
    if (isExporting) {
        console.log("Cancel requested during export (not fully implemented - needs API/WS message)");
        // TODO: Send WS message or API call to cancel job on backend
    } else {
        setShowExportModal(false);
        // Optional: Close WS if not needed elsewhere
        // if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        //   ws.current.close();
        // }
    }
  };

  return (
    <div
      className={styles.playbarContainer}
      onClick={handlePlaybarClick}
    >
    <div className="flex items-center space-x-3">
      <Button
        variant="ghost"
        size="icon"
        className={styles.sidebarToggle}
        onClick={toggleInstrumentSidebar}
      >
        <PanelLeft className="h-5 w-5" />
      </Button>

      <div className={styles.divider}></div>

      <div className={styles.controlsContainer}>
        <Button
          variant="ghost"
          size="icon"
          className={styles.stopButton}
          onClick={() => {
            stop();
            setSelectedWindow(null);
          }}
        >
          <Square className="h-5 w-5 fill-current" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={isPlaying ? styles.playButtonActive : styles.playButtonInactive}
          onClick={() => {
            play();
            setSelectedWindow(null);
          }}
        >
          <Play className="h-5 w-5 fill-current" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={loopEnabled ? styles.loopButtonActive : styles.loopButtonInactive}
          onClick={() => {
            toggleLoop();
            setSelectedWindow(null);
          }}
        >
          <Repeat className="h-5 w-5 fill-current" />
        </Button>
      </div>
    </div>

    <div className={styles.rightControls}>
      <div className={styles.beatDisplay}>
        {currentBeat}
      </div>

      <div className={styles.bpmContainer}>
        <span className={styles.bpmLabel}>BPM:</span>
        <input
          type="text"
          value={bpm}
          onChange={(e) => {
            setBPM(parseInt(e.target.value));
            setSelectedWindow(null);
          }}
          className={styles.bpmInput}
        />
      </div>

      <Button
        variant="outline"
        className={styles.exportButton}
        style={{
          backgroundColor: exportButtonHover ? "#30d0ff" : "var(--electricBlue)",
          borderColor: exportButtonHover ? "#30d0ff" : "var(--electricBlue)",
          boxShadow: exportButtonHover ? "0 0 15px rgba(0, 195, 255, 0.7)" : "none",
        }}
        onMouseEnter={() => setExportButtonHover(true)}
        onMouseLeave={() => setExportButtonHover(false)}
        onClick={handleOpenExportModal}
      >
        <Upload className={styles.exportIcon} />
        <span>Export</span>
      </Button>
    </div>

    {showExportModal && (
        <ExportView
          isOpen={showExportModal}
          onClose={handleCloseOrCancel}
          progress={exportProgress}
          statusMessage={exportStatusMessage}
          isExporting={isExporting}
          exportCompleted={exportCompleted}
          exportError={exportError}
          downloadUrl={exportUrl}
          onExportStart={handleStartExport}
          onCancel={handleCloseOrCancel}
        />
    )}
  </div>
  );
};

export default PlaybarView; 