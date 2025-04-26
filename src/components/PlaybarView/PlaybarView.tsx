'use client';

import React, { useState, useEffect } from 'react';
import useStore from '../../store/store';
import styles from './PlaybarView.module.css';
import { Repeat, Upload } from 'lucide-react';
import { Play, Square, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExportView, { ExportSettings } from '../ExportView';

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
        console.log('Export request accepted:', result);
        setExportJobId(result.jobId);
        setExportStatusMessage('Export process started on server. Waiting for progress...');

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
        console.log("Cancel requested during export (not fully implemented - needs API)");
    } else {
        setShowExportModal(false);
    }
  };

  useEffect(() => {
    if (!exportJobId || exportCompleted || exportError) return;

    const intervalId = setInterval(async () => {
        try {
            const response = await fetch(`/api/export?jobId=${exportJobId}`);
            if (!response.ok) {
                console.warn(`Polling failed: ${response.status}`);
                return;
            }
            const status = await response.json();
            setExportProgress(status.percent || 0);
            setExportStatusMessage(status.message || 'Polling for status...');

            if (status.status === 'complete') {
                setExportCompleted(true);
                setIsExporting(false);
                setExportUrl(status.url);
                clearInterval(intervalId);
                console.log('Polling: Export complete', status);
            } else if (status.status === 'failed') {
                setExportError(status.error || 'Unknown error from server');
                setIsExporting(false);
                clearInterval(intervalId);
                console.error('Polling: Export failed', status);
            }
        } catch (err) {
            console.error("Polling error:", err);
        }
    }, 2000);

    return () => clearInterval(intervalId);

  }, [exportJobId, exportCompleted, exportError]);

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