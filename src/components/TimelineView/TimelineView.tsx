'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import useStore from '../../store/store';
import InstrumentsView from './InstrumentsView';
import TrackTimelineView from './TrackTimelineView';
import MeasuresHeader from './MeasuresHeader';
import BasicSynthesizer from '../../lib/synthesizers/BasicSynthesizer';
import { Track } from '../../lib/types';

// Fixed height for each track
const TRACK_HEIGHT_BASE = 50; // Renamed base height
const PIXELS_PER_BEAT_BASE = 100; // Renamed base pixels per beat
const SIDEBAR_WIDTH = 200; // Define sidebar width as a constant
const MIN_VIEWPORT_MEASURES = 8; // Minimum measures to allow zooming out to see
const EXTRA_RENDER_MEASURES = 1; // Render this many extra measures beyond content or min viewport

// Color constants
const SIDEBAR_BG_COLOR = '#1a1a1a';
const HEADER_BG_COLOR = 'black';

function TimelineView() {
  const { 
    currentBeat, 
    tracks, 
    addTrack, 
    selectTrack, 
    seekTo, 
    setSelectedWindow,
    selectedWindow
  } = useStore();
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
    setSelectedWindow('timelineView'); // Set window on add track
  };
  
  // Calculate playhead position based on beat, zoom AND scroll
  const basePlayheadOffset = currentBeat * effectivePixelsPerBeat; // Use effective value
  const playheadLeftStyle = SIDEBAR_WIDTH + basePlayheadOffset - scrollLeft;

  // Mouse move handler for dragging - needs to account for scroll and zoom
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !timelineContentRef.current) return;

    const containerRect = timelineContentRef.current.getBoundingClientRect();
    const mouseXRelative = event.clientX - containerRect.left;
    const mouseXInScrolledContent = mouseXRelative + timelineContentRef.current.scrollLeft;
    
    const targetBeat = Math.max(0, (mouseXInScrolledContent - SIDEBAR_WIDTH) / effectivePixelsPerBeat);
    
    seekTo(targetBeat);

  }, [isDragging, seekTo, effectivePixelsPerBeat]);

  // Mouse up handler to stop dragging
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  // Mouse down handler to start dragging
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    setSelectedWindow('timelineView'); // Set window on interaction

    // Only drag on left click
    if (event.button !== 0) return;
    event.preventDefault(); 
    setIsDragging(true);
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
      setSelectedWindow('timelineView'); // Set window on zoom interaction
      event.preventDefault(); // Prevent default scroll behavior when zooming

      // Vertical Zoom (multiplicative but with linear response to wheel)
      const verticalZoomFactor = 1.15;
      if (event.deltaY < 0 && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        // Zoom in vertically
        const zoomSteps = Math.min(Math.abs(event.deltaY) / 100, 1); // Normalize wheel delta
        const effectiveFactor = Math.pow(verticalZoomFactor, zoomSteps);
        setVerticalZoom(prev => Math.min(prev * effectiveFactor, 10)); // Max zoom 10x
      } else if (event.deltaY > 0) {
        // Zoom out vertically
        const zoomSteps = Math.min(Math.abs(event.deltaY) / 100, 1); // Normalize wheel delta
        const effectiveFactor = Math.pow(verticalZoomFactor, zoomSteps);
        setVerticalZoom(prev => Math.max(prev / effectiveFactor, 0.1)); // Min zoom 0.1x
      }

      // Horizontal Zoom (multiplicative but with linear response to wheel)
      if (event.deltaX !== 0 && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        const horizontalZoomFactor = 1.15;
        const zoomSteps = Math.min(Math.abs(event.deltaX) / 100, 1); // Normalize wheel delta
        const effectiveFactor = Math.pow(horizontalZoomFactor, zoomSteps);
        
        if (event.deltaX < 0) {
          // Zoom in horizontally (scroll left)
          setHorizontalZoom(prev => Math.min(prev * effectiveFactor, 10)); // Max zoom 10x
        } else {
          // Zoom out horizontally (scroll right)
          const visibleWidth = timelineContentRef.current?.clientWidth;
          const numMeasures = useStore.getState().numMeasures;
          const targetMeasures = Math.max(MIN_VIEWPORT_MEASURES, numMeasures);
          
          let minHorizontalZoom = 0.1; // Default minimum zoom

          if (visibleWidth && visibleWidth > 0) {
            // Calculate zoom based on making targetVisibleMeasures fit
            const targetBeats = (targetMeasures + EXTRA_RENDER_MEASURES) * 4; // Add buffer for zoom target
            const minWidthToDisplay = targetBeats * PIXELS_PER_BEAT_BASE;
            minHorizontalZoom = Math.max(0.01, visibleWidth / minWidthToDisplay);
          }

          setHorizontalZoom(prev => Math.max(prev / effectiveFactor, minHorizontalZoom));
        }
      }
    }
  }, [setHorizontalZoom, setVerticalZoom, setSelectedWindow]); // Added setSelectedWindow

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

  const numMeasures = useStore(state => state.numMeasures);
  const renderMeasures = Math.max(MIN_VIEWPORT_MEASURES, numMeasures) + EXTRA_RENDER_MEASURES;

  const totalTracksHeight = tracks.length * effectiveTrackHeight;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent setting if the click originated from the playhead
    if (playheadRef.current && playheadRef.current.contains(e.target as Node)) {
        return;
    }
    setSelectedWindow('timelineView');
  };

  return (
    <div 
      className="timeline-view" 
      onClick={handleTimelineClick}
      style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        boxSizing: 'border-box',
        border: selectedWindow === 'timelineView' 
          ? '2px solid rgba(255, 255, 255, 0.3)'
          : '2px solid transparent'
      }}
    >
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
            onClick={(e) => { e.stopPropagation(); handleAddTrack(); }}
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
            top: '40px',
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
            paddingLeft: '200px',
            zIndex: 2,
            backgroundColor: HEADER_BG_COLOR
          }}>
            <MeasuresHeader
              horizontalZoom={horizontalZoom}
              pixelsPerBeatBase={PIXELS_PER_BEAT_BASE}
              numMeasures={numMeasures}
              renderMeasures={renderMeasures}
            />
          </div>
          
          {/* Combined content area for instruments and timelines */}
          <div style={{
            width: `${(renderMeasures * 4 * effectivePixelsPerBeat)}px`,
            minHeight: '100%',
            position: 'relative',
            display: 'flex',
            height: `${totalTracksHeight}px`
          }}>
            {/* Instrument Views Column - sticky */}
            <div 
              className="instruments-column"
              style={{
                position: 'sticky',
                left: 0,
                width: `${SIDEBAR_WIDTH}px`,
                zIndex: 1,
                backgroundColor: SIDEBAR_BG_COLOR,
                borderRight: '1px solid #333',
                height: '100%'
              }}
            >
              {/* Map over tracks to render InstrumentView */}
              <InstrumentsView 
                tracks={tracks}
                effectiveTrackHeight={effectiveTrackHeight}
              />
            </div>

            {/* Single TrackTimelineView for all tracks */}
            <div 
              className="timelines-column"
              style={{
                flex: 1,
                position: 'relative',
                height: '100%'
              }}
            >
              <TrackTimelineView
                tracks={tracks}
                horizontalZoom={horizontalZoom}
                verticalZoom={verticalZoom}
                pixelsPerBeatBase={PIXELS_PER_BEAT_BASE}
                trackHeightBase={TRACK_HEIGHT_BASE}
                numMeasures={numMeasures}
                renderMeasures={renderMeasures}
              />
            </div>
          </div>
          
          {/* Message when no tracks exist */}
          {tracks.length === 0 && (
            <div style={{ 
              position: 'absolute', 
              top: '60px',
              left: `${SIDEBAR_WIDTH + 20}px`,
              color: 'white', 
              fontStyle: 'italic' 
            }}>
              Click the + button to add a track
            </div>
          )}
        </div>

        {/* Playhead */} 
        <div 
          ref={playheadRef}
          className="playhead"
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            top: '40px',
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
    
    </div>
  );
}

export default TimelineView;