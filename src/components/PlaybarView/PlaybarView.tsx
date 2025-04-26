'use client';

import React, { useState, useEffect } from 'react';
import useStore from '../../store/store';
import styles from './PlaybarView.module.css';
import { Repeat, Upload, Play, Square, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { User } from '@supabase/supabase-js'; // Import User type
import LogInButton from '../AuthButtons/LogInButton'; // Import new component
import SignUpButton from '../AuthButtons/SignUpButton'; // Import new component

// Define props including the user
interface PlaybarViewProps {
  user: User | null;
}

// Main PlaybarView component
const PlaybarView: React.FC<PlaybarViewProps> = ({ user }) => { // Destructure user prop
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

  const handlePlaybarClick = () => {
    setSelectedWindow(null);
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
      {/* Use reusable Auth Button components */} 
      {!user && (
        <div className="flex items-center space-x-4 mr-4"> {/* Increased spacing */} 
           <LogInButton />
           <SignUpButton />
        </div>
      )}

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
      >
        <Upload className={styles.exportIcon} />
        <span>Export</span>
      </Button>
    </div>
  </div>
  );
};

export default PlaybarView; 