import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Track, MIDIBlock } from '../../lib/types';
import useStore from '../../store/store';
// Removed MidiBlockView import
import { useTrackGestures, UseTrackGesturesProps } from './useTrackGestures'; // Import the new hook and its props type


// Padding/geometry constants (relative to track height)
const BLOCK_VERTICAL_PADDING_FACTOR = 0.1; // e.g., 10% of track height
const EDGE_RESIZE_WIDTH = 8; // Width of the clickable edge area (keep fixed pixels?)
const BLOCK_CORNER_RADIUS = 4; // Added for rounded corners (keep fixed pixels?)

interface TrackTimelineViewProps {
  tracks: Track[];
  horizontalZoom: number;
  verticalZoom: number;
  pixelsPerBeatBase: number;
  trackHeightBase: number;
}


function TrackTimelineView({ 
  tracks, 
  horizontalZoom, 
  verticalZoom, 
  pixelsPerBeatBase, 
  trackHeightBase 
}: TrackTimelineViewProps) {
  const { 
    selectedBlockId, 
    numMeasures, 
    selectBlock, 
    addMidiBlock, 
    updateMidiBlock, 
    removeMidiBlock, 
    moveMidiBlock,
    timeManager 
  } = useStore();
  const timelineAreaRef = useRef<HTMLDivElement>(null); // Keep ref for hook, points to the container
  const canvasRef = useRef<HTMLCanvasElement>(null); // Ref for the canvas element

  // Calculate effective values based on zoom
  const effectiveTrackHeight = trackHeightBase * verticalZoom;
  const effectivePixelsPerBeat = pixelsPerBeatBase * horizontalZoom;
  const effectiveBlockVerticalPadding = effectiveTrackHeight * BLOCK_VERTICAL_PADDING_FACTOR;
  const effectiveBlockHeight = effectiveTrackHeight - 2 * effectiveBlockVerticalPadding;

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
      moveMidiBlock,
      selectBlock,
      selectedBlockId,
      timelineAreaRef,
      timeManager,
      // Pass zoom-related props to the hook
      horizontalZoom,
      verticalZoom,
      pixelsPerBeatBase,
      trackHeightBase,
  } as UseTrackGesturesProps); // Cast to satisfy hook's expected props

  // Helper function to draw rounded rectangles
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  };


  // Canvas Drawing Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    console.log('canvas', canvas);
    if (!canvas || !context) return;

    const dpr = window.devicePixelRatio || 1; // Get Device Pixel Ratio
    // Calculate width/height based on base constants, measures, and zoom
    const baseCanvasWidth = numMeasures * 4 * effectivePixelsPerBeat; // Use effective value
    const baseCanvasHeight = tracks.length * effectiveTrackHeight; // Use effective value

    // Set canvas physical size (higher resolution)
    canvas.width = baseCanvasWidth * dpr;
    canvas.height = baseCanvasHeight * dpr;

    // Set canvas display size (CSS pixels)
    canvas.style.width = `${baseCanvasWidth}px`;
    canvas.style.height = `${baseCanvasHeight}px`;

    // Scale the context to account for DPR
    context.scale(dpr, dpr);


    // Clear canvas (using base dimensions)
    context.fillStyle = '#222';
    context.fillRect(0, 0, baseCanvasWidth, baseCanvasHeight);
    console.log('canvas.width (scaled)', baseCanvasWidth);

    // Draw Grid Lines
    context.strokeStyle = '#333';
    context.lineWidth = 1; // Note: lineWidth might appear thinner due to scaling
    for (let i = 0; i <= numMeasures * 4; i++) {
      const x = i * effectivePixelsPerBeat; // Use effective value
      context.strokeStyle = i % 4 === 0 ? '#555' : '#333'; // Darker lines for measure start
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, baseCanvasHeight); // Use base height
      context.stroke();
    }

     // Draw Track Separators and Blocks
     tracks.forEach((track, trackIndex) => {
      const trackTopY = trackIndex * effectiveTrackHeight; // Use effective value

      // Draw track separator line
      context.strokeStyle = '#333';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, trackTopY + effectiveTrackHeight); // Use effective value
      context.lineTo(baseCanvasWidth, trackTopY + effectiveTrackHeight); // Use base width, effective height
      context.stroke();


      // Draw MIDI Blocks for this track
      track.midiBlocks.forEach(block => {
        const isSelected = block.id === selectedBlockId;
        const leftPosition = block.startBeat * effectivePixelsPerBeat; // Use effective value
        const blockWidth = (block.endBeat - block.startBeat) * effectivePixelsPerBeat; // Use effective value
        const blockTopY = trackTopY + effectiveBlockVerticalPadding; // Use effective padding

        // Draw rounded rectangle path
        drawRoundedRect(context, leftPosition, blockTopY, blockWidth, effectiveBlockHeight, BLOCK_CORNER_RADIUS); // Use effective height

        // Fill block background (always blue)
        context.fillStyle = '#4a90e2'; // Consistent blue color
        context.fill();

        // Stroke border/selection outline only if selected
        if (isSelected) {
          context.strokeStyle = 'white';
          context.lineWidth = 2; // Might appear as 1px on non-retina, consider adjusting if needed
          context.stroke(); // Stroke the existing rounded path
        }

        // Draw block text (adjustments might be needed if text looks blurry)
        context.fillStyle = 'white';
        context.font = `bold ${12 * dpr}px sans-serif`; // Scale font size? Optional, test appearance
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        const text = `${block.notes.length} notes`;
        const textX = leftPosition + EDGE_RESIZE_WIDTH + 4; // Add padding
        const textY = trackTopY + effectiveTrackHeight / 2; // Center vertically in track

        // Optional: Clip text if it overflows block width
        // Clipping region also needs care with rounded corners if applied precisely
        context.save();
        // Simple rectangular clipping for now
        context.rect(textX, trackTopY, blockWidth - EDGE_RESIZE_WIDTH * 2 - 8, effectiveTrackHeight); // Use effective height
        context.clip();
        context.fillText(text, textX, textY);
        context.restore(); // Remove clipping
      });
    });

  }, [tracks, numMeasures, selectedBlockId, horizontalZoom, verticalZoom, pixelsPerBeatBase, trackHeightBase]); // Add zoom dependencies


  // Canvas Event Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const trackIndex = Math.floor(offsetY / effectiveTrackHeight); // Use effective height
    if (trackIndex < 0 || trackIndex >= tracks.length) return; // Click outside track bounds

    const clickedTrack = tracks[trackIndex];
    let hitBlock: MIDIBlock | null = null;
    let hitEdge: 'start' | 'end' | null = null;

    // Hit detection for blocks within the clicked track
    for (const block of clickedTrack.midiBlocks) {
      const leftPosition = block.startBeat * effectivePixelsPerBeat; // Use effective value
      const blockWidth = (block.endBeat - block.startBeat) * effectivePixelsPerBeat; // Use effective value
      const blockTop = trackIndex * effectiveTrackHeight + effectiveBlockVerticalPadding; // Use effective values
      const blockBottom = blockTop + effectiveBlockHeight; // Use effective height

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

    const trackIndex = Math.floor(offsetY / effectiveTrackHeight); // Use effective height
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

    const trackIndex = Math.floor(offsetY / effectiveTrackHeight); // Use effective height
    if (trackIndex < 0 || trackIndex >= tracks.length) {
        // Context menu outside tracks (e.g., for global actions like import)
        handleContextMenu(e, null, null); // Pass null trackId
        return;
    }

    const clickedTrack = tracks[trackIndex];
    let hitBlock: MIDIBlock | null = null;

    // Hit detection (simplified for context menu - just need block ID)
    for (const block of clickedTrack.midiBlocks) {
      const leftPosition = block.startBeat * effectivePixelsPerBeat; // Use effective value
      const blockWidth = (block.endBeat - block.startBeat) * effectivePixelsPerBeat; // Use effective value
       const blockTop = trackIndex * effectiveTrackHeight + effectiveBlockVerticalPadding; // Use effective values
       const blockBottom = blockTop + effectiveBlockHeight; // Use effective height


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

 // New: Handle Mouse Move for Cursor Changes
 const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Calculate mouse position relative to the *displayed* canvas size
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const trackIndex = Math.floor(offsetY / effectiveTrackHeight); // Use effective height
    let cursorStyle = 'default'; // Default cursor

    if (trackIndex >= 0 && trackIndex < tracks.length) {
      const hoveredTrack = tracks[trackIndex];
      // Hit detection logic similar to mouseDown
      for (const block of hoveredTrack.midiBlocks) {
        const leftPosition = block.startBeat * effectivePixelsPerBeat; // Use effective value
        const blockWidth = (block.endBeat - block.startBeat) * effectivePixelsPerBeat; // Use effective value
        const blockTop = trackIndex * effectiveTrackHeight + effectiveBlockVerticalPadding; // Use effective values
        const blockBottom = blockTop + effectiveBlockHeight; // Use effective height

        if (offsetX >= leftPosition && offsetX <= leftPosition + blockWidth &&
            offsetY >= blockTop && offsetY <= blockBottom)
        {
          // Check for edge hits first
          if (offsetX <= leftPosition + EDGE_RESIZE_WIDTH || offsetX >= leftPosition + blockWidth - EDGE_RESIZE_WIDTH) {
            cursorStyle = 'ew-resize'; // East-West resize cursor for edges
          } else {
            cursorStyle = 'grab'; // Grab cursor for moving the block body
          }
          break; // Found a block, set cursor and stop searching
        }
      }
    }
    // Only update if style changed to avoid unnecessary DOM manipulation
    if (canvas.style.cursor !== cursorStyle) {
        canvas.style.cursor = cursorStyle;
    }
 };

  // New: Handle Mouse Leave to Reset Cursor
  const handleCanvasMouseLeave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default'; // Reset cursor when mouse leaves canvas
    }
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
        onMouseMove={handleCanvasMouseMove} // Added mouse move handler
        onMouseLeave={handleCanvasMouseLeave} // Added mouse leave handler
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