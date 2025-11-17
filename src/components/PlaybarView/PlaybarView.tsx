'use client';

import React, { useState } from 'react';
import useStore from '../../store/store';
import styles from './PlaybarView.module.css';
import { Repeat, Upload, Play, Pause, Square, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { User } from '@supabase/supabase-js'; // Import User type
import LogInButton from '../AuthButtons/LogInButton'; // Import new component
import SignUpButton from '../AuthButtons/SignUpButton'; // Import new component
import Link from 'next/link';

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
      style={{ position: 'relative' }}
    >
    <div className="flex items-center space-x-3">
      <Link href="/projects" legacyBehavior>
        <a className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer ml-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Projects
        </a>
      </Link>

      <Button
        variant="ghost"
        size="icon"
        className={styles.sidebarToggle}
        onClick={toggleInstrumentSidebar}
      >
        <PanelLeft className="h-5 w-5" />
      </Button>

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
            if (isPlaying) {
              pause();
            } else {
              play();
            }
            setSelectedWindow(null);
          }}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current" />
          )}
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

    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
      <h1 className="text-lg font-medium text-white">Cabin Visuals</h1>
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
        {currentBeat.toFixed(2)}
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