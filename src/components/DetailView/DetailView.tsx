'use client';

import React from 'react';
import useStore from '../../store/store';
import MidiEditor from '../MidiEditor';
import InstrumentDetailView from '../InstrumentDetailView/index';
import EffectsDetailView from '../EffectsDetailView/index';
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

  // Handle drag over to switch to effects view when dragging an effect
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();


    try {
      // If dragging an effect and not already in effects view, switch to it
      if (detailViewMode !== 'effects') {
        setDetailViewMode('effects');
      }
    } catch (err) {
      // Silently ignore invalid data
    }
  };

  return (
    <div 
      className={`${styles.container} ${
        selectedWindow === 'midiEditor' && isMidiEditorVisible ? styles.containerHighlight : ''
      }`}
      onDragOver={handleDragOver}
    >
      <div className={styles.trackInfo}>
        <span className={styles.trackLabel}>
          {"Track Editor"}
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
      <div className={styles.contentContainer}>
        {selectedTrack === null ? (
          <div className={styles.emptyStateContainer}>
            <p>Select a track to edit</p>
          </div>
        ) : (
          <>
            {detailViewMode === "midi" && selectedBlock && (
              <MidiEditor block={selectedBlock} track={selectedTrack} />
            )}
            {detailViewMode === "instrument" && (
              <InstrumentDetailView track={selectedTrack} />
            )}
            {detailViewMode === "effects" && (
              <EffectsDetailView track={selectedTrack} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DetailView; 