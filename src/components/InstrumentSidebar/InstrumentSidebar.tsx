import React, { useState, useEffect } from 'react';
import useStore from '../../store/store'; // Import the actual store hook
import { InstrumentDefinition } from '../../store/store'; // Import InstrumentDefinition type if not already

const InstrumentSidebar: React.FC = () => {
  // Select needed state and actions from the store
  const { availableInstruments, selectedTrackId, updateTrack } = useStore();

  // Initialize expanded state based on store data
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() =>
    Object.keys(availableInstruments).reduce((acc, category) => {
      acc[category] = true; // Default to expanded
      return acc;
    }, {} as Record<string, boolean>)
  );

  // Reset expanded state if availableInstruments changes (e.g., dynamic loading)
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
      // Find the instrument definition in the store data
      let selectedInstrumentDef: InstrumentDefinition | null = null;
      for (const category in availableInstruments) {
        const found = availableInstruments[category].find(inst => inst.id === instrumentId);
        if (found) {
          selectedInstrumentDef = found;
          break;
        }
      }

      if (selectedInstrumentDef && selectedInstrumentDef.constructor) {
        // Instantiate the synthesizer using the constructor from the store
        const newSynthesizerInstance = new selectedInstrumentDef.constructor();

        // Call the updateTrack action with the new synthesizer instance
        updateTrack(selectedTrackId, { synthesizer: newSynthesizerInstance });
      } else {
        console.error(`Instrument definition or constructor not found for ID: ${instrumentId}`);
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
                  key={instrument.id} // Use the instrument id from the store data
                  onClick={() => handleInstrumentSelect(instrument.id)} // Pass the instrument id
                  className="instrument-item"
                >
                  {instrument.name} {/* Use the instrument name from the store data */}
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
        }
        .category-section {
          margin-bottom: 10px;
        }
        h4 {
          margin: 5px 0;
          font-weight: bold;
          user-select: none; /* Prevent text selection on click */
        }
        .instrument-list {
          list-style: none;
          padding-left: 20px; /* Indent instrument names */
          margin: 0;
        }
        .instrument-item {
          padding: 4px 0;
          cursor: pointer;
          border-radius: 3px;
        }
        .instrument-item:hover {
          background-color: #e0e0e0;
        }
      `}</style>
    </div>
  );
};

export default InstrumentSidebar; 