'use client';

import React from 'react';
import useStore from '../../store/store';
import { Track } from '../../lib/types';
import SynthesizerDetailView from '../SynthesizerDetailView';
import styles from './InstrumentDetailView.module.css';

interface InstrumentDetailViewProps {
  track: Track;
}

function InstrumentDetailView({ track }: InstrumentDetailViewProps) {
  const { setSelectedWindow } = useStore();
  
  if (!track || !track.synthesizer) {
    return null;
  } 

  // This handler now simply closes the detail view if clicked outside specific controls
  const handleViewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Prevent closing if the click is inside an interactive area (like inputs, selects, buttons)
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLSelectElement || 
        event.target instanceof HTMLButtonElement) {
      return; // Don't close if clicking interactive elements
    }
    // Check if the click is on the background div itself, not its children
    if (event.currentTarget === event.target) {
      setSelectedWindow(null); 
    }
  };

  return (
    <div 
      className={styles.container}
      onClick={handleViewClick} // Attach click handler to the main div
    >
      <div className={styles.contentPanel}>
        <h3 className={styles.heading}>
          {track.synthesizer.constructor.name}
        </h3>
        
        {/* Render Synthesizer Settings */}
        <div className={styles.settingsContainer}>
          <SynthesizerDetailView track={track} />
        </div>
      </div>

      {/* Separator */}
      <div className={styles.separator}></div>
    </div>
  );
}

export default InstrumentDetailView; 