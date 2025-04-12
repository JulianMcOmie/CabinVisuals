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
  const { updateTrack } = useStore(); 

  const handleSynthesizerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSynthKey = event.target.value;
    const selectedOption = synthesizerOptions[selectedSynthKey];

    if (selectedOption && track) {
      const newSynthesizer = new selectedOption.class();
      updateTrack(track.id, { synthesizer: newSynthesizer });
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
