'use client';

import React, { useRef, useEffect } from 'react';
import useStore from '../store/store';

// InstrumentView component for displaying track information
const InstrumentView: React.FC<{ track: any }> = ({ track }) => {
  return (
    <div className="instrument-view" style={{
      padding: '10px',
      height: '100%',
      borderBottom: '1px solid #ccc',
      display: 'flex',
      alignItems: 'center'
    }}>
      <div>{track.name || 'Untitled Track'}</div>
    </div>
  );
};

// TrackTimelineView component for displaying track timeline
const TrackTimelineView: React.FC<{ track: any }> = ({ track }) => {
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

// MeasuresHeader component for the top row with measure numbers
const MeasuresHeader: React.FC = () => {
  const { seekTo } = useStore();

  const handleMeasureClick = (measure: number) => {
    // Set current beat to the start of the clicked measure (assuming 4 beats per measure)
    seekTo((measure - 1) * 4);
  };

  return (
    <div className="measures-header" style={{
      display: 'flex',
      height: '40px',
      borderBottom: '1px solid #ccc',
      position: 'relative'
    }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div 
          key={i}
          onClick={() => handleMeasureClick(i + 1)}
          style={{
            position: 'absolute',
            left: `${i * 400 + 10}px`,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {i + 1}
        </div>
      ))}
      {/* Grid lines for measures */}
      {Array.from({ length: 32 }).map((_, i) => (
        <div key={`line-${i}`} style={{
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

const TimelineView: React.FC = () => {
  const { currentBeat, trackManager } = useStore();
  const trackListRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);

  // Synchronize vertical scrolling between track list and timeline content
  useEffect(() => {
    const trackListElement = trackListRef.current;
    const timelineContentElement = timelineContentRef.current;
    
    if (!trackListElement || !timelineContentElement) return;
    
    const handleTrackListScroll = () => {
      if (timelineContentElement.scrollTop !== trackListElement.scrollTop) {
        timelineContentElement.scrollTop = trackListElement.scrollTop;
      }
    };
    
    const handleTimelineScroll = () => {
      if (trackListElement.scrollTop !== timelineContentElement.scrollTop) {
        trackListElement.scrollTop = timelineContentElement.scrollTop;
      }
    };
    
    trackListElement.addEventListener('scroll', handleTrackListScroll);
    timelineContentElement.addEventListener('scroll', handleTimelineScroll);
    
    return () => {
      trackListElement.removeEventListener('scroll', handleTrackListScroll);
      timelineContentElement.removeEventListener('scroll', handleTimelineScroll);
    };
  }, []);

  // Get tracks from track manager - fallback to example tracks if none exist
  const tracks = trackManager?.getTracks() || [
    { id: 'track1', name: 'Synth Lead' },
    { id: 'track2', name: 'Bass' },
    { id: 'track3', name: 'Drums' },
    { id: 'track4', name: 'Pad' },
    { id: 'track5', name: 'FX' },
  ];

  return (
    <div className="timeline-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="timeline-container" style={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden'
      }}>
        {/* Track headers column - fixed during horizontal scrolling */}
        <div className="tracks-column" style={{ 
          width: '200px', 
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #ccc',
          overflow: 'hidden'
        }}>
          {/* "Tracks" header */}
          <div className="tracks-header" style={{
            height: '40px',
            padding: '10px',
            fontWeight: 'bold',
            borderBottom: '1px solid #ccc'
          }}>
            Tracks
          </div>
          
          {/* Track list - vertically scrollable */}
          <div 
            ref={trackListRef}
            className="track-list" 
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden'
            }}
          >
            {tracks.map(track => (
              <InstrumentView key={track.id} track={track} />
            ))}
          </div>
        </div>
        
        {/* Timeline content - horizontally and vertically scrollable */}
        <div 
          ref={timelineContentRef}
          className="timeline-content" 
          style={{ 
            flex: 1, 
            overflowY: 'auto',
            overflowX: 'auto'
          }}
        >
          {/* Measures header */}
          <MeasuresHeader />
          
          {/* Track timelines */}
          <div style={{ width: '3200px' }}> {/* Width to accommodate all measures */}
            {tracks.map(track => (
              <TrackTimelineView key={track.id} track={track} />
            ))}
          </div>
        </div>
      </div>
      
      {/* Current beat indicator (optional) */}
      <div style={{ padding: '5px 10px', borderTop: '1px solid #ccc' }}>
        Current beat: {currentBeat}
      </div>
    </div>
  );
};

export default TimelineView; 