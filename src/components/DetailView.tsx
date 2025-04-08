'use client';

import React from 'react';
import useStore from '../store/store';

const DetailView: React.FC = () => {
  const { selectedTrackId, selectedBlockId } = useStore();
  
  return (
    <div className="detail-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ padding: '10px', margin: 0 }}>Detail View</h2>
      <div className="detail-container" style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        <p>TODO: Implement synthesizer settings panel</p>
        <p>TODO: Implement MIDI editor</p>
        <p>TODO: Implement property controls</p>
        {selectedTrackId && <p>Selected track: {selectedTrackId}</p>}
        {selectedBlockId && <p>Selected block: {selectedBlockId}</p>}
        
        {/* Adding extra content to demonstrate scrolling */}
        <div style={{ height: '800px' }}>
          <p>Scroll area</p>
          <div style={{ marginTop: '400px' }}>
            <p>Scrolled content</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailView; 