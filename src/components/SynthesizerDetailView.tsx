'use client';

import React from 'react';
import useStore from '../store/store';
import { Track } from '../lib/types';
import { Property } from '../lib/properties/Property';

// Import Property Controls
import SliderPropertyControl from './properties/SliderPropertyControl';
import NumberInputPropertyControl from './properties/NumberInputPropertyControl';
import DropdownPropertyControl from './properties/DropdownPropertyControl';
import ColorPropertyControl from './properties/ColorPropertyControl';
import ColorRangePropertyControl from './properties/ColorRangePropertyControl'; // Import the new control
import { InstrumentDefinition } from '../store/instrumentSlice'; // Import InstrumentDefinition
import { ColorRange } from '../lib/types'; // Import ColorRange type

interface SynthesizerDetailViewProps {
  track: Track;
}

function SynthesizerDetailView({ track }: SynthesizerDetailViewProps) {
  const { updateTrack, availableInstruments } = useStore(); 
  const synthesizer = track.synthesizer; // Get current synthesizer

  // Combine all available instruments into a flat list for the dropdown
  const allInstrumentDefinitions: InstrumentDefinition[] = Object.values(availableInstruments).flat();

  // --- Handler for changing the main synthesizer type ---  
  const handleSynthesizerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSynthId = event.target.value;
    const definition = allInstrumentDefinitions.find(def => def.id === selectedSynthId);

    if (definition && track) {
      const newSynthesizer = new definition.constructor();
      updateTrack(track.id, { synthesizer: newSynthesizer });
    }
  };

  // --- Handler for changing an individual property value ---
  const handlePropertyChange = (propertyName: string, value: any) => {
    const newSynth = track.synthesizer.clone();
    newSynth.setPropertyValue(propertyName, value);
    updateTrack(track.id, { synthesizer: newSynth });
  };

  // --- Function to render the correct control for a property ---
  const renderPropertyControl = (property: Property<any>) => {
    const key = `${track.id}-synth-prop-${property.name}`;
    let control: React.ReactNode = null;

    switch (property.metadata.uiType) { // Use metadata.uiType
      case 'slider':
        control = (
          <SliderPropertyControl 
            key={key}
            property={property as Property<number>} 
            onChange={(value) => handlePropertyChange(property.name, value)} 
          />
        );
        break;
      case 'numberInput':
        control = (
          <NumberInputPropertyControl 
            key={key}
            property={property as Property<number>} 
            onChange={(value) => handlePropertyChange(property.name, value)} 
          />
        );
        break;
      case 'dropdown':
        control = (
          <DropdownPropertyControl
            key={key}
            property={property as Property<unknown>} 
            onChange={(value) => handlePropertyChange(property.name, value)} 
          />
        );
        break;
      case 'color':
        control = (
          <ColorPropertyControl
            key={key}
            property={property as Property<string>} 
            onChange={(value) => handlePropertyChange(property.name, value)} 
          />
        );
        break;
      case 'colorRange': 
        control = (
          <ColorRangePropertyControl
            key={key}
            property={property as Property<ColorRange>}
            onChange={(value) => handlePropertyChange(property.name, value)}
          />
        );
        break;
      default:
        // Cast metadata to any to display the uiType in the error message
        control = <div key={key}>Unsupported property type: {(property.metadata as any).uiType}</div>;
    }
    return control;
  };

  // --- Render the list of properties ---
  const properties = Array.from(track.synthesizer.properties.values());

  return (
    <div style={{ marginBottom: '30px' }}>
      {/* Dynamically Rendered Property Controls */}
      <div>
        <h5>Parameters:</h5>
        {synthesizer && Array.from(synthesizer.properties.values()).length > 0 ? (
          Array.from(synthesizer.properties.values()).map((property: Property<any>) => renderPropertyControl(property))
        ) : (
          synthesizer ? <div>No parameters for this synthesizer.</div> : <div>No synthesizer selected.</div>
        )}
      </div>

    </div>
  );
}

export default SynthesizerDetailView; 