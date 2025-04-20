import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Track, MIDIBlock } from '../../lib/types';
import useStore from '../../store/store';
// Removed MidiBlockView import
import { useTrackGestures, UseTrackGesturesProps } from './useTrackGestures'; // Import the new hook and its props type


// Padding/geometry constants (relative to track height)
const BLOCK_VERTICAL_PADDING_FACTOR = 0.1; // e.g., 10% of track height
const EDGE_RESIZE_WIDTH = 8; // Width of the clickable edge area (keep fixed pixels?)
const BLOCK_CORNER_RADIUS = 4; // Added for rounded corners (keep fixed pixels?)
const DISABLED_AREA_COLOR = 'rgba(0, 0, 0, 0.3)'; // Color for dimming extra measures (same as header)
const DRAGGED_BLOCK_OPACITY = 0.5; // Opacity for the original block being dragged AND the ghost block
const VIEWPORT_BUFFER_BEATS = 8; // Draw this many extra beats on each side of the viewport

interface TrackTimelineViewProps {
  tracks: Track[];
  horizontalZoom: number;
  verticalZoom: number;
  pixelsPerBeatBase: number;
  trackHeightBase: number;
  numMeasures: number; // Actual measures in the song
  renderMeasures: number; // Total measures to render visually
  scrollLeft: number;
  timelineVisibleWidth: number;
  scrollTop: number;
  timelineVisibleHeight: number;
}


function TrackTimelineView({
  tracks,
  horizontalZoom,
  verticalZoom,
  pixelsPerBeatBase,
  trackHeightBase,
  numMeasures, // Actual song measures
  renderMeasures, // Total measures to render
  scrollLeft,
  timelineVisibleWidth,
  scrollTop,
  timelineVisibleHeight
}: TrackTimelineViewProps) {
  const {
    selectedBlockId,
    selectBlock,
    addMidiBlock,
    updateMidiBlock,
    removeMidiBlock,
    moveMidiBlock,
    timeManager,
    selectedWindow,
    setSelectedWindow,
    clipboardBlock,
    setClipboardBlock,
    selectedTrackId,
    selectedBlock,
    currentBeat,
    seekTo
  } = useStore();
  const timelineAreaRef = useRef<HTMLDivElement>(null); // Keep ref for hook, points to the container
  const canvasRef = useRef<HTMLCanvasElement>(null); // Ref for the canvas element

  // Calculate effective values based on zoom
  const effectiveTrackHeight = trackHeightBase * verticalZoom;
  const effectivePixelsPerBeat = pixelsPerBeatBase * horizontalZoom;
  const effectiveBlockVerticalPadding = effectiveTrackHeight * BLOCK_VERTICAL_PADDING_FACTOR;
  const effectiveBlockHeight = effectiveTrackHeight - 2 * effectiveBlockVerticalPadding;
  const actualSongBeats = numMeasures * 4; // Use prop
  const totalRenderBeats = renderMeasures * 4; // Use prop

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
    pendingUpdateBlock,    // The potential state of the block being dragged
    pendingTargetTrackId,  // The potential track ID if moved
    dragOperation,          // Current drag operation ('move', 'start', 'end', or 'none')
    isCopyDrag
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
      numMeasures, // Pass actual numMeasures to hook if needed for its logic
      renderMeasures,
      selectedWindow,
      scrollLeft,
      scrollTop,
      timelineVisibleWidth,
      timelineVisibleHeight
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

  // Refactored Block Drawing Helper
  const drawMidiBlock = useCallback((
    ctx: CanvasRenderingContext2D,
    blockData: MIDIBlock,
    trackTopY: number,
    isSelected: boolean,
    alpha: number, // Alpha transparency (0 to 1)
  ) => {
      // Use passed-in blockData instead of block from closure
      const leftPosition = blockData.startBeat * effectivePixelsPerBeat;
      const blockWidth = (blockData.endBeat - blockData.startBeat) * effectivePixelsPerBeat;
      const blockTopY = trackTopY + effectiveBlockVerticalPadding;

      // Save context state before potentially changing alpha or line dash
      ctx.save();

      ctx.globalAlpha = alpha;

      // Draw the block shape
      drawRoundedRect(ctx, leftPosition, blockTopY, blockWidth, effectiveBlockHeight, BLOCK_CORNER_RADIUS);
      ctx.fillStyle = '#4a90e2';
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.setLineDash([]); // Ensure solid line
        ctx.stroke();
      }

      // Draw block text
      ctx.fillStyle = 'white';
      // Adjust font size if needed based on DPR or zoom
      const baseFontSize = 12;
      ctx.font = `bold ${baseFontSize * (window.devicePixelRatio || 1)}px sans-serif`; 
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const text = `${blockData.notes.length} notes`;
      const textX = leftPosition + EDGE_RESIZE_WIDTH + 4;
      const textY = trackTopY + effectiveTrackHeight / 2;

      // Simple rectangular clipping for text
      ctx.beginPath(); // Start a new path for clipping
      ctx.rect(textX - 4, trackTopY, blockWidth - EDGE_RESIZE_WIDTH * 1.5, effectiveTrackHeight); 
      ctx.clip();
      ctx.fillText(text, textX, textY);

      // Restore context state (removes clipping and resets globalAlpha/lineDash)
      ctx.restore();
  }, [effectivePixelsPerBeat, effectiveTrackHeight, effectiveBlockVerticalPadding, effectiveBlockHeight]);


  // Canvas Drawing Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    // Exit if canvas context is not available OR if visible dimensions are not yet determined
    if (!canvas || !context || timelineVisibleWidth <= 0 || timelineVisibleHeight <= 0) return;

    const dpr = window.devicePixelRatio || 1; // Get Device Pixel Ratio

    // *** Viewport Culling: Set canvas size based on viewport ***
    const canvasWidth = timelineVisibleWidth;
    const canvasHeight = timelineVisibleHeight; // Use passed viewport height

    // Set canvas physical size (higher resolution)
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;

    // Set canvas display size (CSS pixels)
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    // Scale the context to account for DPR
    context.scale(dpr, dpr);

    // *** Calculate visible beat range ***
    const startBeatVisible = scrollLeft / effectivePixelsPerBeat - VIEWPORT_BUFFER_BEATS;
    const endBeatVisible = (scrollLeft + canvasWidth) / effectivePixelsPerBeat + VIEWPORT_BUFFER_BEATS;
    const startBeatClamped = Math.max(0, startBeatVisible);
    const endBeatClamped = endBeatVisible; // No need to clamp end? Grid/blocks loop will handle limits.

    // *** Calculate visible track range ***
    const startTrackIndex = Math.max(0, Math.floor(scrollTop / effectiveTrackHeight));
    const endTrackIndex = Math.min(tracks.length -1, Math.ceil((scrollTop + canvasHeight) / effectiveTrackHeight));

    // --- Start Drawing --- 
    context.save(); // Save context state before translation

    // Clear canvas (only the visible part)
    context.fillStyle = '#222';
    context.fillRect(0, 0, canvasWidth, canvasHeight); // Clear with CSS dimensions

    // *** Translate context based on scroll ***
    context.translate(-scrollLeft, -scrollTop); 

    // --- Draw Grid Lines (culled horizontally) ---
    context.lineWidth = 1; 
    const firstBeatIndex = Math.max(0, Math.floor(startBeatClamped));
    const lastBeatIndex = Math.ceil(endBeatClamped);

    for (let i = firstBeatIndex; i <= lastBeatIndex; i++) { 
      // Optimization: skip drawing if outside the maximum possible render range
      // if (i > totalRenderBeats) continue; // Can potentially remove totalRenderBeats calc now

      const x = i * effectivePixelsPerBeat; 
      const isMeasureLine = i % 4 === 0;
      const isBeyondSong = i > actualSongBeats; 

      let strokeStyle = '#333'; 
      if (isMeasureLine) {
        strokeStyle = isBeyondSong ? '#444' : '#555';
      } else if (isBeyondSong) {
        strokeStyle = '#282828';
      }

      context.strokeStyle = strokeStyle;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, tracks.length * effectiveTrackHeight); // Draw line across the *full* track height
      context.stroke();
    }

     // --- Draw Tracks and Blocks (culled horizontally AND vertically) ---
     // Iterate only through visible tracks
     for (let trackIndex = startTrackIndex; trackIndex <= endTrackIndex; trackIndex++) {
        const track = tracks[trackIndex];
        if (!track) continue; // Should not happen, but safety check

        const trackTopY = trackIndex * effectiveTrackHeight; // Use effective value

      // --- Draw MIDI Blocks (culled horizontally) ---
      track.midiBlocks.forEach(block => {
         // *** Culling Check *** 
         // Check if the block overlaps with the visible beat range
         if (block.endBeat < startBeatClamped || block.startBeat > endBeatClamped) {
           return; // Skip drawing this block
         }

        const isSelected = block.id === selectedBlockId;
        const isBeingDragged = dragOperation !== 'none' && block.id === pendingUpdateBlock?.id;

        let alpha = 1;
        if (isBeingDragged) {
            alpha = isCopyDrag ? 1 : DRAGGED_BLOCK_OPACITY; 
        }

        // Drawing coordinates are still absolute based on beats, translation handles visibility
        drawMidiBlock(
            context,
            block, 
            trackTopY,
            isSelected,
            alpha,
        );
      });

      // Draw track separator line (only the visible part)
      context.strokeStyle = '#333';
      context.lineWidth = 1;
      context.beginPath();
      const lineY = trackTopY + effectiveTrackHeight; // Calculate Y pos
      const startX = Math.max(0, scrollLeft); // Start from visible left edge
      const endX = scrollLeft + canvasWidth; // End at visible right edge
      context.moveTo(startX, lineY); 
      context.lineTo(endX, lineY);
      context.stroke();
     }

    // --- Draw Disabled Area Overlay (culled horizontally) ---
    const disabledAreaStartX = actualSongBeats * effectivePixelsPerBeat;
    // Check if the disabled area starts within or before the visible range ends
    if (disabledAreaStartX < scrollLeft + canvasWidth) {
        // Calculate the visible portion of the disabled area
        const visibleStartX = Math.max(disabledAreaStartX, scrollLeft);
        const visibleEndX = scrollLeft + canvasWidth;
        const visibleWidth = visibleEndX - visibleStartX;

        if (visibleWidth > 0) {
            context.fillStyle = DISABLED_AREA_COLOR;
            // Draw relative to the translated context, covering the full vertical extent of all tracks
            context.fillRect(visibleStartX, 0, visibleWidth, tracks.length * effectiveTrackHeight); 
        }
    }

    // --- Draw Pending ("Ghost") Block if Dragging (culled) --- 
    if (dragOperation !== 'none' && pendingUpdateBlock && pendingTargetTrackId) {
        // *** Culling Check *** 
        if (pendingUpdateBlock.endBeat >= startBeatClamped && pendingUpdateBlock.startBeat <= endBeatClamped) {
            const targetTrackIndex = tracks.findIndex(t => t.id === pendingTargetTrackId);
            if (targetTrackIndex !== -1) {
                const targetTrackTopY = targetTrackIndex * effectiveTrackHeight;
                drawMidiBlock(
                    context,
                    pendingUpdateBlock,
                    targetTrackTopY,    
                    false,              
                    DRAGGED_BLOCK_OPACITY,
                );
            }
        }
    }

    // *** Restore context after translation ***
    context.restore();

  }, [
      // Keep essential dependencies
      tracks,
      selectedBlockId,
      horizontalZoom,
      verticalZoom,
      pixelsPerBeatBase,
      trackHeightBase,
      numMeasures, // Still needed for actualSongBeats
      // remove renderMeasures? It's not directly used for sizing/drawing now
      // Effective values derived from zoom
      effectivePixelsPerBeat, 
      effectiveTrackHeight,
      effectiveBlockVerticalPadding,
      effectiveBlockHeight,
      actualSongBeats, // Still needed for disabled area
      // remove totalRenderBeats? Not used now.
      // Pending state
      pendingUpdateBlock,
      pendingTargetTrackId,
      dragOperation,
      drawMidiBlock, 
      selectedWindow,
      isCopyDrag,
      // New dependencies for viewport culling
      scrollLeft, 
      scrollTop,
      timelineVisibleWidth, 
      timelineVisibleHeight
  ]); 


  // --- Keyboard Listener for Copy/Paste --- 
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only act if the timeline view is the selected window
      if (selectedWindow !== 'timelineView') return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isModifier = isMac ? e.metaKey : e.ctrlKey;

      // --- Copy (Cmd/Ctrl + C) --- 
      if (isModifier && e.key === 'c') {
        if (selectedBlock) { // Use selectedBlock directly from store
          // Deep clone the block data to avoid modifying original state
          const blockToCopy = JSON.parse(JSON.stringify(selectedBlock));
          setClipboardBlock(blockToCopy);
          console.log('Copied block:', blockToCopy.id);
          e.preventDefault();
        }
      }

      // --- Paste (Cmd/Ctrl + V) ---
      if (isModifier && e.key === 'v') {
        if (clipboardBlock && selectedTrackId) { 
          // Get current playhead position from store state
          const playheadPos = currentBeat; 
          // Calculate duration of the copied block
          const duration = clipboardBlock.endBeat - clipboardBlock.startBeat;
          // Calculate new beats based on playhead
          const newStartBeat = playheadPos;
          const newEndBeat = playheadPos + duration;
          // Generate new ID
          const newBlockId = `block-${crypto.randomUUID()}`;
          // Create the new block object
          const newPastedBlock: MIDIBlock = {
            ...clipboardBlock,
            id: newBlockId,
            startBeat: newStartBeat,
            endBeat: newEndBeat,
          };

          // Add the block to the selected track
          addMidiBlock(selectedTrackId, newPastedBlock);
          console.log('Pasted block:', newPastedBlock.id, 'to track:', selectedTrackId, 'at beat:', newStartBeat);

          // Move playhead to the end of the pasted block using seekTo action
          seekTo(newEndBeat);

          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedWindow, selectedBlock, clipboardBlock, selectedTrackId, setClipboardBlock, addMidiBlock, timeManager, currentBeat, seekTo]); // Dependencies


  // Canvas Event Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setSelectedWindow('timelineView'); // Set window on mouse down
    if (e.button !== 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // Calculate actual offsets considering scroll
    const actualOffsetX = offsetX + scrollLeft;
    const actualOffsetY = offsetY + scrollTop;

    // Use actualOffsetY to determine track index
    const trackIndex = Math.floor(actualOffsetY / effectiveTrackHeight); 
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

      // Use actualOffsetX for hit detection
      if (actualOffsetX >= leftPosition && actualOffsetX <= leftPosition + blockWidth &&
          actualOffsetY >= blockTop && actualOffsetY <= blockBottom)
      {
        hitBlock = block;
        // Check for edge hits (still using offsetX relative to canvas edge for resize handles)
        if (offsetX <= leftPosition - scrollLeft + EDGE_RESIZE_WIDTH) { // Adjust edge check for scroll
          hitEdge = 'start';
        } else if (offsetX >= leftPosition - scrollLeft + blockWidth - EDGE_RESIZE_WIDTH) { // Adjust edge check for scroll
          hitEdge = 'end';
        }
        break; // Found a block, stop searching
      }
    }

    // Call appropriate gesture handler, passing altKey
    const altKey = e.altKey;
    if (hitBlock && hitEdge === 'start') {
        e.stopPropagation();
        handleStartEdge(clickedTrack.id, hitBlock.id, e.clientX, altKey);
    } else if (hitBlock && hitEdge === 'end') {
        e.stopPropagation();
        handleEndEdge(clickedTrack.id, hitBlock.id, e.clientX, altKey);
    } else if (hitBlock) {
        e.stopPropagation();
        selectBlock(hitBlock.id); // Select the block first
        handleMoveBlock(clickedTrack.id, hitBlock.id, e.clientX, altKey);
    } else {
        // Clicked on empty track space
        selectBlock(null); // Deselect any selected block
        // Potentially initiate rubber-band selection here in the future
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
     setSelectedWindow('timelineView');
     const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left; // Use clientX for consistency with hook if needed
    const offsetY = e.clientY - rect.top;

    // Calculate actual offsets considering scroll
    const actualOffsetX = offsetX + scrollLeft;
    const actualOffsetY = offsetY + scrollTop;

    // Use actualOffsetY to determine track index
    const trackIndex = Math.floor(actualOffsetY / effectiveTrackHeight); 
     if (trackIndex < 0 || trackIndex >= tracks.length) return;

    const clickedTrackId = tracks[trackIndex].id;
    // Pass the original event, trackId, and *actual* beat to the hook
    // Note: If double-clicking needs Y position, pass actualOffsetY
    const clickedBeat = actualOffsetX / effectivePixelsPerBeat;
    handleDoubleClick(e, clickedTrackId, clickedBeat); // Pass clickedBeat if hook needs it
  };

 const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setSelectedWindow('timelineView');
    e.preventDefault(); // Prevent default browser context menu
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // Calculate actual offsets considering scroll
    const actualOffsetX = offsetX + scrollLeft;
    const actualOffsetY = offsetY + scrollTop;
    const clickedBeat = actualOffsetX / effectivePixelsPerBeat;
    // Use actualOffsetY to determine track index
    const trackIndex = Math.floor(actualOffsetY / effectiveTrackHeight);

    // Allow context menu anywhere

    if (trackIndex < 0 || trackIndex >= tracks.length) {
        // Context menu outside tracks
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

       // Use actualOffsetX for hit detection
      if (actualOffsetX >= leftPosition && actualOffsetX <= leftPosition + blockWidth &&
          actualOffsetY >= blockTop && actualOffsetY <= blockBottom)
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

    // Calculate actual offsets considering scroll
    const actualOffsetX = offsetX + scrollLeft;
    const actualOffsetY = offsetY + scrollTop;

    let cursorStyle = 'default'; // Default cursor

    // Use actualOffsetY to determine track index
    const trackIndex = Math.floor(actualOffsetY / effectiveTrackHeight); 
    if (trackIndex >= 0 && trackIndex < tracks.length) {
      const hoveredTrack = tracks[trackIndex];
      // Hit detection logic similar to mouseDown
      for (const block of hoveredTrack.midiBlocks) {
        const leftPosition = block.startBeat * effectivePixelsPerBeat; // Use effective value
        const blockWidth = (block.endBeat - block.startBeat) * effectivePixelsPerBeat; // Use effective value
        const blockTop = trackIndex * effectiveTrackHeight + effectiveBlockVerticalPadding; // Use effective values
        const blockBottom = blockTop + effectiveBlockHeight; // Use effective height

        // Use actualOffsetX for general hit detection, but offsetX for edge checks relative to visible canvas
       if (actualOffsetX >= leftPosition && actualOffsetX <= leftPosition + blockWidth &&
           actualOffsetY >= blockTop && actualOffsetY <= blockBottom)
        {
          // Check for edge hits (relative to the visible part of the block on canvas)
          const blockLeftOnCanvas = leftPosition - scrollLeft;
          const blockRightOnCanvas = blockLeftOnCanvas + blockWidth;
          if (offsetX <= blockLeftOnCanvas + EDGE_RESIZE_WIDTH) {
            cursorStyle = 'ew-resize';
          } else if (offsetX >= blockRightOnCanvas - EDGE_RESIZE_WIDTH) {
            cursorStyle = 'ew-resize';
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
        position: 'absolute', // Needed for positioning context menu correctly relative to scroll
        border: selectedWindow === 'timelineView' 
          ? '1px dotted rgba(255, 255, 255, 0.4)' // Visual feedback when selected
          : '1px solid transparent' // Match parent's border style if needed
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