import React, { useState, useEffect } from 'react';
import useStore from '../../store/store'; // Import the actual store hook
import { InstrumentDefinition } from '@/src/store/instrumentSlice';
import AccordionMenu, { AccordionItem } from '../AccordionMenu/AccordionMenu';
import styles from './InstrumentSidebar.module.css';

const InstrumentSidebar: React.FC = () => {
  const {
    availableInstruments,
    availableEffects,
    selectedTrackId,
    updateTrack,
    selectedTrack,
    setSelectedWindow
  } = useStore();

  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'instruments' | 'effects'>('instruments');

  // Highlight the selected track's instrument
  useEffect(() => {
    if (selectedTrack && selectedTrack.synthesizer) {
      const currentSynthConstructor = selectedTrack.synthesizer.constructor;
      let foundId: string | null = null;
      // Iterate through available instruments to find a match by constructor
      for (const category in availableInstruments) {
        const found = availableInstruments[category].find(inst => inst.constructor === currentSynthConstructor);
        if (found) {
          foundId = found.id;
          break;
        }
      }
      setSelectedInstrumentId(foundId); // Set the found ID or null
    } else {
      setSelectedInstrumentId(null); // No track selected or track has no synthesizer
    }
  }, [selectedTrack, availableInstruments]); // Rerun when selectedTrack or instrument list changes

  const handleInstrumentSelect = (instrumentId: string) => {
    if (selectedTrackId) {
      let selectedInstrumentDef: InstrumentDefinition | null = null;
      for (const category in availableInstruments) {
        const found = availableInstruments[category].find(inst => inst.id === instrumentId);
        if (found) {
          selectedInstrumentDef = found;
          break;
        }
      }

      if (selectedInstrumentDef?.constructor) {
        const newSynthesizerInstance = new selectedInstrumentDef.constructor();
        updateTrack(selectedTrackId, { synthesizer: newSynthesizerInstance });
        // Update the highlighted instrument immediately on click
        setSelectedInstrumentId(instrumentId);
      } else {
        console.error(`Instrument definition or constructor not found for ID: ${instrumentId}`);
        setSelectedInstrumentId(null); // Clear selection if instantiation fails
      }
    } else {
      console.warn('No track selected to assign the instrument to.');
    }
  };

  const handleEffectSelect = (effectId: string) => {
    // For now, just log the selection as per requirement 4
    console.log('Effect selected:', effectId);
  };

  // Function to handle clicks on the sidebar itself
  const handleSidebarClick = () => {
    setSelectedWindow(null);
  };

  // Convert availableInstruments to the format expected by AccordionMenu
  const convertToAccordionItems = (): Record<string, AccordionItem[]> => {
    const result: Record<string, AccordionItem[]> = {};
    
    Object.entries(availableInstruments).forEach(([category, instruments]) => {
      result[category] = instruments.map(instrument => ({
        id: instrument.id,
        name: instrument.name
      }));
    });
    
    return result;
  };

  // Convert availableEffects to the format expected by AccordionMenu
  const convertEffectsToAccordionItems = (): Record<string, AccordionItem[]> => {
    const result: Record<string, AccordionItem[]> = {};
    
    Object.entries(availableEffects).forEach(([category, effects]) => {
      result[category] = effects.map(effect => ({
        id: effect.id,
        name: effect.name
      }));
    });
    
    return result;
  };

  return (
    <div className={styles.container}>
        <div
            className={styles.header}
        >
            <div className={styles.headerPadding}>
            <div className={styles.libraryHeader}>
                <span className={styles.libraryLabel}>Library</span>
            </div>
            <div className={styles.buttonGroup}>
                <button
                className={`${styles.button} ${activeTab === 'instruments' ? styles.buttonActive : styles.buttonInactive}`}
                onClick={() => setActiveTab('instruments')}
                >
                Instruments
                </button>
                <button
                className={`${styles.button} ${activeTab === 'effects' ? styles.buttonActive : styles.buttonInactive}`}
                onClick={() => setActiveTab('effects')}
                >
                Effects
                </button>
            </div>
            </div>
        </div>

      {activeTab === 'instruments' ? (
        <AccordionMenu
          categories={convertToAccordionItems()}
          selectedItemId={selectedInstrumentId}
          onItemSelect={handleInstrumentSelect}
          onMenuClick={handleSidebarClick}
          title="Instruments"
          defaultExpanded={true}
        />
      ) : (
        <AccordionMenu
          categories={convertEffectsToAccordionItems()}
          selectedItemId={null}
          onItemSelect={handleEffectSelect}
          onMenuClick={handleSidebarClick}
          title="Effects"
          defaultExpanded={true}
        />
      )}
    </div>
  );
};

export default InstrumentSidebar; 