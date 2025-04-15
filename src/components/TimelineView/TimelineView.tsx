'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import useStore from '../../store/store';
import InstrumentView from './InstrumentView';
import TrackTimelineView from './TrackTimelineView';
import MeasuresHeader from './MeasuresHeader';
import BasicSynthesizer from '../../lib/synthesizers/BasicSynthesizer';
import { Track } from '../../lib/types';

// Fixed height for each track
const TRACK_HEIGHT = 50;
const PIXELS_PER_BEAT = 100; // Updated to match MeasuresHeader
const SIDEBAR_WIDTH = 200; // Define sidebar width as a constant

// Color constants
const SIDEBAR_BG_COLOR = '#1a1a1a';
const HEADER_BG_COLOR = 'black';

function TimelineView() {
  const { currentBeat, trackManager, addTrack, selectTrack, seekTo } = useStore();
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null); // Ref for the playhead
  const [isDragging, setIsDragging] = useState(false); // State for dragging

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
  
  // Calculate playhead position
  const playheadPosition = currentBeat * PIXELS_PER_BEAT + SIDEBAR_WIDTH;

  // Mouse move handler for dragging
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !timelineContentRef.current) return;

    const containerRect = timelineContentRef.current.getBoundingClientRect();
    // Calculate mouse X relative to the timeline content container
    const mouseX = event.clientX - containerRect.left;
    
    // Calculate the target beat, ensuring it's not negative
    // Subtract sidebar width before dividing by pixels per beat
    const targetBeat = Math.max(0, (mouseX - SIDEBAR_WIDTH) / PIXELS_PER_BEAT);
    
    seekTo(targetBeat);

  }, [isDragging, seekTo]); // Include dependencies

  // Mouse up handler to stop dragging
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      // Optional: Reset cursor or styles if changed during drag
    }
  }, [isDragging]);

  // Mouse down handler to start dragging
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // Prevent default text selection behavior during drag
    event.preventDefault(); 
    setIsDragging(true);
    // Optional: Set initial styles like cursor
  };

  // Add/Remove global listeners when dragging state changes
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    // Cleanup function to remove listeners if component unmounts while dragging
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Get tracks from track manager
  const tracks = trackManager?.getTracks() || [];
  const totalTracksHeight = tracks.length * TRACK_HEIGHT;

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
          
          {/* Combined content area for instruments and timelines */}
          <div style={{ 
            width: '3200px', // Width to accommodate all measures
            minHeight: '100%', // Ensure it fills vertical space
            paddingTop: '40px', // Space for the MeasuresHeader
            position: 'relative', // Context for absolute positioning of playhead
            display: 'flex', // Use flexbox for side-by-side layout
            height: `${totalTracksHeight}px` // Set explicit height for track area
          }}>
            {/* Instrument Views Column - sticky */}
            <div 
              className="instruments-column"
              style={{
                position: 'sticky', // Make this column sticky
                left: 0, // Stick to the left edge
                width: `${SIDEBAR_WIDTH}px`, // Use constant width
                zIndex: 1, // Above timeline background, below header/playhead
                backgroundColor: SIDEBAR_BG_COLOR, // Match sidebar background
                borderRight: '1px solid #333', // Keep the border
                height: '100%' // Takes full height of the container (totalTracksHeight)
              }}
            >
              {/* Map over tracks to render InstrumentView */}
              {tracks.map(track => (
                <div 
                  key={`${track.id}-instrument`} // Unique key
                  style={{ 
                    height: `${TRACK_HEIGHT}px`, // Use fixed track height
                    borderBottom: '1px solid #333', // Add border between instruments
                    boxSizing: 'border-box'
                  }}
                >
                  <InstrumentView track={track} />
                </div>
              ))}
            </div>

            {/* Single TrackTimelineView for all tracks */}
            <div 
              className="timelines-column"
              style={{
                flex: 1, // Take remaining horizontal space
                position: 'relative', // Needed for positioning blocks correctly
                height: '100%' // Takes full height of the container (totalTracksHeight)
              }}
            >
              <TrackTimelineView tracks={tracks} />
            </div>
          </div>
          
          {/* Message when no tracks exist - Adjust positioning if needed */}
          {tracks.length === 0 && (
            <div style={{ 
              // Position relative to the scrollable container, below header
              position: 'absolute', 
              top: '60px', // Adjust as needed (below header + some padding)
              left: `${SIDEBAR_WIDTH + 20}px`, // Position to the right of the sidebar area
              color: 'white', 
              fontStyle: 'italic' 
            }}>
              Click the + button to add a track
            </div>
          )}

          {/* Playhead - position relative to timeline-content */}
          <div 
            ref={playheadRef} // Assign ref
            className="playhead" 
            onMouseDown={handleMouseDown} // Attach mouse down handler
            style={{
              position: 'absolute',
              top: '40px', // Start below the measures header
              left: `${playheadPosition}px`,
              width: '3px',
              // Height should span the track area OR the visible viewport, 
              // depending on desired behavior. Spanning total track height seems correct.
              height: `calc(${totalTracksHeight}px)`, // Span height of all tracks
              backgroundColor: 'red',
              zIndex: 4, 
              cursor: 'ew-resize' 
            }}
          />
        </div>
      </div>
      
      {/* Current beat indicator - REMOVE TEXT */}
      <div style={{ padding: '5px 10px', borderTop: '1px solid #333', backgroundColor: '#111', color: 'white' }}>
        {/* Current beat: {currentBeat} */}
      </div>
    </div>
  );
}

export default TimelineView;