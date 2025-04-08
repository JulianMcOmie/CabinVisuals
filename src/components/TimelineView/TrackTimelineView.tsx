import React from 'react';

interface TrackTimelineViewProps {
  track: any;
}

const TrackTimelineView: React.FC<TrackTimelineViewProps> = ({ track }) => {
  return (
    <div className="track-timeline-view" style={{
      height: '100%',
      borderBottom: '1px solid #ccc',
      position: 'relative'
    }}>
      {/* Grid lines - render vertical lines for measures */}
      {Array.from({ length: 32 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${i * 100}px`,
          top: 0,
          bottom: 0,
          width: '1px',
          backgroundColor: i % 4 === 0 ? '#888' : '#ddd'
        }} />
      ))}
    </div>
  );
};

export default TrackTimelineView; 