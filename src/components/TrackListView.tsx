'use client';

import React from 'react';
import useStore from '../store/store';

const TrackListView: React.FC = () => {
  const { trackManager, selectedTrackId, selectTrack } = useStore();
  
  return (
    <div className="track-list-view">
      <h2>Track List View</h2>
      <div className="tracks-container">
        <p>TODO: Implement track list with selectable tracks</p>
        {/* TODO: Implement tracks display */}
        {/* TODO: Implement track controls */}
        {/* TODO: Add ability to create new tracks */}
      </div>
    </div>
  );
};

export default TrackListView; 