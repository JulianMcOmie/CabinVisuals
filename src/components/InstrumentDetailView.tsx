'use client';

import React from 'react';
import useStore from '../store/store';
import { Track } from '../lib/types';
import SynthesizerDetailView from './SynthesizerDetailView'; // Import the new Synthesizer view
import EffectsDetailView from './EffectsDetailView'; // Import the new Effects view

interface InstrumentDetailViewProps {
  track: Track;
}

function InstrumentDetailView({ track }: InstrumentDetailViewProps) {
  const { setSelectedWindow } = useStore(); 

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
      style={{
        padding: '20px', 
        color: '#ddd',
      }} 
      onClick={handleViewClick} // Attach click handler to the main div
    >
      <h3>Track Settings: {track.name}</h3>
      
      {/* Render Synthesizer Settings */}
      <SynthesizerDetailView track={track} />

      {/* Separator */}
      <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '20px 0' }} />

      {/* Render Effects Chain Settings */}
      <EffectsDetailView track={track} />

    </div>
  );
}

export default InstrumentDetailView;
