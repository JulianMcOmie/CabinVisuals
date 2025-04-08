'use client';

import React, { useRef, useState } from 'react';
import useStore from '../../store/store';
import InstrumentView from './InstrumentView';
import TrackTimelineView from './TrackTimelineView';
import MeasuresHeader from './MeasuresHeader';
import BasicSynthesizer from '../../lib/synthesizers/BasicSynthesizer';

// Fixed height for each track
const TRACK_HEIGHT = 50;

const TimelineView: React.FC = () => {
  const { currentBeat, trackManager, addTrack } = useStore();
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const [trackHeight, setTrackHeight] = useState(TRACK_HEIGHT);

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
          borderBottom: '1px solid #ccc',
          borderRight: '1px solid #ccc',
          backgroundColor: 'black',
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
            position: 'relative'
          }}
        >
          {/* Measures header - sticky at top */}
          <div style={{ 
            position: 'sticky', 
            top: 0, 
            paddingLeft: '200px', // Space for instrument column
            zIndex: 2,
            backgroundColor: 'black'
          }}>
            <MeasuresHeader />
          </div>
          
          {/* Track content area */}
          <div style={{ 
            width: '3200px', // Width to accommodate all measures
            minHeight: '100%',
            paddingTop: '0' // No need for padding as header is sticky
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
                  backgroundColor: 'black',
                  borderRight: '1px solid #ccc',
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
          </div>
        </div>
      </div>
      
      {/* Current beat indicator */}
      <div style={{ padding: '5px 10px', borderTop: '1px solid #ccc' }}>
        Current beat: {currentBeat}
      </div>
    </div>
  );
};

export default TimelineView; 