'use client';

import React from 'react';
import useStore from '../store/store';
import { Track } from '../lib/types';
import Synthesizer from '../lib/Synthesizer';
import BasicSynthesizer from '../lib/synthesizers/BasicSynthesizer';
import MelodicOrbitSynth from '../lib/synthesizers/MelodicOrbitSynth';
import KickDrumSynth from '../lib/synthesizers/KickDrumSynth';
import SnareDrumSynth from '../lib/synthesizers/SnareDrumSynth';
import ShakerSynth from '../lib/synthesizers/ShakerSynth';
import HiHatSynth from '../lib/synthesizers/HiHatSynth';
import SineWaveSynth from '../lib/synthesizers/SineWaveSynth';
import BackgroundPlaneSynth from '../lib/synthesizers/BackgroundPlaneSynth';
import ApproachingCubeSynth from '../lib/synthesizers/ApproachingCubeSynth';
import { Property } from '../lib/properties/Property';
import SliderPropertyControl from './properties/SliderPropertyControl';
import NumberInputPropertyControl from './properties/NumberInputPropertyControl';
import DropdownPropertyControl from './properties/DropdownPropertyControl';

interface InstrumentDetailViewProps {
  track: Track;
}

// Map synthesizer types to their classes and display names
const synthesizerOptions: { [key: string]: { class: new () => Synthesizer, name: string } } = {
  basic: { class: BasicSynthesizer, name: 'Basic Synth' },
  // Add the new synthesizers
  melodicOrbit: { class: MelodicOrbitSynth, name: 'Melodic Orbit' },
  kickDrum: { class: KickDrumSynth, name: 'Kick Drum' },
  snareDrum: { class: SnareDrumSynth, name: 'Snare Drum' },
  shaker: { class: ShakerSynth, name: 'Shaker' },
  hiHat: { class: HiHatSynth, name: 'Hi-Hat' },
  sineWave: { class: SineWaveSynth, name: 'Sine Wave' },
  backgroundPlane: { class: BackgroundPlaneSynth, name: 'Background Plane' },
  // Add the new synthesizer
  approachingCube: { class: ApproachingCubeSynth, name: 'Approaching Cube' },
};

function InstrumentDetailView({ track }: InstrumentDetailViewProps) {
  const { updateTrack } = useStore(); 
  const synthesizer = track.synthesizer; // Get current synthesizer

  // --- Handler for changing the main synthesizer type ---
  const handleSynthesizerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSynthKey = event.target.value;
    const selectedOption = synthesizerOptions[selectedSynthKey];

    if (selectedOption && track) {
      const newSynthesizer = new selectedOption.class();
      // When changing synth type, we replace the whole synth instance
      updateTrack(track.id, { synthesizer: newSynthesizer });
    }
  };

  // --- Handler for changing an individual property value ---
  const handlePropertyChange = (propertyName: string, newValue: any) => {
    if (!synthesizer) return;

    // Clone the synthesizer
    const clonedSynth = synthesizer.clone();
    
    // Set the value on the clone
    clonedSynth.setPropertyValue(propertyName, newValue);
    
    // Update the track with the cloned synthesizer
    updateTrack(track.id, { synthesizer: clonedSynth });
  };

  // Determine the current synthesizer key for the dropdown
  const currentSynthKey = Object.keys(synthesizerOptions).find(key => 
    synthesizer instanceof synthesizerOptions[key].class
  ) || 'basic'; // Default to basic if not found

  // --- Function to render the correct control for a property ---
  const renderPropertyControl = (property: Property<any>) => {
    switch (property.uiType) {
      case 'slider':
        return (
          <SliderPropertyControl 
            key={property.name}
            property={property as Property<number>} 
            onChange={(value) => handlePropertyChange(property.name, value)} 
          />
        );
      case 'numberInput':
        return (
          <NumberInputPropertyControl 
            key={property.name}
            property={property as Property<number>} 
            onChange={(value) => handlePropertyChange(property.name, value)} 
          />
        );
      case 'dropdown':
        // Need to cast to Property<unknown> for generic Dropdown control
        return (
          <DropdownPropertyControl
            key={property.name}
            property={property as Property<unknown>} 
            onChange={(value) => handlePropertyChange(property.name, value)} 
          />
        );
      default:
        return <div key={property.name}>Unsupported property type: {property.uiType}</div>;
    }
  };

  return (
    <div style={{ padding: '20px', color: '#ddd' }}>
      <h3>Instrument Settings: {track.name}</h3>
      
      {/* Synthesizer Type Selector */}
      <div style={{ marginBottom: '20px' }}>
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

      {/* Dynamically Rendered Property Controls */}
      <div style={{ borderTop: '1px solid #444', paddingTop: '15px' }}>
        <h4>Parameters:</h4>
        {synthesizer && Array.from(synthesizer.properties.values()).map((property: Property<any>) => renderPropertyControl(property))}
        {!synthesizer && <div>No synthesizer selected.</div>}
      </div>

    </div>
  );
}

export default InstrumentDetailView;
