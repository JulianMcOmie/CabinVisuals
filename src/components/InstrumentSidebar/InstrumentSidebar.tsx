import React, { useState, useEffect } from 'react';
import useStore from '../../store/store'; // Import the actual store hook
import { InstrumentDefinition } from '@/src/store/instrumentSlice';
import AccordionMenu, { AccordionItem } from '../AccordionMenu';
import { COLORS } from '../colors';

const InstrumentSidebar: React.FC = () => {
  const {
    availableInstruments,
    selectedTrackId,
    updateTrack,
    selectedTrack,
    setSelectedWindow
  } = useStore();

  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col h-full">
        <div
            className="sticky top-0 z-10 border-b"
            style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
        >
            <div className="p-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-medium">Library</span>
            </div>
            <div className="flex rounded-md overflow-hidden border" style={{ borderColor: COLORS.border }}>
                <button
                className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
                    true// sidebarView === "instruments"
                    ? "bg-[#3a3a3a] text-white"
                    : "bg-[#252525] text-gray-300 hover:bg-[#333]"
                }`}
                onClick={() => {}}
                >
                Instruments
                </button>
                <button
                className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
                    true// sidebarView === "effects"
                    ? "bg-[#3a3a3a] text-white"
                    : "bg-[#252525] text-gray-300 hover:bg-[#333]"
                }`}
                onClick={() => {}}
                >
                Effects
                </button>
            </div>
            </div>
        </div>

      <AccordionMenu
        categories={convertToAccordionItems()}
        selectedItemId={selectedInstrumentId}
        onItemSelect={handleInstrumentSelect}
        onMenuClick={handleSidebarClick}
        title="Instruments"
        defaultExpanded={true}
      />
    </div>
  );
};

export default InstrumentSidebar; 