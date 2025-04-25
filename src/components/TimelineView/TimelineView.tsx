'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import useStore from '../../store/store';
import InstrumentsView from './InstrumentsView/InstrumentsView';
import TrackTimelineView, { TrackTimelineViewHandle } from './TrackTimelineView';
import MeasuresHeader from './MeasuresHeader/MeasuresHeader';
import BasicSynthesizer from '../../lib/synthesizers/BasicSynthesizer';
import { Track } from '../../lib/types';
import styles from './TimelineView.module.css'; // Import the CSS module

// Fixed height for each track
const TRACK_HEIGHT_BASE = 50; // Renamed base height
const PIXELS_PER_BEAT_BASE = 100; // Renamed base pixels per beat
const SIDEBAR_WIDTH = 200; // Define sidebar width as a constant
const MIN_VIEWPORT_MEASURES = 8; // Minimum measures to allow zooming out to see
const EXTRA_RENDER_MEASURES = 8; // Render this many extra measures beyond content or min viewport
const HEADER_HEIGHT = 40; // Define header height as a constant

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
    selectedWindow,
    selectedTrackId,
    selectedBlockId,
    splitMidiBlock
  } = useStore();
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const trackTimelineViewRef = useRef<TrackTimelineViewHandle>(null);
  const instrumentsColumnRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0); // State for horizontal scroll position
  const [scrollTop, setScrollTop] = useState(0); // State for vertical scroll position
  const [horizontalZoom, setHorizontalZoom] = useState(1); // Initial horizontal zoom
  const [verticalZoom, setVerticalZoom] = useState(1); // Initial vertical zoom
  const [timelineVisibleWidth, setTimelineVisibleWidth] = useState(0); // State for visible width
  const [timelineVisibleHeight, setTimelineVisibleHeight] = useState(0); // State for visible height

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
      synthesizer: new BasicSynthesizer(),
      isSoloed: false,
      isMuted: false,
      effects: []
    };
    
    addTrack(newTrack);
    selectTrack(newTrack.id);
  };
  
  // Calculate playhead position based on beat, zoom AND scroll
  const basePlayheadOffset = currentBeat * effectivePixelsPerBeat; // Use effective value
  const playheadLeftStyle = SIDEBAR_WIDTH + basePlayheadOffset - scrollLeft;

  // Mouse move handler for dragging - needs to account for scroll and zoom
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !timelineContentRef.current) return;
    event.preventDefault();
    event.stopPropagation();

    const containerRect = timelineContentRef.current.getBoundingClientRect();
    const mouseXRelative = event.clientX - containerRect.left;
    const mouseXInScrolledContent = mouseXRelative + timelineContentRef.current.scrollLeft;

    const rawTargetBeat = Math.max(0, (mouseXInScrolledContent - SIDEBAR_WIDTH) / effectivePixelsPerBeat);
    const quantizedTargetBeat = Math.round(rawTargetBeat); // Quantize to nearest beat

    seekTo(quantizedTargetBeat); // Use quantized beat

  }, [isDragging, seekTo, effectivePixelsPerBeat]);

  // Mouse up handler to stop dragging
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  // Mouse down handler to start dragging the playhead
  const handlePlayheadMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
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
    // Update visible dimensions on scroll as well
    if (timelineContentRef.current) {
        setTimelineVisibleWidth(timelineContentRef.current.clientWidth - SIDEBAR_WIDTH);
        setTimelineVisibleHeight(timelineContentRef.current.clientHeight - HEADER_HEIGHT);
    }
  };

  // Handler for wheel events (zoom)
  const handleWheel = useCallback((event: WheelEvent) => {
    if (event.altKey) {
      event.preventDefault(); // Prevent default scroll behavior when zooming
      event.stopPropagation(); // Stop the event from bubbling up

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
  }, [setHorizontalZoom, setVerticalZoom]);

  // Attach wheel listener to the timeline content area
  useEffect(() => {
    const timelineElement = timelineContentRef.current;
    // Function to update width
    const updateWidth = () => {
        if (timelineElement) {
            setTimelineVisibleWidth(timelineElement.clientWidth - SIDEBAR_WIDTH);
        }
    };
    // Function to update height
    const updateHeight = () => {
        if (timelineElement) {
            setTimelineVisibleHeight(timelineElement.clientHeight - HEADER_HEIGHT);
        }
    };
    // Function to update both
    const updateDimensions = () => {
        updateWidth();
        updateHeight();
    };

    if (timelineElement) {
      // Initial dimension calculation
      updateDimensions();
      timelineElement.addEventListener('wheel', handleWheel, { passive: false });
      // Use resize observer for both width and height
      const resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(timelineElement);

      return () => {
        timelineElement.removeEventListener('wheel', handleWheel);
        resizeObserver.unobserve(timelineElement);
      };
    }
  }, [handleWheel]); // Dependency array includes handleWheel

  // Keyboard shortcut for splitting MIDI block
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+T (Mac) or Ctrl+T (Windows/Linux)
      if (event.key === 't' && (event.metaKey || event.ctrlKey)) {
        // Check if timeline is the selected window and a block is selected
        if (selectedWindow === 'timelineView' && selectedTrackId && selectedBlockId) {
          event.preventDefault(); // Prevent default browser action (e.g., new tab)
          splitMidiBlock(selectedTrackId, selectedBlockId, currentBeat);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedWindow, selectedTrackId, selectedBlockId, currentBeat, splitMidiBlock]);

  const handleContentMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left; // Relative X within container viewport
    const mouseY = event.clientY - rect.top;  // Relative Y within container viewport

    // Use relative coordinates for the check
    if (mouseX > SIDEBAR_WIDTH && mouseY > HEADER_HEIGHT && trackTimelineViewRef.current?.handleMouseDown) {
      trackTimelineViewRef.current.handleMouseDown(event);
    }
  };

  const handleContentMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left; // Relative X
    const mouseY = event.clientY - rect.top;  // Relative Y

    // Use relative coordinates for the check
    if (mouseX > SIDEBAR_WIDTH && mouseY > HEADER_HEIGHT && trackTimelineViewRef.current?.handleMouseMove) {
      trackTimelineViewRef.current.handleMouseMove(event);
    }
  };

  const handleContentDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left; // Relative X
    const mouseY = event.clientY - rect.top;  // Relative Y

    // Use relative coordinates for the check
    if (mouseX > SIDEBAR_WIDTH && mouseY > HEADER_HEIGHT && trackTimelineViewRef.current?.handleDoubleClick) {
      trackTimelineViewRef.current.handleDoubleClick(event);
    }
  };

  const handleContentContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left; // Relative X
    const mouseY = event.clientY - rect.top;  // Relative Y

    // Use relative coordinates for the check
    if (mouseX > SIDEBAR_WIDTH && mouseY > HEADER_HEIGHT && trackTimelineViewRef.current?.handleContextMenu) {
      trackTimelineViewRef.current.handleContextMenu(event);
    } else {
      // Prevent default context menu in header/sidebar areas if not forwarded
      event.preventDefault(); 
    }
  };

  const handleContentMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
      // MouseLeave applies to the whole container, forward regardless of inner bounds
      // (The internal component might need to know when the mouse leaves the scroll area)
      if (trackTimelineViewRef.current?.handleMouseLeave) {
          trackTimelineViewRef.current.handleMouseLeave(event);
      }
  };

  const numMeasures = useStore(state => state.numMeasures);
  const renderMeasures = Math.max(MIN_VIEWPORT_MEASURES, numMeasures) + EXTRA_RENDER_MEASURES;

  const totalTracksHeight = tracks.length * effectiveTrackHeight;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent setting if the click originated from the playhead or track area handled below
    if (playheadRef.current && playheadRef.current.contains(e.target as Node)) {
        return;
    }
    // When clicking outside the timeline content (e.g., on padding), set the selected window
    if (timelineContentRef.current && !timelineContentRef.current.contains(e.target as Node) && !instrumentsColumnRef.current?.contains(e.target as Node)) {
      setSelectedWindow('timelineView');
    }
  };

  return (
    <div
      className={`${styles.timelineView} ${selectedWindow === 'timelineView' ? styles.timelineViewSelected : ''}`}
      onClick={handleTimelineClick}
    >
      {/* Conditionally render the overlay outline */}
      {selectedWindow === 'timelineView' && (
        <div className={styles.selectionOutline} />
      )}

      {/* Original Content Wrapper */}
      <div className={styles.timelineContentWrapper}>
        {/* Timeline container */}
        <div className={styles.timelineContainer}>
          {/* Tracks header - fixed at top-left */}
          <div className={styles.tracksHeader}>
            <span>Tracks</span>
            <button
              onClick={(e) => { e.stopPropagation(); handleAddTrack(); }}
              className={styles.addTrackButton}
              title="Add new track"
            >
              +
            </button>
          </div>

          {/* Single TrackTimelineView for all tracks */}
          <div
                className={styles.timelinesColumn}
                style={{
                  left: `${SIDEBAR_WIDTH}px`,
                }}
              >
                <TrackTimelineView
                  ref={trackTimelineViewRef}
                  tracks={tracks}
                  horizontalZoom={horizontalZoom}
                  verticalZoom={verticalZoom}
                  pixelsPerBeatBase={PIXELS_PER_BEAT_BASE}
                  trackHeightBase={TRACK_HEIGHT_BASE}
                  numMeasures={numMeasures}
                  renderMeasures={renderMeasures}
                  scrollLeft={scrollLeft}
                  timelineVisibleWidth={timelineVisibleWidth > 0 ? timelineVisibleWidth : 0}
                  scrollTop={scrollTop}
                  timelineVisibleHeight={timelineVisibleHeight > 0 ? timelineVisibleHeight : 0}
                />
              </div>
          
          {/* Main scrollable area */}
          <div
            ref={timelineContentRef}
            className={styles.timelineContent}
            onScroll={handleScroll}
            onMouseDown={handleContentMouseDown}
            onMouseMove={handleContentMouseMove}
            onDoubleClick={handleContentDoubleClick}
            onContextMenu={handleContentContextMenu}
            onMouseLeave={handleContentMouseLeave}
          >
            {/* Fixed sidebar background that extends full height */}
            <div className={styles.sidebarBackground} />
            
            {/* Measures header - sticky at top */}
            <div className={styles.measuresHeaderContainer}>
              <MeasuresHeader
                horizontalZoom={horizontalZoom}
                pixelsPerBeatBase={PIXELS_PER_BEAT_BASE}
                numMeasures={numMeasures}
                renderMeasures={renderMeasures}
              />
            </div>
            
            {/* Combined content area for instruments and timelines */}
            <div
              className={styles.combinedContentArea}
              style={{
                width: `${(renderMeasures * 4 * effectivePixelsPerBeat)}px`,
                height: `${totalTracksHeight}px`,
              }}
            >
              {/* Instrument Views Column - sticky */}
              <div
                ref={instrumentsColumnRef}
                className={styles.instrumentsColumn}
              >
                {/* Map over tracks to render InstrumentView */}
                <InstrumentsView 
                  tracks={tracks}
                  effectiveTrackHeight={effectiveTrackHeight}
                />
              </div>
            </div>
            
            {/* Message when no tracks exist */}
            {tracks.length === 0 && (
              <div
                className={styles.noTracksMessage}
                style={{
                  left: `${SIDEBAR_WIDTH + 20}px`,
                }}
              >
                Click the + button to add a track
              </div>
            )}
          </div>

          

          {/* Playhead */} 
          <div
            ref={playheadRef}
            className={styles.playhead}
            onMouseDown={handlePlayheadMouseDown}
            style={{
              left: `${playheadLeftStyle}px`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default TimelineView;