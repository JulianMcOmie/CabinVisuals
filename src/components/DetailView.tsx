'use client';

import React from 'react';
import useStore from '../store/store';
import MidiEditor from './MidiEditor';
import InstrumentDetailView from './InstrumentDetailView';

function DetailView() {
  const { selectedTrack, selectedBlock, selectedWindow } = useStore();
  
  const isMidiEditorVisible = selectedBlock && selectedTrack;

  return (
    <div 
      className="detail-view" 
      style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        boxSizing: 'border-box',
        border: selectedWindow === 'midiEditor' && isMidiEditorVisible
          ? '2px solid rgba(74, 144, 226, 0.5)'
          : '2px solid transparent'
      }}
    >
      <h2 style={{ padding: '10px', margin: 0 }}>Detail View</h2>
      <div 
        className="detail-container" 
        style={{ 
          flex: 1, 
          overflow: 'hidden',
          padding: 0, 
          backgroundColor: '#222' 
        }}
      >
        {isMidiEditorVisible ? (
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