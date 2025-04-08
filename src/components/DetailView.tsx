'use client';

import React from 'react';
import useStore from '../store/store';
import MidiEditor from './MidiEditor';

const DetailView: React.FC = () => {
  const { selectedTrack, selectedBlock } = useStore();

  console.log('selectedBlock', selectedBlock);
  console.log('selectedTrack', selectedTrack);
  
  return (
    <div className="detail-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ padding: '10px', margin: 0 }}>Detail View</h2>
      <div className="detail-container" style={{ flex: 1, overflowY: 'auto', padding: 0, backgroundColor: '#222' }}>
        {selectedBlock && selectedTrack ? (
          <MidiEditor block={selectedBlock} track={selectedTrack} />
        ) : selectedTrack ? (
          <div style={{ padding: '20px', color: '#ddd' }}>
            <p>Track selected: {selectedTrack.name}</p>
            <p>Select a MIDI block to edit</p>
          </div>
        ) : (
          <div style={{ padding: '20px', color: '#ddd' }}>
            <p>Select a track or MIDI block to edit</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailView; 