'use client';

import React, { useState } from 'react';
import useStore from '../../store/store';
import styles from './PlaybarView.module.css';
import { Repeat, Upload } from 'lucide-react';
import { Play, Square, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExportView from '../ExportView';
import { ExportSettings } from '../../lib/ExportRenderer';

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
    tracks
  } = useStore();

  const [exportButtonHover, setExportButtonHover] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusMessage, setExportStatusMessage] = useState('Preparing export...');
  const [exportCompleted, setExportCompleted] = useState(false);

  const handlePlaybarClick = () => {
    setSelectedWindow(null);
  };
  
  const handleOpenExportModal = () => {
    setSelectedWindow(null);
    setIsExporting(false);
    setExportCompleted(false);
    setExportProgress(0);
    setExportStatusMessage('Configure export settings.');
    setShowExportModal(true);
  };

  const handleStartExport = async (settings: ExportSettings) => {
    setIsExporting(true);
    setExportCompleted(false);
    setExportProgress(0);
    setExportStatusMessage('Initializing export...');

    console.log('Starting export with settings:', settings);
    const payload = {
        width: settings.resolution === "720p" ? 1280 : 
               settings.resolution === "1080p" ? 1920 : 
               settings.resolution === "1440p" ? 2560 : 3840,
        height: settings.resolution === "720p" ? 720 : 
                settings.resolution === "1080p" ? 1080 : 
                settings.resolution === "1440p" ? 1440 : 2160,
        fps: parseInt(settings.fps),
        startTime: 0,
        endTime: 10,
        bpm: bpm,
        tracks: tracks,
    };
    console.log('Sending payload:', payload);

    try {
      console.log('Export process started (simulation)');
      for (let i = 0; i <= 100; i += 5) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setExportProgress(i);
        setExportStatusMessage(`Rendering frame ${Math.round(i * (payload.endTime - payload.startTime) * payload.fps / 100)}...`);
        if (i > 95) setExportStatusMessage('Encoding video...');
      }
      
      setExportStatusMessage('Export complete! File ready for download.'); 
      setExportCompleted(true);
      setIsExporting(false);

    } catch (error) {
      console.error("Export failed:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setExportStatusMessage(`Export failed: ${errorMessage}`);
      setIsExporting(false);
      setExportCompleted(false);
    }
  };

  const handleCloseOrCancel = () => {
    if (isExporting) {
        console.log("Cancel requested during export (not implemented)");
    } else {
        setShowExportModal(false);
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
          onExportStart={handleStartExport}
          onCancel={handleCloseOrCancel}
        />
    )}
  </div>
  );
};

export default PlaybarView; 