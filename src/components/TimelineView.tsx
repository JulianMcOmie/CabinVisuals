'use client';

import React from 'react';
import useStore from '../store/store';

const TimelineView: React.FC = () => {
  const { currentBeat, selectedTrackId, selectedBlockId, trackManager, selectTrack } = useStore();
  
  return (
    <div className="timeline-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ padding: '10px', margin: 0 }}>Timeline & Tracks View</h2>
      <div className="timeline-tracks-container" style={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden' 
      }}>
        <div className="tracks-sidebar" style={{ 
          width: '200px', 
          borderRight: '1px solid #ccc',
          overflowY: 'auto',
          padding: '10px'
        }}>
          <p>TODO: Implement track list with selectable tracks</p>
          <p>TODO: Implement track controls</p>
          <p>TODO: Add ability to create new tracks</p>
          
          {/* Adding extra content to demonstrate scrolling */}
          <div style={{ height: '800px' }}>
            <p>Scroll area for tracks</p>
            <div style={{ marginTop: '400px' }}>
              <p>Scrolled track content</p>
            </div>
          </div>
        </div>
        <div className="timeline-content" style={{ 
          flex: 1, 
          overflowY: 'auto',
          overflowX: 'auto',
          padding: '10px'
        }}>
          <p>TODO: Implement timeline grid with beat markers</p>
          <p>TODO: Implement MIDI block display</p>
          <p>TODO: Implement note editing capabilities</p>
          <p>Current beat: {currentBeat}</p>
          {selectedTrackId && <p>Selected track: {selectedTrackId}</p>}
          {selectedBlockId && <p>Selected block: {selectedBlockId}</p>}
          
          {/* Adding extra content to demonstrate scrolling */}
          <div style={{ width: '2000px', height: '800px' }}>
            <p>Scroll area for timeline</p>
            <div style={{ marginLeft: '1000px', marginTop: '400px' }}>
              <p>Scrolled timeline content</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineView; 