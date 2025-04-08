'use client';

import React from 'react';
import useStore from '../store/store';

const TimelineView: React.FC = () => {
  const { currentBeat, selectedTrackId, selectedBlockId } = useStore();
  
  return (
    <div className="timeline-view">
      <h2>Timeline View</h2>
      <div className="timeline-container">
        <p>TODO: Implement timeline grid with beat markers</p>
        <p>TODO: Implement MIDI block display</p>
        <p>TODO: Implement note editing capabilities</p>
        <p>Current beat: {currentBeat}</p>
        {selectedTrackId && <p>Selected track: {selectedTrackId}</p>}
        {selectedBlockId && <p>Selected block: {selectedBlockId}</p>}
      </div>
    </div>
  );
};

export default TimelineView; 