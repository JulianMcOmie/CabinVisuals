'use client';

import React, { useRef, useState } from 'react';
import useStore from '../../store/store';
import InstrumentView from './InstrumentView';
import TrackTimelineView from './TrackTimelineView';
import MeasuresHeader from './MeasuresHeader';
import BasicSynthesizer from '../../lib/synthesizers/BasicSynthesizer';
import { Track } from '../../lib/types';

// Fixed height for each track
const TRACK_HEIGHT = 50;

// Color constants
const SIDEBAR_BG_COLOR = '#1a1a1a';
const HEADER_BG_COLOR = 'black';

const TimelineView: React.FC = () => {
  const { currentBeat, trackManager, addTrack, selectTrack } = useStore();
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const [trackHeight, setTrackHeight] = useState(TRACK_HEIGHT);

  // Handle adding a new track
  const handleAddTrack = () => {
    const trackNumber = trackManager?.getTracks().length + 1 || 1;
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `Track ${trackNumber}`,
      midiBlocks: [],
      synthesizer: new BasicSynthesizer()
    };
    
    addTrack(newTrack);
    selectTrack(newTrack.id);
  };

  // Get tracks from track manager - fallback to example tracks if none exist
  const tracks = trackManager?.getTracks() || [];

  return (
    <div className="timeline-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Timeline container */}
      <div className="timeline-container" style={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden'
      }}>
        {/* Tracks header - fixed at top-left */}
        <div style={{
          position: 'absolute',
          width: '200px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          fontWeight: 'bold',
          borderBottom: '1px solid #333',
          borderRight: '1px solid #333',
          backgroundColor: SIDEBAR_BG_COLOR,
          zIndex: 3,
          color: 'white',
          boxSizing: 'border-box'
        }}>
          <span>Tracks</span>
          <button 
            onClick={handleAddTrack}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              fontWeight: 'bold',
              color: 'white'
            }}
            title="Add new track"
          >
            +
          </button>
        </div>
        
        {/* Main scrollable area */}
        <div 
          ref={timelineContentRef}
          className="timeline-content" 
          style={{ 
            flex: 1, 
            overflowY: 'auto',
            overflowX: 'auto',
            position: 'relative',
            backgroundColor: '#111'
          }}
        >
          {/* Fixed sidebar background that extends full height */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: '40px', // Start below the header
            bottom: 0,
            width: '200px',
            backgroundColor: SIDEBAR_BG_COLOR,
            borderRight: '1px solid #333',
            zIndex: 0
          }} />
          
          {/* Measures header - sticky at top */}
          <div style={{ 
            position: 'sticky', 
            top: 0, 
            paddingLeft: '200px', // Space for instrument column
            zIndex: 2,
            backgroundColor: HEADER_BG_COLOR
          }}>
            <MeasuresHeader />
          </div>
          
          {/* Track content area */}
          <div style={{ 
            width: '3200px', // Width to accommodate all measures
            minHeight: '100%',
            paddingTop: '0', // No need for padding as header is sticky
            position: 'relative'
          }}>
            {/* Track rows */}
            {tracks.map(track => (
              <div 
                key={track.id} 
                className="track-row"
                style={{ 
                  height: `${trackHeight}px`,
                  position: 'relative',
                  display: 'flex'
                }}
              >
                {/* Instrument view - sticky at left */}
                <div style={{
                  position: 'sticky',
                  left: 0,
                  width: '200px',
                  height: '100%',
                  zIndex: 1,
                  backgroundColor: SIDEBAR_BG_COLOR,
                  borderRight: '1px solid #333',
                  boxSizing: 'border-box'
                }}>
                  <InstrumentView track={track} />
                </div>
                
                {/* Timeline view for the track */}
                <div style={{ flex: 1 }}>
                  <TrackTimelineView track={track} />
                </div>
              </div>
            ))}
            
            {/* Show message when no tracks exist */}
            {tracks.length === 0 && (
              <div style={{
                padding: '20px 0 0 220px',
                color: 'white',
                fontStyle: 'italic'
              }}>
                Click the + button to add a track
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Current beat indicator */}
      <div style={{ padding: '5px 10px', borderTop: '1px solid #333', backgroundColor: '#111', color: 'white' }}>
        Current beat: {currentBeat}
      </div>
    </div>
  );
};

export default TimelineView;