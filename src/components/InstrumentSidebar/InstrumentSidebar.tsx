import React, { useState, useEffect } from 'react';
import useStore from '../../store/store'; // Import the actual store hook
import { InstrumentDefinition } from '../../store/store'; // Import InstrumentDefinition type

const InstrumentSidebar: React.FC = () => {
  // Select needed state and actions from the store
  const {
    availableInstruments,
    selectedTrackId,
    updateTrack,
    selectedTrack // Select the currently selected track object
  } = useStore();

  // State to track the ID of the highlighted instrument in the sidebar
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string | null>(null);

  // State for expanded categories (remains the same)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() =>
    Object.keys(availableInstruments).reduce((acc, category) => {
      acc[category] = true; // Default to expanded
      return acc;
    }, {} as Record<string, boolean>)
  );

  // Effect to update highlighted instrument based on the selected track
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

  // Effect to reset expanded state if availableInstruments changes (remains the same)
  useEffect(() => {
    setExpandedCategories(
      Object.keys(availableInstruments).reduce((acc, category) => {
        acc[category] = true; // Default to expanded
        return acc;
      }, {} as Record<string, boolean>)
    );
  }, [availableInstruments]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

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

  return (
    <div className="instrument-sidebar">
      <h3>Instruments</h3>
      {Object.entries(availableInstruments).map(([category, instruments]) => (
        <div key={category} className="category-section">
          <h4 onClick={() => toggleCategory(category)} style={{ cursor: 'pointer' }}>
            {expandedCategories[category] ? '▼' : '▶'} {category}
          </h4>
          {expandedCategories[category] && (
            <ul className="instrument-list">
              {instruments.map((instrument) => (
                <li
                  key={instrument.id}
                  onClick={() => handleInstrumentSelect(instrument.id)}
                  // Apply 'selected' class if this instrument is the selected one
                  className={`instrument-item ${instrument.id === selectedInstrumentId ? 'selected' : ''}`}
                >
                  {instrument.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <style jsx>{`
        .instrument-sidebar {
          padding: 10px;
          height: 100%; /* Fill parent */
          overflow-y: auto;
          border-right: 1px solid #ccc;
          background-color: #f8f8f8; /* Light background for distinction */
          box-sizing: border-box;
        }
        h3 {
          margin-top: 0;
          margin-bottom: 15px;
          border-bottom: 1px solid #eee;
          padding-bottom: 5px;
          color: #000;
        }
        .category-section {
          margin-bottom: 10px;
        }
        h4 {
          margin: 5px 0;
          font-weight: bold;
          user-select: none; /* Prevent text selection on click */
          color: #000;
        }
        .instrument-list {
          list-style: none;
          padding-left: 20px; /* Indent instrument names */
          margin: 0;
        }
        .instrument-item {
          padding: 4px 8px; /* Added some horizontal padding */
          cursor: pointer;
          border-radius: 3px;
          margin: 1px 0; /* Added tiny margin */
          color: #000;
        }
        .instrument-item:hover {
          background-color: #e0e0e0;
        }
        /* Style for the selected instrument */
        .instrument-item.selected {
          background-color: #cce5ff; /* Light blue background */
          font-weight: bold;
          color: #004085; /* Darker blue text */
        }
        .instrument-item.selected:hover {
          background-color: #b8daff; /* Slightly darker blue on hover */
        }
        .instrument-item:hover {
          color: #000;
        }
      `}</style>
    </div>
  );
};

export default InstrumentSidebar; 