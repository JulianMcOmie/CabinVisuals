'use client';

import React from 'react';
import useStore from '../store/store';
import { Track } from '../lib/types';
import SynthesizerDetailView from './SynthesizerDetailView'; // Import the new Synthesizer view
import EffectsDetailView from './EffectsDetailView'; // Import the new Effects view

// Define colors matching page.tsx
const COLORS = {
  accent: "#5a8ea3", // Subtle blue-gray
  highlight: "#c8a45b", // Muted gold/amber
  green: "#6a9955", // Muted green
  background: "#1e1e1e", // Dark background
  surface: "#252525", // Slightly lighter surface
  border: "#3a3a3a", // Border color
  activeBg: "#2d3540", // Active element background
  electricBlue: "#00c3ff", // Vibrant electric blue accent
  selectedBlue: "#e0f7ff", // Whitish blue for selection
  brightGreen: "#00e676", // Bright green for play button hover
  brightYellow: "#ffdd00", // Bright yellow for loop button hover
};

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
        backgroundColor: COLORS.background,
      }} 
      onClick={handleViewClick} // Attach click handler to the main div
    >
      <div 
        style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
        className="rounded-md p-4 border"
      >
        <h3 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1rem' }}>
          {track.synthesizer.constructor.name}
        </h3>
        
        {/* Render Synthesizer Settings */}
        <div className="space-y-6">
          <SynthesizerDetailView track={track} />
        </div>
      </div>

      {/* Separator */}
      <div style={{ height: '20px' }}></div>


    </div>
  );
}

export default InstrumentDetailView;
