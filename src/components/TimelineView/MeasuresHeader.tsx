import React, { useRef, useEffect, useState, useCallback } from 'react';
import useStore from '../../store/store';

// Helper function for quantization (adjust as needed)
const quantizeBeat = (beat: number): number => {
  return Math.round(beat);
};

// Constants
// PIXELS_PER_BEAT is now calculated from props
const BEATS_PER_MEASURE = 4;
const HEADER_HEIGHT = 40;
const TOP_SECTION_HEIGHT = HEADER_HEIGHT / 2;
const HANDLE_PIXEL_THRESHOLD = 10; // Pixel sensitivity for grabbing handles
const MIN_LABEL_SPACING_PIXELS = 40; // Minimum pixels between measure/beat labels
const MIN_SUBDIVISION_SPACING_PIXELS = 10; // Minimum pixels between beat subdivision lines

interface MeasuresHeaderProps {
  horizontalZoom: number;
  pixelsPerBeatBase: number;
}

function MeasuresHeader({ horizontalZoom, pixelsPerBeatBase }: MeasuresHeaderProps) {
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

  // Calculate effective pixels per beat based on zoom
  const effectivePixelsPerBeat = pixelsPerBeatBase * horizontalZoom;

  // --- Utility Functions (using effectivePixelsPerBeat) ---
  const calculateBeatFromX = useCallback((mouseX: number): number => {
    const totalWidth = effectivePixelsPerBeat * BEATS_PER_MEASURE * numMeasures;
    const clampedMouseX = Math.max(0, Math.min(mouseX, totalWidth));
    // Avoid division by zero if totalWidth is 0
    const clickedBeat = totalWidth > 0 ? (clampedMouseX / totalWidth) * (numMeasures * BEATS_PER_MEASURE) : 0;
    const totalBeats = numMeasures * BEATS_PER_MEASURE;
    return Math.max(0, Math.min(clickedBeat, totalBeats));
  }, [numMeasures, effectivePixelsPerBeat]);

  // Convert beat number to pixel X coordinate
  const beatToX = useCallback((beat: number): number => {
      return beat * effectivePixelsPerBeat;
  }, [effectivePixelsPerBeat]);

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
    // Quantization might need adjustment based on zoom level for fine control
    const currentBeat = quantizeBeat(currentBeatRaw);

    const { type, initialBeat, initialStartBeat, initialEndBeat } = loopDragState;
    let newStart = initialStartBeat;
    let newEnd = initialEndBeat;

    // Use a minimum loop duration in *beats*, independent of zoom
    const minLoopDurationBeats = 0.25; // Example: minimum quarter beat

    switch (type) {
        case 'creating':
            const start = Math.min(initialBeat, currentBeat);
            const end = Math.max(initialBeat, currentBeat);
            newStart = start;
            newEnd = Math.max(end, start + minLoopDurationBeats); // Ensure min duration
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
              // Ensure loop still meets minimum duration after clamping
              newEnd = Math.max(newStart + minLoopDurationBeats, newEnd);
            }
            break;
        case 'resizing-start':
            if (initialEndBeat !== null) {
              newStart = Math.min(currentBeat, initialEndBeat - minLoopDurationBeats); // Prevent start passing end (with min duration)
              newEnd = initialEndBeat;
              newStart = Math.max(0, newStart); // Prevent start < 0
            }
            break;
        case 'resizing-end':
             if (initialStartBeat !== null) {
              newStart = initialStartBeat;
              newEnd = Math.max(currentBeat, initialStartBeat + minLoopDurationBeats); // Prevent end passing start (with min duration)
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
      // Check if drag type was 'creating' OR 'moving' and it was a click
      if ((loopDragState.type === 'creating' || loopDragState.type === 'moving') && overlayRef.current) {
          const overlayRect = overlayRef.current.getBoundingClientRect();
          const finalMouseX = event.clientX - overlayRect.left;
          // Use a small pixel threshold to determine a "click"
          if (Math.abs(finalMouseX - loopDragState.initialMouseX) < 5) {
              // Quantize based on the current effective pixels per beat
              const clickedBeat = calculateBeatFromX(finalMouseX);
              // Use a small beat threshold for toggling based on quantization resolution
              const beatClickThreshold = 0.5 / effectivePixelsPerBeat; // Allow clicking near the quantized beat

              // Check if clicking on an existing loop to toggle it *off*
              if (loopEnabled && loopStartBeat !== null && loopEndBeat !== null && clickedBeat >= loopStartBeat - beatClickThreshold && clickedBeat < loopEndBeat + beatClickThreshold) {
                  toggleLoop();
              }
              // Check if clicking to toggle *on* an existing *disabled* loop
              else if (!loopEnabled && loopStartBeat !== null && loopEndBeat !== null && clickedBeat >= loopStartBeat - beatClickThreshold && clickedBeat < loopEndBeat + beatClickThreshold) {
                   toggleLoop();
              }
              // Otherwise (clicking empty space), do nothing on click, let drag create
          }
      }

      // Reset loop drag state regardless
      setLoopDragState({ type: null, initialBeat: 0, initialMouseX: 0, initialStartBeat: null, initialEndBeat: null });
  }, [loopDragState, toggleLoop, loopEnabled, loopStartBeat, loopEndBeat, calculateBeatFromX, effectivePixelsPerBeat]); // Added dependencies

  // --- Combined Mouse Down Handler ---
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const mouseY = event.nativeEvent.offsetY;
    const mouseX = event.nativeEvent.offsetX;
    const clickedBeatRaw = calculateBeatFromX(mouseX);
    // Quantization for initial beat might need context
    const clickedBeat = quantizeBeat(clickedBeatRaw);

    if (mouseY < TOP_SECTION_HEIGHT) {
      // --- Top Half: Initiate Loop Drag ---
      event.preventDefault();
      const handleBeatThreshold = HANDLE_PIXEL_THRESHOLD / effectivePixelsPerBeat; // Use effective value
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
        initialBeat: clickedBeat, // Use quantized beat for initial state?
        initialMouseX: mouseX, // Store initial X for click check
        initialStartBeat: loopStartBeat,
        initialEndBeat: loopEndBeat
      });

    } else {
      // --- Bottom Half: Initiate Seeking ---
      event.preventDefault();
      setIsSeeking(true);
      seekTo(clickedBeatRaw); // Use raw beat for seeking
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
          const handleBeatThreshold = HANDLE_PIXEL_THRESHOLD / effectivePixelsPerBeat; // Use effective value
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
  }, [loopDragState.type, isSeeking, loopStartBeat, loopEndBeat, loopEnabled, calculateBeatFromX, effectivePixelsPerBeat]);

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

  // Draw canvas (with DPR and dynamic rendering)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = effectivePixelsPerBeat * BEATS_PER_MEASURE * numMeasures;
    const logicalHeight = HEADER_HEIGHT;

    // Prevent rendering if width is zero or negative
    if (logicalWidth <= 0) {
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.width = `0px`;
        canvas.style.height = `${logicalHeight}px`;
        return;
    }

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
      ctx.fillRect(loopStartX, 0, Math.max(0, loopWidth), TOP_SECTION_HEIGHT); // Ensure width isn't negative

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

    // --- Dynamic Grid Lines and Labels ---
    const totalBeats = numMeasures * BEATS_PER_MEASURE;
    let lastLabelX = -Infinity; // Track the last drawn label position

    // Determine subdivision level based on pixels per beat
    let subdivisionLevel: 'beat' | 'measure' | 'measure_2' | 'measure_4' | 'sub_beat' = 'measure';
    let beatStep = BEATS_PER_MEASURE; // Default to measures

    if (effectivePixelsPerBeat > 150) {
        subdivisionLevel = 'sub_beat';
        beatStep = 0.25; // Show quarter notes
    } else if (effectivePixelsPerBeat > 50) {
        subdivisionLevel = 'beat';
        beatStep = 1; // Show individual beats
    } else if (effectivePixelsPerBeat > 25) {
        subdivisionLevel = 'measure';
        beatStep = BEATS_PER_MEASURE; // Show measures
    } else if (effectivePixelsPerBeat > 12) {
        subdivisionLevel = 'measure_2';
        beatStep = BEATS_PER_MEASURE * 2; // Show every 2 measures
    } else {
        subdivisionLevel = 'measure_4';
        beatStep = BEATS_PER_MEASURE * 4; // Show every 4 measures
    }

    ctx.fillStyle = 'white';
    ctx.font = 'bold 11px sans-serif'; // Slightly smaller font
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let beat = 0; beat <= totalBeats; beat += 0.25) { // Iterate smallest unit
        const x = beatToX(beat) + 0.5; // +0.5 for sharpness
        const isMeasureStart = beat % BEATS_PER_MEASURE === 0;
        const isBeatStart = beat % 1 === 0;
        const measureNumber = Math.floor(beat / BEATS_PER_MEASURE) + 1;

        let drawLine = false;
        let lineLength = 5; // Default shortest line (sub-beat)
        let lineWidth = 0.5;
        let strokeStyle = '#444'; // Lightest lines
        let drawLabel = false;

        if (isMeasureStart) {
            // Always draw measure lines
            drawLine = true;
            lineLength = HEADER_HEIGHT - TOP_SECTION_HEIGHT; // Full height in bottom
            lineWidth = 1;
            strokeStyle = '#888'; // Darker measure line

            // Check label spacing for measures based on subdivision level
            if ((subdivisionLevel === 'measure' && (beat / BEATS_PER_MEASURE) % 1 === 0) ||
                (subdivisionLevel === 'measure_2' && (beat / BEATS_PER_MEASURE) % 2 === 0) ||
                (subdivisionLevel === 'measure_4' && (beat / BEATS_PER_MEASURE) % 4 === 0)) {
                if (x - lastLabelX >= MIN_LABEL_SPACING_PIXELS) {
                    drawLabel = true;
                }
            }
        } else if (isBeatStart) {
            // Draw beat lines if spacing allows or if showing beats/sub-beats
             if (subdivisionLevel === 'beat' || subdivisionLevel === 'sub_beat') {
                 if (effectivePixelsPerBeat >= MIN_SUBDIVISION_SPACING_PIXELS) {
                     drawLine = true;
                     lineLength = HEADER_HEIGHT - TOP_SECTION_HEIGHT - 5; // Medium length
                     lineWidth = 0.75;
                     strokeStyle = '#666';
                 }
                 // Check label spacing for beats
                 if (subdivisionLevel === 'beat' && x - lastLabelX >= MIN_LABEL_SPACING_PIXELS) {
                     drawLabel = true;
                 }
             }
        } else { // Sub-beat subdivisions
            if (subdivisionLevel === 'sub_beat') {
                 if (effectivePixelsPerBeat * 0.25 >= MIN_SUBDIVISION_SPACING_PIXELS) {
                     drawLine = true;
                     lineLength = HEADER_HEIGHT - TOP_SECTION_HEIGHT - 10; // Shortest length
                     // lineWidth = 0.5; (already default)
                     // strokeStyle = '#444'; (already default)
                 }
                 // Check label spacing for sub-beats
                 if (x - lastLabelX >= MIN_LABEL_SPACING_PIXELS) {
                      drawLabel = true;
                 }
            }
        }

        if (drawLine) {
            ctx.beginPath();
            ctx.moveTo(x, TOP_SECTION_HEIGHT);
            ctx.lineTo(x, TOP_SECTION_HEIGHT + lineLength);
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }

        if (drawLabel) {
            let label = '';
            if (subdivisionLevel === 'sub_beat') {
                const beatInMeasure = beat % BEATS_PER_MEASURE;
                label = `${measureNumber}.${beatInMeasure + 1}`; // e.g., 1.1, 1.2, etc. (using 1-based beat)
            } else if (subdivisionLevel === 'beat') {
                 label = `${measureNumber}.${beat % BEATS_PER_MEASURE + 1}`; // e.g., 1.1, 1.2 etc.
            } else { // Measure level labels
                 label = measureNumber.toString();
            }

            // Check text width to avoid overlap near the end? (optional)
            // const textWidth = ctx.measureText(label).width;
            // if (x + textWidth < logicalWidth - 5) { ... }
            ctx.fillText(label, x + 4, 2); // Padding
            lastLabelX = x; // Update last label position
        }
    }

  }, [numMeasures, loopEnabled, loopStartBeat, loopEndBeat, beatToX, effectivePixelsPerBeat]); // Added dependencies

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
        position: 'relative', // Needed for absolute canvas positioning
        overflow: 'hidden', // Hide canvas overflow
        width: `${effectivePixelsPerBeat * BEATS_PER_MEASURE * numMeasures}px` // Dynamic width
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
            position: 'absolute', // Style width/height set in useEffect for DPR
            top: 0,
            left: 0,
        }}
      />
      <div
        ref={overlayRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleOverlayMouseMove} // Add mouse move for cursor updates
        onMouseLeave={() => setCursorStyle('pointer')} // Reset cursor on leave
        style={{
          position: 'absolute', // Overlay covers canvas
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          zIndex: 1,
          cursor: cursorStyle // Use dynamic cursor state
        }}
      />
    </div>
  );
}

export default MeasuresHeader; 