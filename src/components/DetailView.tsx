'use client';

import React from 'react';
import useStore from '../store/store';
import MidiEditor from './MidiEditor';
import InstrumentDetailView from './InstrumentDetailView';

function DetailView() {
  const { selectedTrack, selectedBlock } = useStore();
  
  return (
    <div className="detail-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ padding: '10px', margin: 0 }}>Detail View</h2>
      <div className="detail-container" style={{ flex: 1, overflowY: 'auto', padding: 0, backgroundColor: '#222' }}>
        {selectedBlock && selectedTrack ? (
          <MidiEditor block={selectedBlock} track={selectedTrack} />
        ) : selectedTrack ? (
          <InstrumentDetailView track={selectedTrack} />
        ) : (
          <div style={{ padding: '20px', color: '#ddd' }}>
            <p>Select a track or MIDI block to edit</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DetailView; 