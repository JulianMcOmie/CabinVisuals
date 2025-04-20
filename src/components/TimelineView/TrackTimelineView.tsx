import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Track, MIDIBlock } from '../../lib/types';
import useStore from '../../store/store';
// Removed MidiBlockView import
import { useTrackGestures, UseTrackGesturesProps } from './useTrackGestures'; // Import the new hook and its props type

// --- Throttle Utility (Inline) ---
// Define the type for the throttled function including the cancel method
type ThrottledFunction<A extends any[], R> = {
  (...args: A): R | undefined;
  cancel(): void;
};

function throttle<A extends any[], R>(func: (...args: A) => R, limit: number): ThrottledFunction<A, R> {
  let inThrottle: boolean;
  let lastResult: R | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttled = (...args: A) => {
    if (!inThrottle) {
      inThrottle = true;
      timeoutId = setTimeout(() => {
         inThrottle = false;
         timeoutId = null; // Clear timeoutId when throttle period ends
       }, limit);
      lastResult = func(...args);
    }
    return lastResult;
  };

  // Add a cancel method
  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    inThrottle = false; // Reset throttle state
  };

  return throttled;
}
// --- End Throttle Utility ---

// Padding/geometry constants (relative to track height)
const BLOCK_VERTICAL_PADDING_FACTOR = 0.1; // e.g., 10% of track height
const EDGE_RESIZE_WIDTH = 8; // Width of the clickable edge area (keep fixed pixels?)
const BLOCK_CORNER_RADIUS = 4; // Added for rounded corners (keep fixed pixels?)
const DISABLED_AREA_COLOR = 'rgba(0, 0, 0, 0.3)'; // Color for dimming extra measures (same as header)
const DRAGGED_BLOCK_OPACITY = 0.5; // Opacity for the original block being dragged AND the ghost block

interface TrackTimelineViewProps {
  tracks: Track[];
  horizontalZoom: number;
  verticalZoom: number;
  pixelsPerBeatBase: number;
  trackHeightBase: number;
  numMeasures: number; // Actual measures in the song
  renderMeasures: number; // Total measures to render visually
}


function TrackTimelineView({
  tracks,
  horizontalZoom,
  verticalZoom,
  pixelsPerBeatBase,
  trackHeightBase,
  numMeasures, // Actual song measures
  renderMeasures // Total measures to render
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

  // State for viewport dimensions and scroll position
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0); // Added for vertical scroll
  const [visibleWidth, setVisibleWidth] = useState(0);
  const [visibleHeight, setVisibleHeight] = useState(0); // Added for vertical dimension

  // Calculate total dimensions in base coordinates (needed for scroll range)
  const totalBaseWidth = renderMeasures * 4 * pixelsPerBeatBase;
  const totalBaseHeight = tracks.length * trackHeightBase;

  // --- Scroll and Resize Handling ---
  const throttledSetScroll = useMemo(() => throttle((left: number, top: number) => {
      setScrollLeft(left);
      setScrollTop(top);
  }, 50), []); // Throttle scroll updates (e.g., max once per 50ms)

  useEffect(() => {
    const container = timelineAreaRef.current;
    if (!container) return;

    // Initial setup
    setVisibleWidth(container.clientWidth);
    setVisibleHeight(container.clientHeight);
    setScrollLeft(container.scrollLeft);
    setScrollTop(container.scrollTop);

    // Scroll listener
    const handleScroll = () => {
        // Use throttled function
        throttledSetScroll(container.scrollLeft, container.scrollTop);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });

    // Resize observer
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setVisibleWidth(entry.contentRect.width);
        setVisibleHeight(entry.contentRect.height);
        // Re-read scroll on resize? Optional, depends if resize affects scroll
        // throttledSetScroll(container.scrollLeft, container.scrollTop);
      }
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.unobserve(container);
      // Call cancel on the throttled function
      throttledSetScroll.cancel();
    };
  }, [throttledSetScroll]); // Dependency on the throttled function


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
      // scrollLeft,
      // scrollTop,
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
    trackIndex: number, // Use index to calculate base Y
    isSelected: boolean,
    alpha: number,
  ) => {
      // Calculate position and dimensions in BASE coordinates
      const leftPosition = blockData.startBeat * pixelsPerBeatBase;
      const blockWidth = (blockData.endBeat - blockData.startBeat) * pixelsPerBeatBase;
      const blockBaseTopY = trackIndex * trackHeightBase;
      const blockPadding = trackHeightBase * BLOCK_VERTICAL_PADDING_FACTOR;
      const blockEffectiveHeight = trackHeightBase - 2 * blockPadding;
      const blockDrawY = blockBaseTopY + blockPadding;

      // Save context state before potentially changing alpha or line dash
      ctx.save();
      ctx.globalAlpha = alpha;

      // Draw the block shape using BASE coordinates
      // The context transform handles zoom/pan
      drawRoundedRect(ctx, leftPosition, blockDrawY, blockWidth, blockEffectiveHeight, BLOCK_CORNER_RADIUS / horizontalZoom); // Scale radius? Maybe keep fixed.
      ctx.fillStyle = '#4a90e2';
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = 'white';
        // Adjust line width based on zoom so it doesn't get too thick/thin
        ctx.lineWidth = 2 / Math.min(horizontalZoom, verticalZoom); // Example scaling
        ctx.setLineDash([]);
        ctx.stroke();
      }

      // Draw block text (consider scaling font size based on zoom)
      ctx.fillStyle = 'white';
      const baseFontSize = 12;
      // Scale font size - apply AFTER other transforms or handle carefully
      // Option 1: Apply scaling factor here (might need to undo translate/scale first?)
      // Option 2: Set font before main transform? Less flexible.
      // Let's try scaling it simply, adjusting baseline might be needed
      ctx.font = `bold ${baseFontSize / horizontalZoom}px sans-serif`; // Scale font size inversely with zoom
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const text = `${blockData.notes.length} notes`;
      const textX = leftPosition + (EDGE_RESIZE_WIDTH + 4) / horizontalZoom; // Scale padding
      const textY = blockBaseTopY + trackHeightBase / 2;

      // Simple rectangular clipping for text (use BASE coordinates)
      ctx.beginPath();
      ctx.rect(textX - (4 / horizontalZoom), blockBaseTopY, blockWidth - (EDGE_RESIZE_WIDTH * 1.5) / horizontalZoom, trackHeightBase);
      ctx.clip();
      ctx.fillText(text, textX, textY);

      // Restore context state (removes clipping and resets alpha/lineWidth etc.)
      ctx.restore();
  }, [pixelsPerBeatBase, trackHeightBase, horizontalZoom, verticalZoom]);


  // --- Canvas Drawing Logic (Optimized with Transforms) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const container = timelineAreaRef.current;
    // Ensure we have dimensions > 0 before drawing
    if (!canvas || !context || !container || visibleWidth <= 0 || visibleHeight <= 0) return;

    const dpr = window.devicePixelRatio || 1;

    // --- Set Fixed Canvas Size ---
    const currentCanvasWidth = Math.round(visibleWidth * dpr);
    const currentCanvasHeight = Math.round(visibleHeight * dpr);
    if (canvas.width !== currentCanvasWidth) {
        canvas.width = currentCanvasWidth;
    }
    if (canvas.height !== currentCanvasHeight) {
        canvas.height = currentCanvasHeight;
    }
    canvas.style.width = `${visibleWidth}px`;
    canvas.style.height = `${visibleHeight}px`;

    // --- Calculate Visible Range (in Base Coordinates) ---
    const worldViewLeft = scrollLeft / horizontalZoom;
    const worldViewTop = scrollTop / verticalZoom;
    const worldViewWidth = visibleWidth / horizontalZoom;
    const worldViewHeight = visibleHeight / verticalZoom;

    const startVisibleBeat = Math.max(0, worldViewLeft / pixelsPerBeatBase);
    const endVisibleBeat = Math.min(totalBaseWidth / pixelsPerBeatBase, (worldViewLeft + worldViewWidth) / pixelsPerBeatBase);
    const startVisibleTrackIndex = Math.max(0, Math.floor(worldViewTop / trackHeightBase));
    const endVisibleTrackIndex = Math.min(tracks.length, Math.ceil((worldViewTop + worldViewHeight) / trackHeightBase));

    // Add buffer to visible range (in beats/tracks) to prevent popping
    const horizontalBufferBeats = 5; // Render +/- 5 beats
    const verticalBufferTracks = 1; // Render +/- 1 track
    const drawStartBeat = Math.max(0, startVisibleBeat - horizontalBufferBeats);
    const drawEndBeat = Math.min(totalBaseWidth / pixelsPerBeatBase, endVisibleBeat + horizontalBufferBeats);
    const drawStartTrackIndex = Math.max(0, startVisibleTrackIndex - verticalBufferTracks);
    const drawEndTrackIndex = Math.min(tracks.length, endVisibleTrackIndex + verticalBufferTracks);


    // --- Apply Transformations ---
    context.save();
    context.scale(dpr, dpr); // Apply DPR scaling first
    context.fillStyle = '#222'; // Background color
    context.fillRect(0, 0, visibleWidth, visibleHeight); // Clear screen (CSS pixels)

    context.translate(-scrollLeft, -scrollTop); // Apply scroll translation
    context.scale(horizontalZoom, verticalZoom); // Apply zoom

    // --- Drawing commands use BASE coordinates ---

    // --- Draw Grid Lines (Visible Range Only) ---
    context.lineWidth = 1 / horizontalZoom; // Scale line width
    const firstBeatToDraw = Math.floor(drawStartBeat);
    const lastBeatToDraw = Math.ceil(drawEndBeat);

    for (let beat = firstBeatToDraw; beat <= lastBeatToDraw; beat++) {
        const x = beat * pixelsPerBeatBase; // BASE coordinate
        const isMeasureLine = beat % 4 === 0;
        const isBeyondSong = beat > numMeasures * 4; // Use actual song measures

        let strokeStyle = '#333';
        if (isMeasureLine) strokeStyle = isBeyondSong ? '#444' : '#555';
        else if (isBeyondSong) strokeStyle = '#282828';

        context.strokeStyle = strokeStyle;
        context.beginPath();
        // Draw line across the visible track range (in base coordinates)
        const lineTopY = drawStartTrackIndex * trackHeightBase;
        const lineBottomY = drawEndTrackIndex * trackHeightBase;
        context.moveTo(x, lineTopY);
        context.lineTo(x, lineBottomY);
        context.stroke();
    }

     // --- Draw Track Separators (Visible Range Only) ---
     context.strokeStyle = '#333';
     context.lineWidth = 1 / verticalZoom; // Scale line width
     for (let i = drawStartTrackIndex; i < drawEndTrackIndex; i++) {
        const y = (i + 1) * trackHeightBase; // BASE coordinate
        context.beginPath();
        // Draw line across the visible beat range (in base coordinates)
        const lineLeftX = drawStartBeat * pixelsPerBeatBase;
        const lineRightX = drawEndBeat * pixelsPerBeatBase;
        context.moveTo(lineLeftX, y);
        context.lineTo(lineRightX, y);
        context.stroke();
     }

    // --- Draw MIDI Blocks (Visible Range Only) ---
    for (let trackIndex = drawStartTrackIndex; trackIndex < drawEndTrackIndex; trackIndex++) {
        const track = tracks[trackIndex];
        if (!track) continue; // Should not happen if indices are correct

        const trackTopY = trackIndex * trackHeightBase; // Base Y

        track.midiBlocks.forEach(block => {
            // Visibility Check (using BASE coordinates and visible beat range)
            const isHorizontallyVisible = block.endBeat > drawStartBeat && block.startBeat < drawEndBeat;

            if (isHorizontallyVisible) {
                const isSelected = block.id === selectedBlockId;
                const isBeingDragged = dragOperation !== 'none' && block.id === pendingUpdateBlock?.id;
                let alpha = 1;
                if (isBeingDragged) {
                    alpha = isCopyDrag ? 1 : DRAGGED_BLOCK_OPACITY;
                }

                // Call helper, passing trackIndex for base Y calculation
                drawMidiBlock(
                    context,
                    block,
                    trackIndex, // Pass index
                    isSelected,
                    alpha
                );
            }
        });
    }


    // --- Draw Disabled Area Overlay (Visible Range Only) ---
    const disabledAreaStartBeat = numMeasures * 4; // Use actual song measures
    if (drawEndBeat > disabledAreaStartBeat) { // Only draw if disabled area is visible
        const disabledAreaStartX = disabledAreaStartBeat * pixelsPerBeatBase; // Base X
        const disabledAreaVisibleX = Math.max(disabledAreaStartX, drawStartBeat * pixelsPerBeatBase);
        const disabledAreaVisibleEndX = drawEndBeat * pixelsPerBeatBase;

        context.fillStyle = DISABLED_AREA_COLOR;
        // Fill rect using BASE coordinates across visible track range
        const topY = drawStartTrackIndex * trackHeightBase;
        const bottomY = drawEndTrackIndex * trackHeightBase;
        context.fillRect(disabledAreaVisibleX, topY, disabledAreaVisibleEndX - disabledAreaVisibleX, bottomY - topY);
    }


    // --- Draw Pending ("Ghost") Block if Dragging (Check Visibility) ---
    if (dragOperation !== 'none' && pendingUpdateBlock && pendingTargetTrackId) {
        const targetTrackIndex = tracks.findIndex(t => t.id === pendingTargetTrackId);

        // Check if target track AND block are within the drawn range
        if (targetTrackIndex >= drawStartTrackIndex && targetTrackIndex < drawEndTrackIndex) {
            const isPendingHorizontallyVisible = pendingUpdateBlock.endBeat > drawStartBeat && pendingUpdateBlock.startBeat < drawEndBeat;

            if (isPendingHorizontallyVisible) {
                drawMidiBlock(
                    context,
                    pendingUpdateBlock,
                    targetTrackIndex, // Pass index
                    false,
                    DRAGGED_BLOCK_OPACITY
                );
            }
        }
    }

    // --- Restore Context ---
    context.restore(); // Remove transforms, clipping, etc.

  }, [
      // Key dependencies for drawing
      tracks,
      scrollLeft,
      scrollTop,
      visibleWidth,
      visibleHeight,
      horizontalZoom,
      verticalZoom,
      numMeasures, // For disabled area calculation
      renderMeasures, // For totalBaseWidth
      selectedBlockId,
      pendingUpdateBlock,
      pendingTargetTrackId,
      dragOperation,
      isCopyDrag,
      // Base dimensions and draw helper
      pixelsPerBeatBase,
      trackHeightBase,
      drawMidiBlock,
      // selectedWindow? // If needed for conditional drawing/logic
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


  // --- Coordinate Transformation Helper ---
  const getTimelineCoordsFromEvent = (e: React.MouseEvent<HTMLCanvasElement>): { beat: number; trackIndex: number; worldX: number; worldY: number } | null => {
    const canvas = canvasRef.current;
    const container = timelineAreaRef.current;
    if (!canvas || !container) return null;

    const rect = canvas.getBoundingClientRect(); // Use canvas rect

    // Mouse position relative to canvas element (CSS pixels)
    const cssPixelX = e.clientX - rect.left;
    const cssPixelY = e.clientY - rect.top;

    // Transform CSS pixels to world coordinates (base pixel space)
    const worldX = (cssPixelX + container.scrollLeft) / horizontalZoom;
    const worldY = (cssPixelY + container.scrollTop) / verticalZoom;

    // Convert world coordinates to beat and track index
    const beat = worldX / pixelsPerBeatBase;
    const trackIndex = Math.floor(worldY / trackHeightBase);

    return { beat, trackIndex, worldX, worldY };
  };


  // --- Canvas Event Handlers (Use Transformed Coords) ---
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setSelectedWindow('timelineView');
    if (e.button !== 0) return;

    const coords = getTimelineCoordsFromEvent(e);
    if (!coords) return;
    const { beat, trackIndex, worldX, worldY } = coords;

    if (trackIndex < 0 || trackIndex >= tracks.length) return; // Click outside track bounds

    const clickedTrack = tracks[trackIndex];
    let hitBlock: MIDIBlock | null = null;
    let hitEdge: 'start' | 'end' | null = null;

    // Hit detection using world coordinates (base pixels)
    const blockBaseTop = trackIndex * trackHeightBase;
    const blockPadding = trackHeightBase * BLOCK_VERTICAL_PADDING_FACTOR;
    const blockDrawTop = blockBaseTop + blockPadding;
    const blockDrawBottom = blockBaseTop + trackHeightBase - blockPadding;

    for (const block of clickedTrack.midiBlocks) {
        const blockStartX = block.startBeat * pixelsPerBeatBase;
        const blockEndX = block.endBeat * pixelsPerBeatBase;

        if (worldX >= blockStartX && worldX <= blockEndX &&
            worldY >= blockDrawTop && worldY <= blockDrawBottom)
        {
            hitBlock = block;
            // Check edge hits using world coordinates (adjust resize width by zoom?)
            const edgeWidthWorld = EDGE_RESIZE_WIDTH / horizontalZoom;
            if (worldX <= blockStartX + edgeWidthWorld) {
                hitEdge = 'start';
            } else if (worldX >= blockEndX - edgeWidthWorld) {
                hitEdge = 'end';
            }
            break;
        }
    }

    // Call gesture handlers - NOTE: These handlers in useTrackGestures
    // might expect screen coordinates (clientX) or world coordinates.
    // This needs to be consistent. Assuming they are updated to handle worldX/beat.
    const altKey = e.altKey;
    if (hitBlock && hitEdge === 'start') {
        e.stopPropagation();
        handleStartEdge(clickedTrack.id, hitBlock.id, e.clientX, altKey); // Pass original clientX for now, hook needs update
    } else if (hitBlock && hitEdge === 'end') {
        e.stopPropagation();
        handleEndEdge(clickedTrack.id, hitBlock.id, e.clientX, altKey); // Pass original clientX for now, hook needs update
    } else if (hitBlock) {
        e.stopPropagation();
        selectBlock(hitBlock.id);
        handleMoveBlock(clickedTrack.id, hitBlock.id, e.clientX, altKey); // Pass original clientX for now, hook needs update
    } else {
        selectBlock(null);
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
     setSelectedWindow('timelineView');
     const coords = getTimelineCoordsFromEvent(e);
     if (!coords) return;
     const { beat, trackIndex } = coords; // Use beat and trackIndex

     if (trackIndex < 0 || trackIndex >= tracks.length) return;
     const clickedTrackId = tracks[trackIndex].id;

     // Pass original event and trackId. Hook needs update if it uses event coords.
     handleDoubleClick(e, clickedTrackId);
  };

 const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setSelectedWindow('timelineView');
    e.preventDefault();
    const coords = getTimelineCoordsFromEvent(e);
    if (!coords) {
        handleContextMenu(e, null, null); // Show context menu even if coords fail?
        return;
    }
    const { beat, trackIndex, worldX, worldY } = coords;

    if (trackIndex < 0 || trackIndex >= tracks.length) {
        handleContextMenu(e, null, null); // Context menu outside tracks
        return;
    }

    const clickedTrack = tracks[trackIndex];
    let hitBlock: MIDIBlock | null = null;

    // Simplified Hit detection using world coordinates
    const blockBaseTop = trackIndex * trackHeightBase;
    const blockPadding = trackHeightBase * BLOCK_VERTICAL_PADDING_FACTOR;
    const blockDrawTop = blockBaseTop + blockPadding;
    const blockDrawBottom = blockBaseTop + trackHeightBase - blockPadding;

    for (const block of clickedTrack.midiBlocks) {
        const blockStartX = block.startBeat * pixelsPerBeatBase;
        const blockEndX = block.endBeat * pixelsPerBeatBase;
        if (worldX >= blockStartX && worldX <= blockEndX &&
            worldY >= blockDrawTop && worldY <= blockDrawBottom) {
            hitBlock = block;
            break;
        }
    }
    // Hook needs consistent coordinates (event vs world)
    handleContextMenu(e, hitBlock?.id ?? null, clickedTrack.id);
 };

 // Handle Mouse Move for Cursor Changes (Use World Coords)
 const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const coords = getTimelineCoordsFromEvent(e);
    if (!canvas || !coords) {
        if (canvas) canvas.style.cursor = 'default';
        return;
    };
    const { beat, trackIndex, worldX, worldY } = coords;

    let cursorStyle = 'default';

    if (trackIndex >= 0 && trackIndex < tracks.length) {
        const hoveredTrack = tracks[trackIndex];
        const blockBaseTop = trackIndex * trackHeightBase;
        const blockPadding = trackHeightBase * BLOCK_VERTICAL_PADDING_FACTOR;
        const blockDrawTop = blockBaseTop + blockPadding;
        const blockDrawBottom = blockBaseTop + trackHeightBase - blockPadding;
        const edgeWidthWorld = EDGE_RESIZE_WIDTH / horizontalZoom;

        for (const block of hoveredTrack.midiBlocks) {
            const blockStartX = block.startBeat * pixelsPerBeatBase;
            const blockEndX = block.endBeat * pixelsPerBeatBase;

            if (worldX >= blockStartX && worldX <= blockEndX &&
                worldY >= blockDrawTop && worldY <= blockDrawBottom)
            {
                if (worldX <= blockStartX + edgeWidthWorld || worldX >= blockEndX - edgeWidthWorld) {
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
 };

  // Mouse Leave handler remains the same
  const handleCanvasMouseLeave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default'; // Reset cursor when mouse leaves canvas
    }
  };


  return (
    <div
      ref={timelineAreaRef} // Ref for scroll/resize/coords
      className="all-tracks-timeline-view-container"
      style={{
        overflow: 'scroll', // Enable both scrollbars
        width: '100%',
        height: '100%', // Make container fill its parent space
        backgroundColor: '#222',
        position: 'relative', // Needed for positioning context menu maybe? Check hook.
        border: selectedWindow === 'timelineView'
          ? '1px dotted rgba(255, 255, 255, 0.4)'
          : '1px solid transparent',
        cursor: 'default' // Default cursor for the container
      }}
    >
      {/* Inner div to establish the full scrollable size */}
      <div style={{
           width: `${totalBaseWidth * horizontalZoom}px`,
           height: `${totalBaseHeight * verticalZoom}px`,
           position: 'relative', // To contain the absolute canvas
           pointerEvents: 'none' // Don't intercept mouse events for the canvas
         }}>
         <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onDoubleClick={handleCanvasDoubleClick}
            onContextMenu={handleCanvasContextMenu}
            onMouseMove={handleCanvasMouseMove} // Use updated handler
            onMouseLeave={handleCanvasMouseLeave}
            style={{
              display: 'block',
              position: 'absolute', // Position canvas absolutely within the scroll container
              top: 0,
              left: 0,
              // Width/height styles are set dynamically in useEffect to match container
            }}
          />
      </div>

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