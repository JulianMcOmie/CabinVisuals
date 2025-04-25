'use client';

import React, { useState, useEffect } from 'react';
import useStore from '../../store/store';
import styles from './PlaybarView.module.css';
import { Repeat, Upload } from 'lucide-react';
import { Play, Square, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExportView from '../ExportView';

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
    setSelectedWindow
  } = useStore();

  const [exportButtonHover, setExportButtonHover] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusMessage, setExportStatusMessage] = useState('Preparing export...');

  const handlePlaybarClick = () => {
    setSelectedWindow(null);
  };
  
  const handleExportClick = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportStatusMessage('Starting export process...');
    setSelectedWindow(null);

    try {
      console.log('Export initiated (simulation)');
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setExportProgress(i);
        setExportStatusMessage(`Rendering frame ${i * 2}...`);
      }
      setExportStatusMessage('Export complete! (simulation)');
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error("Export failed:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setExportStatusMessage(`Export failed: ${errorMessage}`);
    }
  };

  const handleCloseExportModal = () => {
    setIsExporting(false);
    setExportProgress(0);
    setExportStatusMessage('Preparing export...');
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
        onClick={handleExportClick}
      >
        <Upload className={styles.exportIcon} />
        <span>Export</span>
      </Button>
    </div>

    <ExportView 
      isOpen={isExporting}
      onClose={handleCloseExportModal}
      progress={exportProgress}
      statusMessage={exportStatusMessage}
    />
  </div>
  );
};

export default PlaybarView; 