'use client';

import React from 'react';
import useStore from '../store/store';

const DetailView: React.FC = () => {
  const { selectedTrackId, selectedBlockId } = useStore();
  
  return (
    <div className="detail-view">
      <h2>Detail View</h2>
      <div className="detail-container">
        <p>TODO: Implement synthesizer settings panel</p>
        <p>TODO: Implement MIDI editor</p>
        <p>TODO: Implement property controls</p>
        {selectedTrackId && <p>Selected track: {selectedTrackId}</p>}
        {selectedBlockId && <p>Selected block: {selectedBlockId}</p>}
      </div>
    </div>
  );
};

export default DetailView; 