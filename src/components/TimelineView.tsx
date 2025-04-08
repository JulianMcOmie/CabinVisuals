'use client';

import React from 'react';
import useStore from '../store/store';

const TimelineView: React.FC = () => {
  const { currentBeat, selectedTrackId, selectedBlockId, trackManager, selectTrack } = useStore();
  
  return (
    <div className="timeline-view">
      <h2>Timeline & Tracks View</h2>
      <div className="timeline-tracks-container">
        <div className="tracks-sidebar">
          <p>TODO: Implement track list with selectable tracks</p>
          <p>TODO: Implement track controls</p>
          <p>TODO: Add ability to create new tracks</p>
        </div>
        <div className="timeline-content">
          <p>TODO: Implement timeline grid with beat markers</p>
          <p>TODO: Implement MIDI block display</p>
          <p>TODO: Implement note editing capabilities</p>
          <p>Current beat: {currentBeat}</p>
          {selectedTrackId && <p>Selected track: {selectedTrackId}</p>}
          {selectedBlockId && <p>Selected block: {selectedBlockId}</p>}
        </div>
      </div>
    </div>
  );
};

export default TimelineView; 