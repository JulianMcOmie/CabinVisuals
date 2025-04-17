'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import useStore from '../../store/store';
import InstrumentView from './InstrumentView';
import TrackTimelineView from './TrackTimelineView';
import MeasuresHeader from './MeasuresHeader';
import BasicSynthesizer from '../../lib/synthesizers/BasicSynthesizer';
import { Track } from '../../lib/types';

// Fixed height for each track
const TRACK_HEIGHT_BASE = 50; // Renamed base height
const PIXELS_PER_BEAT_BASE = 100; // Renamed base pixels per beat
const SIDEBAR_WIDTH = 200; // Define sidebar width as a constant

// Color constants
const SIDEBAR_BG_COLOR = '#1a1a1a';
const HEADER_BG_COLOR = 'black';

function TimelineView() {
  const { currentBeat, tracks, addTrack, selectTrack, seekTo } = useStore();
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0); // State for horizontal scroll position
  const [scrollTop, setScrollTop] = useState(0); // State for vertical scroll position
  const [horizontalZoom, setHorizontalZoom] = useState(1); // Initial horizontal zoom
  const [verticalZoom, setVerticalZoom] = useState(1); // Initial vertical zoom

  // Calculate effective values based on zoom
  const effectiveTrackHeight = TRACK_HEIGHT_BASE * verticalZoom;
  const effectivePixelsPerBeat = PIXELS_PER_BEAT_BASE * horizontalZoom;

  // Handle adding a new track
  const handleAddTrack = () => {
    const trackNumber = tracks.length + 1 || 1;
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `Track ${trackNumber}`,
      midiBlocks: [],
      synthesizer: new BasicSynthesizer()
    };
    
    addTrack(newTrack);
    selectTrack(newTrack.id);
  };
  
  // Calculate playhead position based on beat, zoom AND scroll
  // Base position relative to the start of the timeline area (after sidebar)
  const basePlayheadOffset = currentBeat * effectivePixelsPerBeat; // Use effective value
  // Adjust for the current horizontal scroll and add sidebar width for final CSS `left`
  const playheadLeftStyle = SIDEBAR_WIDTH + basePlayheadOffset - scrollLeft;

  // Mouse move handler for dragging - needs to account for scroll and zoom
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !timelineContentRef.current) return;

    const containerRect = timelineContentRef.current.getBoundingClientRect();
    // Calculate mouse X relative to the timeline content container's *visible* area
    const mouseXRelative = event.clientX - containerRect.left;
    // Add the current scrollLeft to get the mouse position within the *scrolled content*
    const mouseXInScrolledContent = mouseXRelative + timelineContentRef.current.scrollLeft;
    
    // Calculate the target beat, subtracting sidebar width, ensuring it's not negative
    const targetBeat = Math.max(0, (mouseXInScrolledContent - SIDEBAR_WIDTH) / effectivePixelsPerBeat); // Use effective value
    
    seekTo(targetBeat);

  }, [isDragging, seekTo, effectivePixelsPerBeat]);

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

  // Handler for scroll events on the timeline content
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(event.currentTarget.scrollLeft);
    setScrollTop(event.currentTarget.scrollTop);
  };

  // Handler for wheel events (zoom)
  const handleWheel = useCallback((event: WheelEvent) => {
    if (event.altKey) {
      event.preventDefault(); // Prevent default scroll behavior when zooming

      // Vertical Zoom (unchanged - multiplicative)
      const verticalZoomFactor = 1.1;
      if (event.deltaY < 0) {
        // Zoom in vertically
        setVerticalZoom(prev => Math.min(prev * verticalZoomFactor, 10)); // Max zoom 10x
      } else if (event.deltaY > 0) {
        // Zoom out vertically
        setVerticalZoom(prev => Math.max(prev / verticalZoomFactor, 0.1)); // Min zoom 0.1x
      }

      // Horizontal Zoom (changed - linear step based on deltaX)
      if (event.deltaX !== 0) {
        // Define a sensitivity factor for horizontal zoom adjustment
        const horizontalZoomSensitivity = 0.005; // Adjust this value for desired speed
        // Calculate the change in zoom based on deltaX
        // Negative deltaX (scroll left/up) zooms in (increases zoom value)
        // Positive deltaX (scroll right/down) zooms out (decreases zoom value)
        const deltaZoom = -event.deltaX * horizontalZoomSensitivity;

        // Update horizontal zoom additively, clamping between min/max values
        setHorizontalZoom(prev => Math.max(0.1, Math.min(prev + deltaZoom, 10)));
      }
    }
    // Allow normal scrolling if Alt key is not pressed
  }, []); // Dependencies remain empty as sensitivity is constant

  // Attach wheel listener to the timeline content area
  useEffect(() => {
    const timelineElement = timelineContentRef.current;
    if (timelineElement) {
      timelineElement.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        timelineElement.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleWheel]);

  // Get tracks from track manager
  const totalTracksHeight = tracks.length * effectiveTrackHeight; // Use effective height

  return (
    <div className="timeline-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Timeline container */}
      <div className="timeline-container" style={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden',
        position: 'relative' // Added for absolute positioning of playhead
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
          onScroll={handleScroll}
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
            <MeasuresHeader
              horizontalZoom={horizontalZoom}
              pixelsPerBeatBase={PIXELS_PER_BEAT_BASE}
            />
          </div>
          
          {/* Combined content area for instruments and timelines */}
          <div style={{ 
            // Adjust width based on measures and zoom
            width: `${(useStore.getState().numMeasures * 4 * effectivePixelsPerBeat)}px`, 
            minHeight: '100%', // Ensure it fills vertical space
            position: 'relative', // Context for absolute positioning of playhead
            display: 'flex', // Use flexbox for side-by-side layout
            height: `${totalTracksHeight}px` // Set explicit height for track area based on zoom
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
                    height: `${effectiveTrackHeight}px`, // Use effective track height
                    borderBottom: '1px solid #333', // Add border between instruments
                    boxSizing: 'border-box'
                  }}
                >
                  <InstrumentView 
                    track={track} 
                    // Pass verticalZoom if needed, or let it use effectiveTrackHeight for layout
                  />
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
              <TrackTimelineView 
                tracks={tracks} 
                horizontalZoom={horizontalZoom}
                verticalZoom={verticalZoom}
                pixelsPerBeatBase={PIXELS_PER_BEAT_BASE} // Pass base value
                trackHeightBase={TRACK_HEIGHT_BASE} // Pass base value
              />
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
        </div>

        {/* Playhead - positioned relative to timeline-container, left style adjusted by scroll */}
        <div 
          ref={playheadRef} // Assign ref
          className="playhead"
          onMouseDown={handleMouseDown} // Attach mouse down handler
          style={{
            position: 'absolute',
            top: '40px',
            // Use the dynamically calculated style
            left: `${playheadLeftStyle}px`,
            width: '3px',
            height: 'calc(100% - 40px)',
            backgroundColor: 'red',
            zIndex: 10,
            cursor: 'ew-resize',
            pointerEvents: 'auto'
          }}
        />
      </div>
      
      {/* Current beat indicator - REMOVE TEXT */}
      <div style={{ padding: '5px 10px', borderTop: '1px solid #333', backgroundColor: '#111', color: 'white' }}>
        {/* Current beat: {currentBeat} */}
      </div>
    </div>
  );
}

export default TimelineView;