import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Track, MIDIBlock } from '../../lib/types';
import useStore from '../../store/store';
// Removed MidiBlockView import
import { useTrackGestures } from './useTrackGestures'; // Import the new hook

// Import TRACK_HEIGHT or define it if not easily importable
// Assuming TRACK_HEIGHT is defined elsewhere or passed as prop if variable
const TRACK_HEIGHT = 50; // Use the same height as in TimelineView
const BLOCK_VERTICAL_PADDING = 5; // Padding above/below the block
const BLOCK_HEIGHT = TRACK_HEIGHT - 2 * BLOCK_VERTICAL_PADDING;
const EDGE_RESIZE_WIDTH = 8; // Width of the clickable edge area

interface TrackTimelineViewProps {
  tracks: Track[]; // Changed from single track to array
}

// Constants
const PIXELS_PER_BEAT = 100; // Updated to match TimelineView and MeasuresHeader
// GRID_SNAP is used within useTrackGestures, keep it there or pass if needed externally

function TrackTimelineView({ tracks }: TrackTimelineViewProps) {
  const { selectedBlockId, numMeasures, selectBlock, addMidiBlock, updateMidiBlock, removeMidiBlock, timeManager } = useStore();
  const timelineAreaRef = useRef<HTMLDivElement>(null); // Keep ref for hook, points to the container
  const canvasRef = useRef<HTMLCanvasElement>(null); // Ref for the canvas element

  // Use the custom hook for *all* gesture and interaction handling
  const {
    handleStartEdge,
    handleEndEdge,
    handleMoveBlock,
    handleDoubleClick,
    handleContextMenu,
    handleDeleteBlock,
    handleImportMidiClick,
    handleFileSelected,
    showContextMenu,
    contextMenuPosition,
    contextMenuBlockId,
    fileInputRef,
  } = useTrackGestures({
      tracks,
      updateMidiBlock,
      addMidiBlock,
      removeMidiBlock,
      selectBlock,
      selectedBlockId,
      timelineAreaRef, // Pass container ref
      timeManager,
  });

  console.log('tracks', tracks);

  // Canvas Drawing Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    console.log('canvas', canvas);
    if (!canvas || !context) return;

    const canvasWidth = numMeasures * 4 * PIXELS_PER_BEAT; // Total width based on measures
    const canvasHeight = tracks.length * TRACK_HEIGHT;

    // Set canvas size explicitly for drawing resolution
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    // Style size to fit container (if needed, though width is fixed for now)
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;


    // Clear canvas
    context.fillStyle = '#222';
    context.fillRect(0, 0, canvas.width, canvas.height);
    console.log('canvas.width', canvas.width);
    // Draw Grid Lines
    context.strokeStyle = '#333';
    context.lineWidth = 1;
    for (let i = 0; i <= numMeasures * 4; i++) {
      const x = i * PIXELS_PER_BEAT;
      context.strokeStyle = i % 4 === 0 ? '#555' : '#333'; // Darker lines for measure start
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }

     // Draw Track Separators and Blocks
     tracks.forEach((track, trackIndex) => {
      const trackTopY = trackIndex * TRACK_HEIGHT;

      // Draw track separator line (optional, if needed visually)
      context.strokeStyle = '#333';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, trackTopY + TRACK_HEIGHT);
      context.lineTo(canvas.width, trackTopY + TRACK_HEIGHT);
      context.stroke();


      // Draw MIDI Blocks for this track
      track.midiBlocks.forEach(block => {
        const isSelected = block.id === selectedBlockId;
        const leftPosition = block.startBeat * PIXELS_PER_BEAT;
        const blockWidth = (block.endBeat - block.startBeat) * PIXELS_PER_BEAT;

        // Block background
        context.fillStyle = isSelected ? '#4a90e2' : '#67c23a';
        context.fillRect(leftPosition, trackTopY + BLOCK_VERTICAL_PADDING, blockWidth, BLOCK_HEIGHT);

        // Block border/selection outline
        if (isSelected) {
          context.strokeStyle = 'white';
          context.lineWidth = 2;
          context.strokeRect(leftPosition, trackTopY + BLOCK_VERTICAL_PADDING, blockWidth, BLOCK_HEIGHT);
        }

        // Draw resize handles visually (optional, mainly for hit detection)
        // context.fillStyle = 'rgba(0,0,0,0.1)'; // Subtle visual cue
        // context.fillRect(leftPosition, trackTopY + BLOCK_VERTICAL_PADDING, EDGE_RESIZE_WIDTH, BLOCK_HEIGHT);
        // context.fillRect(leftPosition + blockWidth - EDGE_RESIZE_WIDTH, trackTopY + BLOCK_VERTICAL_PADDING, EDGE_RESIZE_WIDTH, BLOCK_HEIGHT);


        // Draw block text (e.g., number of notes)
        context.fillStyle = 'white';
        context.font = 'bold 12px sans-serif';
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        const text = `${block.notes.length} notes`;
        const textX = leftPosition + EDGE_RESIZE_WIDTH + 4; // Add padding
        const textY = trackTopY + TRACK_HEIGHT / 2;
        // Optional: Clip text if it overflows block width
        context.save();
        context.rect(textX, trackTopY, blockWidth - EDGE_RESIZE_WIDTH * 2 - 8, TRACK_HEIGHT); // Clipping region
        context.clip();
        context.fillText(text, textX, textY);
        context.restore(); // Remove clipping
      });
    });

  }, [tracks, numMeasures, selectedBlockId]); // Redraw when these change


  // Canvas Event Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const trackIndex = Math.floor(offsetY / TRACK_HEIGHT);
    if (trackIndex < 0 || trackIndex >= tracks.length) return; // Click outside track bounds

    const clickedTrack = tracks[trackIndex];
    let hitBlock: MIDIBlock | null = null;
    let hitEdge: 'start' | 'end' | null = null;

    // Hit detection for blocks within the clicked track
    for (const block of clickedTrack.midiBlocks) {
      const leftPosition = block.startBeat * PIXELS_PER_BEAT;
      const blockWidth = (block.endBeat - block.startBeat) * PIXELS_PER_BEAT;
      const blockTop = trackIndex * TRACK_HEIGHT + BLOCK_VERTICAL_PADDING;
      const blockBottom = blockTop + BLOCK_HEIGHT;

      if (offsetX >= leftPosition && offsetX <= leftPosition + blockWidth &&
          offsetY >= blockTop && offsetY <= blockBottom)
      {
        hitBlock = block;
        // Check for edge hits
        if (offsetX <= leftPosition + EDGE_RESIZE_WIDTH) {
          hitEdge = 'start';
        } else if (offsetX >= leftPosition + blockWidth - EDGE_RESIZE_WIDTH) {
          hitEdge = 'end';
        }
        break; // Found a block, stop searching
      }
    }

    // Call appropriate gesture handler
    if (hitBlock && hitEdge === 'start') {
        e.stopPropagation();
        handleStartEdge(clickedTrack.id, hitBlock.id, e.clientX);
    } else if (hitBlock && hitEdge === 'end') {
        e.stopPropagation();
        handleEndEdge(clickedTrack.id, hitBlock.id, e.clientX);
    } else if (hitBlock) {
        e.stopPropagation();
        selectBlock(hitBlock.id); // Select the block first
        handleMoveBlock(clickedTrack.id, hitBlock.id, e.clientX);
    } else {
        // Clicked on empty track space
        selectBlock(null); // Deselect any selected block
        // Potentially initiate rubber-band selection here in the future
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
     const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left; // Use clientX for consistency with hook if needed
    const offsetY = e.clientY - rect.top;

    const trackIndex = Math.floor(offsetY / TRACK_HEIGHT);
     if (trackIndex < 0 || trackIndex >= tracks.length) return;

    const clickedTrackId = tracks[trackIndex].id;
    // Pass the original event and trackId to the hook
    handleDoubleClick(e, clickedTrackId);
  };

 const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent default browser context menu
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const trackIndex = Math.floor(offsetY / TRACK_HEIGHT);
    if (trackIndex < 0 || trackIndex >= tracks.length) {
        // Context menu outside tracks (e.g., for global actions like import)
        handleContextMenu(e, null, null); // Pass null trackId
        return;
    }

    const clickedTrack = tracks[trackIndex];
    let hitBlock: MIDIBlock | null = null;

    // Hit detection (simplified for context menu - just need block ID)
    for (const block of clickedTrack.midiBlocks) {
      const leftPosition = block.startBeat * PIXELS_PER_BEAT;
      const blockWidth = (block.endBeat - block.startBeat) * PIXELS_PER_BEAT;
       const blockTop = trackIndex * TRACK_HEIGHT + BLOCK_VERTICAL_PADDING;
       const blockBottom = blockTop + BLOCK_HEIGHT;


      if (offsetX >= leftPosition && offsetX <= leftPosition + blockWidth &&
          offsetY >= blockTop && offsetY <= blockBottom)
      {
        hitBlock = block;
        break;
      }
    }

    // Call context menu handler from hook, passing event, blockId (or null), and trackId
    handleContextMenu(e, hitBlock?.id ?? null, clickedTrack.id);
 };


  return (
    <div
      ref={timelineAreaRef} // Keep this ref on the container div
      className="all-tracks-timeline-view-container" // Renamed class for clarity
      style={{
        width: '100%', // Container takes full width
        backgroundColor: '#222',
        position: 'absolute' // Needed for positioning context menu correctly relative to scroll
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onDoubleClick={handleCanvasDoubleClick}
        onContextMenu={handleCanvasContextMenu}
        style={{ 
          display: 'block', // Prevents extra space below canvas
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%', // Make canvas fill the container width
          // height: '100%', // Remove percentage height; useEffect sets explicit pixel height
        }}
      />

      {/* Keep File Input and Context Menu */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".mid,.midi"
        onChange={handleFileSelected}
      />

      {showContextMenu && (
        <div
          className="context-menu-class" // Keep existing styling/logic
          style={{
            position: 'fixed', // Use fixed position based on hook's calculation
            top: `${contextMenuPosition.y}px`,
            left: `${contextMenuPosition.x}px`,
            backgroundColor: '#333',
            border: '1px solid #555',
            borderRadius: '4px',
            padding: '4px 0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            zIndex: 100,
            cursor: 'pointer',
            color: 'white',
            fontSize: '14px',
            whiteSpace: 'nowrap'
          }}
          onClick={(e) => e.stopPropagation()} // Prevent closing menu when clicking inside
        >
           <div
            style={{ padding: '6px 14px', cursor: 'pointer' }}
            onClick={handleImportMidiClick}
          >
            Import MIDI...
          </div>

          {contextMenuBlockId && (
              <div
                style={{
                  padding: '6px 14px',
                  cursor: 'pointer',
                  color: '#ff8080',
                  borderTop: '1px solid #555'
                }}
                onClick={handleDeleteBlock}
              >
                Delete Block
              </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TrackTimelineView; 