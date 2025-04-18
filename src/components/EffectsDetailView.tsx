'use client';

import React, { useState } from 'react';
import useStore from '../store/store';
import { Track } from '../lib/types';
import Effect from '../lib/Effect';
import { Property } from '../lib/properties/Property';
import { EffectDefinition } from '../store/effectSlice';
import SliderPropertyControl from './properties/SliderPropertyControl';
import NumberInputPropertyControl from './properties/NumberInputPropertyControl';
import DropdownPropertyControl from './properties/DropdownPropertyControl';
// Assume a ColorPropertyControl exists or add it if needed
// import ColorPropertyControl from './properties/ColorPropertyControl';

interface EffectsDetailViewProps {
  track: Track;
}

function EffectsDetailView({ track }: EffectsDetailViewProps) {
  const { 
    availableEffects, 
    addEffectToTrack, 
    removeEffectFromTrack, 
    updateEffectPropertyOnTrack 
  } = useStore();
  
  const [selectedEffectToAdd, setSelectedEffectToAdd] = useState<string>('');

  // Combine all available effects into a flat list for the dropdown
  const allEffectDefinitions: EffectDefinition[] = Object.values(availableEffects).flat();

  // --- Handler for changing an individual effect property value ---
  const handleEffectPropertyChange = (effectIndex: number, propertyName: string, newValue: any) => {
    updateEffectPropertyOnTrack(track.id, effectIndex, propertyName, newValue);
  };

  // --- Function to render the correct control for an effect property ---
  // Similar to the synthesizer one, but calls updateEffectPropertyOnTrack
  const renderEffectPropertyControl = (effectIndex: number, property: Property<any>) => {
    const key = `${track.id}-effect-${effectIndex}-prop-${property.name}`;
    switch (property.uiType) {
      case 'slider':
        return (
          <SliderPropertyControl 
            key={key}
            property={property as Property<number>} 
            onChange={(value) => handleEffectPropertyChange(effectIndex, property.name, value)} 
          />
        );
      case 'numberInput':
        return (
          <NumberInputPropertyControl 
            key={key}
            property={property as Property<number>} 
            onChange={(value) => handleEffectPropertyChange(effectIndex, property.name, value)} 
          />
        );
      case 'dropdown':
        return (
          <DropdownPropertyControl
            key={key}
            property={property as Property<unknown>} 
            onChange={(value) => handleEffectPropertyChange(effectIndex, property.name, value)} 
          />
        );
      // case 'color': // Example if color property is added
      //   return (
      //     <ColorPropertyControl 
      //       key={key} 
      //       property={property as Property<string>} 
      //       onChange={(value) => handleEffectPropertyChange(effectIndex, property.name, value)} 
      //     />
      //   );
      default:
        return <div key={key}>Unsupported property type: {property.uiType}</div>;
    }
  };

  // --- Get Effect Name (Helper) ---
  // Finds the name from availableEffects based on the instance constructor
  const getEffectName = (effectInstance: Effect): string => {
    for (const category in availableEffects) {
      const definition = availableEffects[category].find(def => effectInstance instanceof def.constructor);
      if (definition) {
        return definition.name;
      }
    }
    return 'Unknown Effect'; // Fallback
  };

  // --- Handler to add the selected effect ---
  const handleAddEffect = () => {
    if (!selectedEffectToAdd) return;
    
    const definition = allEffectDefinitions.find(def => def.id === selectedEffectToAdd);
    if (definition) {
      const newEffectInstance = new definition.constructor();
      addEffectToTrack(track.id, newEffectInstance);
      setSelectedEffectToAdd(''); // Reset dropdown
    }
  };

  return (
    <div>
      <h4>Effects Chain</h4>
      
      {/* List of Active Effects */}
      <div style={{ marginBottom: '20px', border: '1px dashed #444', padding: '10px' }}>
        {(track.effects && track.effects.length > 0) ? (
          track.effects.map((effect, index) => (
            <div key={`${track.id}-effect-${index}`} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: index < track.effects.length - 1 ? '1px solid #333' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <strong>{index + 1}. {getEffectName(effect)}</strong>
                <button 
                  onClick={() => removeEffectFromTrack(track.id, index)} 
                  style={{ padding: '2px 5px', cursor: 'pointer', backgroundColor: '#555', border: 'none', color: '#ddd' }}
                >
                  Remove
                </button>
              </div>
              {/* Render Properties for this effect */}
              {Array.from(effect.properties.values()).length > 0 ? (
                  Array.from(effect.properties.values()).map(prop => renderEffectPropertyControl(index, prop))
              ) : (
                  <div style={{ fontSize: '0.9em', color: '#888' }}>No parameters</div>
              )}
            </div>
          ))
        ) : (
          <div>No effects added.</div>
        )}
      </div>

      {/* Add Effect Controls */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <select
          value={selectedEffectToAdd}
          onChange={(e) => setSelectedEffectToAdd(e.target.value)}
          style={{
            padding: '5px',
            backgroundColor: '#333',
            color: '#ddd',
            border: '1px solid #555',
            marginRight: '10px'
          }}
        >
          <option value="">-- Select Effect --</option>
          {allEffectDefinitions.map(def => (
            <option key={def.id} value={def.id}>{def.name}</option>
          ))}
        </select>
        <button 
          onClick={handleAddEffect} 
          disabled={!selectedEffectToAdd}
          style={{ padding: '5px 10px', cursor: 'pointer' }}
        >
          Add Effect
        </button>
      </div>

    </div>
  );
}

export default EffectsDetailView; 