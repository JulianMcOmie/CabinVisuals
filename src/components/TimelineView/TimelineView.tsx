'use client';

import React, { useRef, useEffect } from 'react';
import useStore from '../../store/store';
import InstrumentView from './InstrumentView';
import TrackTimelineView from './TrackTimelineView';
import MeasuresHeader from './MeasuresHeader';
import BasicSynthesizer from '../../lib/synthesizers/BasicSynthesizer';

const TimelineView: React.FC = () => {
  const { currentBeat, trackManager, addTrack } = useStore();
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

  // Handle adding a new track
  const handleAddTrack = () => {
    const trackNumber = trackManager?.getTracks().length + 1 || 1;
    addTrack({
      id: `track-${Date.now()}`,
      name: `Track ${trackNumber}`,
      midiBlocks: [],
      synthesizer: new BasicSynthesizer()
    });
  };

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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
            fontWeight: 'bold',
            borderBottom: '1px solid #ccc'
          }}>
            <span>Tracks</span>
            <button 
              onClick={handleAddTrack}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
              title="Add new track"
            >
              +
            </button>
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