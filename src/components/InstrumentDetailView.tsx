'use client';

import React from 'react';
import useStore from '../store/store';
import { Track, Synthesizer } from '../lib/types';
import BasicSynthesizer from '../lib/synthesizers/BasicSynthesizer';
import DrumSynthesizer from '../lib/synthesizers/DrumSynthesizer';

interface InstrumentDetailViewProps {
  track: Track;
}

// Map synthesizer types to their classes and display names
const synthesizerOptions: { [key: string]: { class: new () => Synthesizer, name: string } } = {
  basic: { class: BasicSynthesizer, name: 'Basic Synth' },
  drum: { class: DrumSynthesizer, name: 'Drum Synth' }
};

function InstrumentDetailView({ track }: InstrumentDetailViewProps) {
  // Need a way to update the track's synthesizer in the store
  // Let's assume an updateTrack action exists or add it later.
  // For now, we'll just log the selection.
  // const { updateTrack } = useStore(); 

  const handleSynthesizerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSynthKey = event.target.value;
    const selectedOption = synthesizerOptions[selectedSynthKey];

    if (selectedOption && track) {
      console.log(`Track ${track.id}: Changing synthesizer to ${selectedOption.name}`);
      // Create a new instance of the selected synthesizer
      const newSynthesizer = new selectedOption.class();
      
      // --- TODO: Update track in store --- 
      // This requires an `updateTrack` action in zustand store
      // const updatedTrack = { ...track, synthesizer: newSynthesizer };
      // updateTrack(updatedTrack);
      alert(`Synthesizer changed to ${selectedOption.name}. Store update needed.`); // Placeholder
    }
  };

  // Determine the current synthesizer key
  const currentSynthKey = Object.keys(synthesizerOptions).find(key => 
    track.synthesizer instanceof synthesizerOptions[key].class
  ) || 'basic'; // Default to basic if not found

  return (
    <div style={{ padding: '20px', color: '#ddd' }}>
      <h3>Instrument Settings: {track.name}</h3>
      
      <div style={{ marginTop: '15px' }}>
        <label htmlFor="synthesizer-select" style={{ marginRight: '10px' }}>Synthesizer:</label>
        <select 
          id="synthesizer-select"
          value={currentSynthKey}
          onChange={handleSynthesizerChange}
          style={{
            padding: '5px',
            backgroundColor: '#333',
            color: '#ddd',
            border: '1px solid #555'
          }}
        >
          {Object.entries(synthesizerOptions).map(([key, option]) => (
            <option key={key} value={key}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      {/* Add more instrument-specific controls here later */}
    </div>
  );
}

export default InstrumentDetailView;
