import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
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

// Define the type for the forwarded ref handle
export interface TrackTimelineViewHandle {
  handleMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseLeave: (event: React.MouseEvent<HTMLDivElement>) => void;
  triggerMouseDown: (args: {
    clientX: number;
    clientY: number;
    button: number;
    altKey: boolean;
    actualOffsetX: number; // Calculated absolute X
    actualOffsetY: number; // Calculated absolute Y
    trackId: string | null;
    blockId: string | null;
    hitEdge: 'start' | 'end' | null;
  }) => void;
  triggerDoubleClick: (args: {
    clientX: number;
    clientY: number;
    actualOffsetX: number;
    actualOffsetY: number;
    trackId: string | null;
  }) => void;
  triggerContextMenu: (args: {
    clientX: number;
    clientY: number;
    actualOffsetX: number;
    actualOffsetY: number;
    trackId: string | null;
    blockId: string | null;
  }) => void;
  triggerMouseMove: (args: {
      clientX: number;
      clientY: number;
      actualOffsetX: number;
      actualOffsetY: number;
  }) => void;
  triggerMouseLeave: () => void;
}


// eslint-disable-next-line react/display-name
const TrackTimelineView = forwardRef<TrackTimelineViewHandle, TrackTimelineViewProps>((
  {
    tracks,
    horizontalZoom,
    verticalZoom,
    pixelsPerBeatBase,
    trackHeightBase,
    numMeasures,
    renderMeasures,
    scrollLeft,
    timelineVisibleWidth,
    scrollTop,
    timelineVisibleHeight
  },
  ref // The forwarded ref
) => {
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
  const internalCanvasRef = useRef<HTMLCanvasElement>(null); // Use internal ref for canvas

  // Calculate effective values based on zoom
  const effectiveTrackHeight = trackHeightBase * verticalZoom;
  const effectivePixelsPerBeat = pixelsPerBeatBase * horizontalZoom;
  const effectiveBlockVerticalPadding = effectiveTrackHeight * BLOCK_VERTICAL_PADDING_FACTOR;
  const effectiveBlockHeight = effectiveTrackHeight - 2 * effectiveBlockVerticalPadding;
  const actualSongBeats = numMeasures * 4;

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
    dragOperation,
    isCopyDrag
  } = useTrackGestures({
      tracks,
      updateMidiBlock,
      addMidiBlock,
      removeMidiBlock,
      moveMidiBlock,
      selectBlock,
      selectedBlockId,
      timelineAreaRef, // Pass timelineAreaRef (the container div) to the hook
      timeManager,
      horizontalZoom,
      verticalZoom,
      pixelsPerBeatBase,
      trackHeightBase,
      selectedWindow,
      scrollLeft, // Pass scroll state if needed by hook's internal logic
      scrollTop,
      timelineVisibleWidth,
      timelineVisibleHeight,
      numMeasures,
      renderMeasures,
  });

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
  const drawMidiBlock = useCallback(( // Keep this helper internal
    ctx: CanvasRenderingContext2D,
    blockData: MIDIBlock,
    trackTopY: number,
    isSelected: boolean,
    alpha: number,
  ) => {
      const leftPosition = blockData.startBeat * effectivePixelsPerBeat;
      const blockWidth = (blockData.endBeat - blockData.startBeat) * effectivePixelsPerBeat;
      const blockTopY = trackTopY + effectiveBlockVerticalPadding;

      ctx.save();
      ctx.globalAlpha = alpha;
      drawRoundedRect(ctx, leftPosition, blockTopY, blockWidth, effectiveBlockHeight, BLOCK_CORNER_RADIUS);
      ctx.fillStyle = '#4a90e2';
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
      }
      ctx.fillStyle = 'white';
      const baseFontSize = 12;
      ctx.font = `bold ${baseFontSize * (window.devicePixelRatio || 1)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const text = `${blockData.notes.length} notes`;
      const textX = leftPosition + EDGE_RESIZE_WIDTH + 4;
      const textY = trackTopY + effectiveTrackHeight / 2;
      ctx.beginPath();
      ctx.rect(textX - 4, trackTopY, blockWidth - EDGE_RESIZE_WIDTH * 1.5, effectiveTrackHeight);
      ctx.clip();
      ctx.fillText(text, textX, textY);
      ctx.restore();
  }, [effectivePixelsPerBeat, effectiveTrackHeight, effectiveBlockVerticalPadding, effectiveBlockHeight]);


  // Canvas Drawing Logic (keep as is)
  useEffect(() => {
    const canvas = internalCanvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || timelineVisibleWidth <= 0 || timelineVisibleHeight <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = timelineVisibleWidth;
    const canvasHeight = timelineVisibleHeight;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    context.scale(dpr, dpr);

    const startBeatVisible = scrollLeft / effectivePixelsPerBeat - VIEWPORT_BUFFER_BEATS;
    const endBeatVisible = (scrollLeft + canvasWidth) / effectivePixelsPerBeat + VIEWPORT_BUFFER_BEATS;
    const startBeatClamped = Math.max(0, startBeatVisible);
    const endBeatClamped = endBeatVisible;

    const startTrackIndex = Math.max(0, Math.floor(scrollTop / effectiveTrackHeight));
    const endTrackIndex = Math.min(tracks.length -1, Math.ceil((scrollTop + canvasHeight) / effectiveTrackHeight));

    context.save();
    context.fillStyle = '#222';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.translate(-scrollLeft, -scrollTop);

    context.lineWidth = 1;
    const firstBeatIndex = Math.max(0, Math.floor(startBeatClamped));
    const lastBeatIndex = Math.ceil(endBeatClamped);

    for (let i = firstBeatIndex; i <= lastBeatIndex; i++) {
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
      context.lineTo(x, tracks.length * effectiveTrackHeight);
      context.stroke();
    }

     for (let trackIndex = startTrackIndex; trackIndex <= endTrackIndex; trackIndex++) {
        const track = tracks[trackIndex];
        if (!track) continue;
        const trackTopY = trackIndex * effectiveTrackHeight;

        track.midiBlocks.forEach(block => {
            if (block.endBeat < startBeatClamped || block.startBeat > endBeatClamped) {
                return;
            }
            const isSelected = block.id === selectedBlockId;
            const isBeingDragged = dragOperation !== 'none' && block.id === pendingUpdateBlock?.id;
            let alpha = 1;
            if (isBeingDragged) {
                alpha = isCopyDrag ? 1 : DRAGGED_BLOCK_OPACITY;
            }
            drawMidiBlock(context, block, trackTopY, isSelected, alpha);
        });

        context.strokeStyle = '#333';
        context.lineWidth = 1;
        context.beginPath();
        const lineY = trackTopY + effectiveTrackHeight;
        const startX = Math.max(0, scrollLeft);
        const endX = scrollLeft + canvasWidth;
        context.moveTo(startX, lineY);
        context.lineTo(endX, lineY);
        context.stroke();
     }

    const disabledAreaStartX = actualSongBeats * effectivePixelsPerBeat;
    if (disabledAreaStartX < scrollLeft + canvasWidth) {
        const visibleStartX = Math.max(disabledAreaStartX, scrollLeft);
        const visibleEndX = scrollLeft + canvasWidth;
        const visibleWidth = visibleEndX - visibleStartX;
        if (visibleWidth > 0) {
            context.fillStyle = DISABLED_AREA_COLOR;
            context.fillRect(visibleStartX, 0, visibleWidth, tracks.length * effectiveTrackHeight);
        }
    }

    if (dragOperation !== 'none' && pendingUpdateBlock && pendingTargetTrackId) {
        if (pendingUpdateBlock.endBeat >= startBeatClamped && pendingUpdateBlock.startBeat <= endBeatClamped) {
            const targetTrackIndex = tracks.findIndex(t => t.id === pendingTargetTrackId);
            if (targetTrackIndex !== -1) {
                const targetTrackTopY = targetTrackIndex * effectiveTrackHeight;
                drawMidiBlock(context, pendingUpdateBlock, targetTrackTopY, false, DRAGGED_BLOCK_OPACITY);
            }
        }
    }
    context.restore();
  }, [
      tracks, selectedBlockId, horizontalZoom, verticalZoom, pixelsPerBeatBase, trackHeightBase,
      numMeasures, effectivePixelsPerBeat, effectiveTrackHeight, effectiveBlockVerticalPadding,
      effectiveBlockHeight, actualSongBeats, pendingUpdateBlock, pendingTargetTrackId,
      dragOperation, drawMidiBlock, selectedWindow, isCopyDrag, scrollLeft, scrollTop,
      timelineVisibleWidth, timelineVisibleHeight
  ]);


  // --- Internal logic for mouse move/leave (cursor) --- 
  const handleInternalMouseMove = useCallback((args: { clientX: number; clientY: number; actualOffsetX: number; actualOffsetY: number; }) => {
    const canvas = internalCanvasRef.current;
    if (!canvas) return;

    let cursorStyle = 'default';
    const trackIndex = Math.floor(args.actualOffsetY / effectiveTrackHeight);
    if (trackIndex >= 0 && trackIndex < tracks.length) {
        const hoveredTrack = tracks[trackIndex];
        for (const block of hoveredTrack.midiBlocks) {
            const leftPosition = block.startBeat * effectivePixelsPerBeat;
            const blockWidth = (block.endBeat - block.startBeat) * effectivePixelsPerBeat;
            const blockTop = trackIndex * effectiveTrackHeight + effectiveBlockVerticalPadding;
            const blockBottom = blockTop + effectiveBlockHeight;

            if (args.actualOffsetX >= leftPosition && args.actualOffsetX <= leftPosition + blockWidth &&
                args.actualOffsetY >= blockTop && args.actualOffsetY <= blockBottom)
            {
                const blockLeftOnCanvas = leftPosition - scrollLeft;
                const blockRightOnCanvas = blockLeftOnCanvas + blockWidth;
                // Use clientX relative to canvas viewport edge for edge checks
                const offsetX = args.clientX - canvas.getBoundingClientRect().left;
                if (offsetX <= blockLeftOnCanvas + EDGE_RESIZE_WIDTH) {
                    cursorStyle = 'ew-resize';
                } else if (offsetX >= blockRightOnCanvas - EDGE_RESIZE_WIDTH) {
                    cursorStyle = 'ew-resize';
                } else {
                    cursorStyle = 'grab';
                }
                break;
            }
        }
    }
    if (canvas.style.cursor !== cursorStyle) {
        canvas.style.cursor = cursorStyle;
    }
 }, [tracks, effectiveTrackHeight, effectivePixelsPerBeat, effectiveBlockVerticalPadding, effectiveBlockHeight, scrollLeft]);

 const handleInternalMouseLeave = useCallback(() => {
    const canvas = internalCanvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
 }, []);

 // Canvas Event Handlers
 const nativeHandleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setSelectedWindow('timelineView'); // Set window on mouse down
    if (e.button !== 0) return;

    const canvas = internalCanvasRef.current;
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

  const nativeHandleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
     setSelectedWindow('timelineView');
     const canvas = internalCanvasRef.current;
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

 const nativeHandleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setSelectedWindow('timelineView');
    e.preventDefault(); // Prevent default browser context menu
    const canvas = internalCanvasRef.current;
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
 const nativeHandleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = internalCanvasRef.current;
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
  const nativeHandleCanvasMouseLeave = () => {
    const canvas = internalCanvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default'; // Reset cursor when mouse leaves canvas
    }
  };


  // --- Expose Handlers via Ref --- 
  useImperativeHandle(ref, () => ({
    handleMouseDown: (event: React.MouseEvent<HTMLDivElement>) => {
      // Cast event or ensure compatibility if needed
      nativeHandleCanvasMouseDown(event as any as React.MouseEvent<HTMLCanvasElement>);
    },
    handleMouseMove: (event: React.MouseEvent<HTMLDivElement>) => {
      // Cast event or ensure compatibility if needed
      nativeHandleCanvasMouseMove(event as any as React.MouseEvent<HTMLCanvasElement>);
    },
    handleDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => {
      // Cast event or ensure compatibility if needed
      nativeHandleCanvasDoubleClick(event as any as React.MouseEvent<HTMLCanvasElement>);
    },
    handleContextMenu: (event: React.MouseEvent<HTMLDivElement>) => {
      // Cast event or ensure compatibility if needed
      nativeHandleCanvasContextMenu(event as any as React.MouseEvent<HTMLCanvasElement>);
    },
    handleMouseLeave: (event: React.MouseEvent<HTMLDivElement>) => {
      // Cast event or ensure compatibility if needed
      nativeHandleCanvasMouseLeave(); // No event needed for leave
    },
    
    triggerMouseDown: ({ clientX, clientY, button, altKey, actualOffsetX, actualOffsetY, trackId, blockId, hitEdge }) => {
      if (button !== 0) return;
      setSelectedWindow('timelineView'); // Ensure window is selected

      if (blockId && trackId && hitEdge === 'start') {
          handleStartEdge(trackId, blockId, clientX, altKey);
      } else if (blockId && trackId && hitEdge === 'end') {
          handleEndEdge(trackId, blockId, clientX, altKey);
      } else if (blockId && trackId) {
          selectBlock(blockId);
          handleMoveBlock(trackId, blockId, clientX, altKey);
      } else {
          selectBlock(null);
      }
    },
    triggerDoubleClick: ({ clientX, clientY, actualOffsetX, actualOffsetY, trackId }) => {
        setSelectedWindow('timelineView');
        if (!trackId) return;
        const clickedBeat = actualOffsetX / effectivePixelsPerBeat;
        // Pass necessary info, mock event if hook expects it
        handleDoubleClick({ clientX, clientY } as React.MouseEvent, trackId, clickedBeat);
    },
    triggerContextMenu: ({ clientX, clientY, actualOffsetX, actualOffsetY, trackId, blockId }) => {
        setSelectedWindow('timelineView');
        // Mock event with needed properties
        const mockEvent = { clientX, clientY, preventDefault: () => {}, stopPropagation: () => {} };
        handleContextMenu(mockEvent as React.MouseEvent, blockId, trackId);
    },
    triggerMouseMove: handleInternalMouseMove, // Expose the internal logic directly
    triggerMouseLeave: handleInternalMouseLeave // Expose the internal logic directly
  }), [
      // Dependencies for the exposed handlers
      setSelectedWindow, handleStartEdge, handleEndEdge, selectBlock, handleMoveBlock,
      handleDoubleClick, effectivePixelsPerBeat, handleContextMenu, handleInternalMouseMove, handleInternalMouseLeave
  ]);


  // --- Keyboard Listener for Copy/Paste (keep as is) --- 
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedWindow !== 'timelineView') return;
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isModifier = isMac ? e.metaKey : e.ctrlKey;
      if (isModifier && e.key === 'c') {
        if (selectedBlock) {
          const blockToCopy = JSON.parse(JSON.stringify(selectedBlock));
          setClipboardBlock(blockToCopy);
          e.preventDefault();
        }
      }
      if (isModifier && e.key === 'v') {
        if (clipboardBlock && selectedTrackId) {
          const playheadPos = currentBeat;
          const duration = clipboardBlock.endBeat - clipboardBlock.startBeat;
          const newStartBeat = playheadPos;
          const newEndBeat = playheadPos + duration;
          const newBlockId = `block-${crypto.randomUUID()}`;
          const newPastedBlock: MIDIBlock = { ...clipboardBlock, id: newBlockId, startBeat: newStartBeat, endBeat: newEndBeat };
          addMidiBlock(selectedTrackId, newPastedBlock);
          seekTo(newEndBeat);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [selectedWindow, selectedBlock, clipboardBlock, selectedTrackId, setClipboardBlock, addMidiBlock, currentBeat, seekTo]);


  return (
    <div
      ref={timelineAreaRef} // Ref still points to the container div
      className="all-tracks-timeline-view-container"
      style={{
        width: '100%',
        height: '100%', // Ensure container takes full height
        backgroundColor: '#222', // Background is now relevant again if container is sized
        position: 'absolute',
        top: 0,
        left: 0,
        border: selectedWindow === 'timelineView'
          ? '1px dotted rgba(255, 255, 255, 0.4)'
          : '1px solid transparent'
      }}
    >
      <canvas
        ref={internalCanvasRef} // Assign the internal ref here
        // REMOVE EVENT HANDLERS
        style={{
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          // Width/height set by useEffect based on timelineVisibleWidth/Height
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
          className="context-menu-class"
          style={{
            position: 'fixed',
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
          onClick={(e) => e.stopPropagation()}
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
});

export default TrackTimelineView; 