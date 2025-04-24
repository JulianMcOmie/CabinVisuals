'use client';

import React, { useEffect } from 'react';
import useStore from '../../store/store';
import MidiEditor from '../MidiEditor';
import InstrumentDetailView from '../InstrumentDetailView';
import { Sliders, Music2, Wand2 } from 'lucide-react';
import styles from './DetailView.module.css';

function DetailView() {
  const { 
    selectedTrack, 
    selectedBlock, 
    selectedWindow, 
    detailViewMode, 
    setDetailViewMode 
  } = useStore();
  
  const isMidiEditorVisible = selectedBlock && selectedTrack;

  // Auto-switch detail view mode based on selection
  useEffect(() => {
    if (selectedBlock && selectedTrack) {
      setDetailViewMode("midi");
    } else if (selectedTrack && !selectedBlock) {
      setDetailViewMode("instrument");
    }
  }, [selectedTrack, selectedBlock, setDetailViewMode]);

  return (
    <div 
      className={`${styles.container} ${
        selectedWindow === 'midiEditor' && isMidiEditorVisible ? styles.containerHighlight : ''
      }`}
    >
      <div className={styles.trackInfo}>
        <span className={styles.trackLabel}>
          {selectedTrack !== null ? `Track ${selectedTrack}` : "No Track Selected"}
        </span>
      </div>
      <div className={styles.tabContainer}>
        {[
          { mode: "instrument" as const, icon: <Sliders className={styles.icon} />, label: "Instrument" },
          { mode: "midi" as const, icon: <Music2 className={styles.icon} />, label: "MIDI" },
          { mode: "effects" as const, icon: <Wand2 className={styles.icon} />, label: "Effects" },
        ].map(({ mode, icon, label }) => (
          <button
            key={mode}
            className={`${styles.tabButton} ${
              detailViewMode === mode ? styles.tabButtonActive : styles.tabButtonInactive
            }`}
            onClick={() => setDetailViewMode(mode)}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      <div 
        className={`${styles.contentContainer} ${
          isMidiEditorVisible ? styles.contentContainerHidden : ''
        }`}
      >
        {isMidiEditorVisible ? (
          <MidiEditor block={selectedBlock} track={selectedTrack} />
        ) : selectedTrack ? (
          <InstrumentDetailView track={selectedTrack} />
        ) : (
          <div className={styles.emptyStateContainer}>
            <p>Select a track or MIDI block to edit</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DetailView; 