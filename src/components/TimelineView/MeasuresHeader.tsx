import React, { useRef, useEffect, useState, useCallback } from 'react';
import useStore from '../../store/store';

// Helper function for quantization (adjust as needed)
const quantizeBeat = (beat: number): number => {
  return Math.round(beat);
};

// Constants
const PIXELS_PER_BEAT = 100;
const BEATS_PER_MEASURE = 4;
const HEADER_HEIGHT = 40;
const TOP_SECTION_HEIGHT = HEADER_HEIGHT / 2;
const HANDLE_PIXEL_THRESHOLD = 10; // Pixel sensitivity for grabbing handles

function MeasuresHeader() {
  const {
    seekTo,
    numMeasures,
    loopEnabled,
    loopStartBeat,
    loopEndBeat,
    setLoopRange,
    toggleLoop,
    currentBeat // Need currentBeat for final check in handleLoopEnd
  } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [isSeeking, setIsSeeking] = useState(false);
  const [loopDragState, setLoopDragState] = useState<{
    type: 'creating' | 'moving' | 'resizing-start' | 'resizing-end' | null;
    initialBeat: number;
    initialMouseX: number; // Store initial mouse X for click detection
    initialStartBeat: number | null;
    initialEndBeat: number | null;
  }>({ type: null, initialBeat: 0, initialMouseX: 0, initialStartBeat: null, initialEndBeat: null });
  const [cursorStyle, setCursorStyle] = useState('pointer'); // State for dynamic cursor

  // --- Utility Functions ---
  const calculateBeatFromX = useCallback((mouseX: number): number => {
    const totalWidth = PIXELS_PER_BEAT * BEATS_PER_MEASURE * numMeasures;
    const clampedMouseX = Math.max(0, Math.min(mouseX, totalWidth));
    const clickedBeat = (clampedMouseX / totalWidth) * (numMeasures * BEATS_PER_MEASURE);
    const totalBeats = numMeasures * BEATS_PER_MEASURE;
    return Math.max(0, Math.min(clickedBeat, totalBeats));
  }, [numMeasures]);

  // Convert beat number to pixel X coordinate
  const beatToX = (beat: number): number => {
      return beat * PIXELS_PER_BEAT;
  }

  // --- Seeking Handlers (Bottom Half) ---
  const handleSeekMove = useCallback((event: MouseEvent) => {
    if (!isSeeking || !overlayRef.current) return;
    const overlayRect = overlayRef.current.getBoundingClientRect();
    const mouseX = event.clientX - overlayRect.left;
    const targetBeat = calculateBeatFromX(mouseX);
    seekTo(targetBeat);
  }, [isSeeking, seekTo, calculateBeatFromX]);

  const handleSeekEnd = useCallback(() => {
    if (isSeeking) {
      setIsSeeking(false);
    }
  }, [isSeeking]);

  // --- Loop Drag Handlers (Top Half) ---
  const handleLoopMove = useCallback((event: MouseEvent) => {
    if (!loopDragState.type || !overlayRef.current) return;

    const overlayRect = overlayRef.current.getBoundingClientRect();
    const mouseX = event.clientX - overlayRect.left;
    const currentBeatRaw = calculateBeatFromX(mouseX);
    const currentBeat = quantizeBeat(currentBeatRaw);

    const { type, initialBeat, initialStartBeat, initialEndBeat } = loopDragState;
    let newStart = initialStartBeat;
    let newEnd = initialEndBeat;

    // Use a minimum loop duration (e.g., 1 beat) to prevent zero-width loops
    const minLoopDuration = 1;

    switch (type) {
        case 'creating':
            const start = Math.min(initialBeat, currentBeat);
            const end = Math.max(initialBeat, currentBeat);
            newStart = start;
            newEnd = Math.max(end, start + minLoopDuration); // Ensure min duration
            break;
        case 'moving':
            if (initialStartBeat !== null && initialEndBeat !== null) {
              const delta = currentBeat - initialBeat;
              const loopDuration = initialEndBeat - initialStartBeat;
              newStart = initialStartBeat + delta;
              if (newStart < 0) {
                  newStart = 0;
              }
              newEnd = newStart + loopDuration;
              const totalBeats = numMeasures * BEATS_PER_MEASURE;
              if (newEnd > totalBeats) {
                  newEnd = totalBeats;
                  newStart = newEnd - loopDuration;
              }
              // Ensure start doesn't become negative after adjustment
              newStart = Math.max(0, newStart);
            }
            break;
        case 'resizing-start':
            if (initialEndBeat !== null) {
              newStart = Math.min(currentBeat, initialEndBeat - minLoopDuration); // Prevent start passing end (with min duration)
              newEnd = initialEndBeat;
              newStart = Math.max(0, newStart); // Prevent start < 0
            }
            break;
        case 'resizing-end':
             if (initialStartBeat !== null) {
              newStart = initialStartBeat;
              newEnd = Math.max(currentBeat, initialStartBeat + minLoopDuration); // Prevent end passing start (with min duration)
              const totalBeats = numMeasures * BEATS_PER_MEASURE;
              newEnd = Math.min(newEnd, totalBeats); // Prevent end > totalBeats
             }
            break;
    }

    if (newStart !== null && newEnd !== null && (newStart !== loopStartBeat || newEnd !== loopEndBeat)) {
      setLoopRange(newStart, newEnd);
    }

  }, [loopDragState, loopStartBeat, loopEndBeat, numMeasures, setLoopRange, calculateBeatFromX]); // Added loopStartBeat/EndBeat dependencies

  const handleLoopEnd = useCallback((event: MouseEvent) => {
      // Check if it was a click (minimal movement) for toggling
      if (loopDragState.type === 'creating' && overlayRef.current) {
          const overlayRect = overlayRef.current.getBoundingClientRect();
          const finalMouseX = event.clientX - overlayRect.left;
          // Use a small pixel threshold to determine a "click"
          if (Math.abs(finalMouseX - loopDragState.initialMouseX) < 5) {
              // Only toggle if a loop doesn't already exist exactly where clicked
              const clickedBeat = quantizeBeat(calculateBeatFromX(finalMouseX));
              // Check if clicking on an existing loop to toggle it *off*
              if (loopEnabled && loopStartBeat !== null && loopEndBeat !== null && clickedBeat >= loopStartBeat && clickedBeat < loopEndBeat) {
                  toggleLoop();
              }
              // Check if clicking to toggle *on* an existing *disabled* loop
              else if (!loopEnabled && loopStartBeat !== null && loopEndBeat !== null && clickedBeat >= loopStartBeat && clickedBeat < loopEndBeat) {
                   toggleLoop(); 
              }
              // Otherwise (clicking empty space), do nothing on click, let drag create
          }
      }

      // Reset loop drag state regardless
      setLoopDragState({ type: null, initialBeat: 0, initialMouseX: 0, initialStartBeat: null, initialEndBeat: null });
  }, [loopDragState, toggleLoop, loopEnabled, loopStartBeat, loopEndBeat, calculateBeatFromX]); // Added dependencies

  // --- Combined Mouse Down Handler ---
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const mouseY = event.nativeEvent.offsetY;
    const mouseX = event.nativeEvent.offsetX;
    const clickedBeatRaw = calculateBeatFromX(mouseX);
    const clickedBeat = quantizeBeat(clickedBeatRaw);

    if (mouseY < TOP_SECTION_HEIGHT) {
      // --- Top Half: Initiate Loop Drag ---
      event.preventDefault();
      const handleBeatThreshold = HANDLE_PIXEL_THRESHOLD / PIXELS_PER_BEAT;
      let dragType: typeof loopDragState.type = 'creating';

      if (loopStartBeat !== null && loopEndBeat !== null) {
          const startDist = Math.abs(clickedBeatRaw - loopStartBeat);
          const endDist = Math.abs(clickedBeatRaw - loopEndBeat);
          const minHandleDist = handleBeatThreshold * 1.5; // Slightly larger beat threshold for handles

          if (startDist <= minHandleDist) {
              dragType = 'resizing-start';
          } else if (endDist <= minHandleDist) {
              dragType = 'resizing-end';
          } else if (loopEnabled && clickedBeatRaw >= loopStartBeat && clickedBeatRaw < loopEndBeat) {
              dragType = 'moving';
          } else if (!loopEnabled && clickedBeatRaw >= loopStartBeat && clickedBeatRaw < loopEndBeat) {
              // Clicking inactive loop body starts creation drag
              dragType = 'creating';
          }
      }

      setLoopDragState({
        type: dragType,
        initialBeat: clickedBeat,
        initialMouseX: mouseX, // Store initial X for click check
        initialStartBeat: loopStartBeat,
        initialEndBeat: loopEndBeat
      });

    } else {
      // --- Bottom Half: Initiate Seeking ---
      event.preventDefault();
      setIsSeeking(true);
      seekTo(clickedBeatRaw);
    }
  };

  // --- Overlay Mouse Move (for Cursor) ---
  const handleOverlayMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
      // Only update cursor if not currently dragging
      if (loopDragState.type !== null || isSeeking) return;

      const mouseY = event.nativeEvent.offsetY;
      const mouseX = event.nativeEvent.offsetX;
      let newCursor = 'pointer'; // Default for bottom or outside loop

      if (mouseY < TOP_SECTION_HEIGHT) {
          const currentBeatRaw = calculateBeatFromX(mouseX);
          const handleBeatThreshold = HANDLE_PIXEL_THRESHOLD / PIXELS_PER_BEAT;
          newCursor = 'cell'; // Default for top section (creating)

          if (loopStartBeat !== null && loopEndBeat !== null) {
              const startDist = Math.abs(currentBeatRaw - loopStartBeat);
              const endDist = Math.abs(currentBeatRaw - loopEndBeat);
              const minHandleDist = handleBeatThreshold * 1.5;

              if (startDist <= minHandleDist || endDist <= minHandleDist) {
                  newCursor = 'ew-resize'; // Resizing L/R
              } else if (loopEnabled && currentBeatRaw >= loopStartBeat && currentBeatRaw < loopEndBeat) {
                  newCursor = 'grab'; // Moving active loop
              } else if (!loopEnabled && currentBeatRaw >= loopStartBeat && currentBeatRaw < loopEndBeat) {
                  // Hovering inactive loop body shows default create cursor
                  newCursor = 'cell'; 
              }
          }
      }
      setCursorStyle(newCursor);
  }, [loopDragState.type, isSeeking, loopStartBeat, loopEndBeat, loopEnabled, calculateBeatFromX]);

  // Effect to manage global mouse listeners
  useEffect(() => {
    const isLoopDragging = loopDragState.type !== null;
    const currentMoveHandler = isLoopDragging ? handleLoopMove : (isSeeking ? handleSeekMove : null);
    const currentEndHandler = isLoopDragging ? handleLoopEnd : (isSeeking ? handleSeekEnd : null);

    if (currentMoveHandler) {
      window.addEventListener('mousemove', currentMoveHandler);
    }
    if (currentEndHandler) {
      window.addEventListener('mouseup', currentEndHandler);
    }

    return () => {
      if (currentMoveHandler) {
        window.removeEventListener('mousemove', currentMoveHandler);
      }
      if (currentEndHandler) {
        window.removeEventListener('mouseup', currentEndHandler);
      }
    };
  }, [isSeeking, loopDragState.type, handleSeekMove, handleSeekEnd, handleLoopMove, handleLoopEnd]);

  // Draw canvas (with DPR)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = PIXELS_PER_BEAT * BEATS_PER_MEASURE * numMeasures;
    const logicalHeight = HEADER_HEIGHT;

    // Set canvas physical dimensions (scaled by DPR)
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;

    // Set canvas logical dimensions (CSS pixels)
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    // Scale the context to ensure drawing commands use logical pixels
    ctx.scale(dpr, dpr);

    // --- Clear canvas ---
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    // --- Draw Loop Region (Top Half) ---
    if (loopStartBeat !== null && loopEndBeat !== null) {
      const loopStartX = beatToX(loopStartBeat);
      const loopEndX = beatToX(loopEndBeat);
      const loopWidth = loopEndX - loopStartX;

      ctx.fillStyle = loopEnabled ? 'rgba(80, 120, 255, 0.5)' : 'rgba(150, 150, 150, 0.5)';
      ctx.fillRect(loopStartX, 0, loopWidth, TOP_SECTION_HEIGHT);

      const handleIndicatorWidth = 4;
      ctx.fillStyle = loopEnabled ? 'rgba(50, 80, 200, 0.8)' : 'rgba(100, 100, 100, 0.8)';
      ctx.fillRect(loopStartX - handleIndicatorWidth / 2, 0, handleIndicatorWidth, TOP_SECTION_HEIGHT);
      ctx.fillRect(loopEndX - handleIndicatorWidth / 2, 0, handleIndicatorWidth, TOP_SECTION_HEIGHT);
    }

    // --- Draw Dividing Line ---
    ctx.beginPath();
    ctx.moveTo(0, TOP_SECTION_HEIGHT + 0.5); // +0.5 for sharpness
    ctx.lineTo(logicalWidth, TOP_SECTION_HEIGHT + 0.5);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- Draw Grid Lines and Beat Subdivisions (Bottom Half) ---
    const totalBeats = numMeasures * BEATS_PER_MEASURE;
    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = beat * PIXELS_PER_BEAT + 0.5; // +0.5 for sharpness
      ctx.beginPath();
      ctx.moveTo(x, TOP_SECTION_HEIGHT);

      if (beat % BEATS_PER_MEASURE === 0) {
        // Measure line (full height in bottom section)
        ctx.lineTo(x, HEADER_HEIGHT);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
      } else {
        // Beat subdivision line (shorter)
        ctx.lineTo(x, HEADER_HEIGHT - 5);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    }

    // --- Draw Measure Numbers (Top Half) ---
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let measure = 0; measure < numMeasures; measure++) {
        const x = measure * BEATS_PER_MEASURE * PIXELS_PER_BEAT + 5; // Padding
        const y = 2;
        ctx.fillText((measure + 1).toString(), x, y);
    }

  }, [numMeasures, loopEnabled, loopStartBeat, loopEndBeat, beatToX]); // Removed pixel constants, added beatToX

  // --- Component Render ---
  return (
    <div
      ref={containerRef}
      className="measures-header"
      style={{
        display: 'flex',
        height: `${HEADER_HEIGHT}px`,
        borderBottom: '1px solid #ccc',
        backgroundColor: 'black',
        width: '3000px' // Adjust or make dynamic as needed
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
            position: 'absolute', // Style width/height set in useEffect for DPR
        }}
      />
      <div
        ref={overlayRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleOverlayMouseMove} // Add mouse move for cursor updates
        onMouseLeave={() => setCursorStyle('pointer')} // Reset cursor on leave
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          zIndex: 1,
          cursor: cursorStyle // Use dynamic cursor state
        }}
      />
    </div>
  );
}

export default MeasuresHeader; 