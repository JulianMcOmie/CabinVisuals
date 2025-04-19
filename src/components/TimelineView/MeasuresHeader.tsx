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
const DISABLED_AREA_COLOR = 'rgba(0, 0, 0, 0.3)'; // Color for dimming extra measures
// --- Project Resize Constants ---
const PROJECT_RESIZE_HANDLE_WIDTH = 8; // Width of the triangle base
const PROJECT_RESIZE_HANDLE_HEIGHT_RATIO = 1.2; // Triangle height relative to width
const PROJECT_RESIZE_HANDLE_COLOR = 'rgba(200, 200, 200, 0.9)';
const PROJECT_RESIZE_AREA_PIXELS = 10; // Clickable pixel threshold around the handle
const PROJECT_RESIZE_HANDLE_GAP = 3; // Gap between last measure line and handle
const MIN_PROJECT_BEATS = BEATS_PER_MEASURE; // Minimum project length in beats (e.g., 1 measure)

interface MeasuresHeaderProps {
  horizontalZoom: number;
  pixelsPerBeatBase: number;
  numMeasures: number; // Actual measures in the song
  renderMeasures: number; // Total measures to render visually
}

function MeasuresHeader({
  horizontalZoom,
  pixelsPerBeatBase,
  numMeasures, // Actual song measures
  renderMeasures // Total measures to render
}: MeasuresHeaderProps) {
  const {
    seekTo,
    loopEnabled,
    loopStartBeat,
    loopEndBeat,
    setLoopRange,
    toggleLoop,
    setNumMeasures,
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
  const [isResizingProject, setIsResizingProject] = useState(false); // State for project resize drag

  // Calculate effective pixels per beat based on zoom
  const effectivePixelsPerBeat = pixelsPerBeatBase * horizontalZoom;
  const actualSongBeats = numMeasures * BEATS_PER_MEASURE; // Use prop

  // Calculate total render beats based on the renderMeasures prop
  const totalRenderBeats = renderMeasures * BEATS_PER_MEASURE;

  // --- Utility Functions (using effectivePixelsPerBeat) ---
  const calculateBeatFromX = useCallback((mouseX: number): number => {
    const totalWidth = effectivePixelsPerBeat * totalRenderBeats; // Use render width
    const clampedMouseX = Math.max(0, Math.min(mouseX, totalWidth));
    // Avoid division by zero if totalWidth is 0
    const clickedBeat = totalWidth > 0 ? (clampedMouseX / totalWidth) * totalRenderBeats : 0; // Use render beats
    // Clamp click/seek actions to actual song beats
    return Math.max(0, Math.min(clickedBeat, actualSongBeats));
  }, [totalRenderBeats, effectivePixelsPerBeat, actualSongBeats]);

  // Calculate beat from X without clamping to actual song length (used for resizing)
  const calculateUnclampedBeatFromX = useCallback((mouseX: number): number => {
    const totalWidth = effectivePixelsPerBeat * totalRenderBeats; // Use render width
    const clampedMouseX = Math.max(0, Math.min(mouseX, totalWidth));
    // Avoid division by zero if totalWidth is 0
    const clickedBeat = totalWidth > 0 ? (clampedMouseX / totalWidth) * totalRenderBeats : 0; // Use render beats
    return Math.max(0, clickedBeat); // Only clamp at 0, not actualSongBeats
  }, [totalRenderBeats, effectivePixelsPerBeat]);

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
              // Clamp movement to actual song beats
              if (newEnd > actualSongBeats) {
                  newEnd = actualSongBeats;
                  newStart = newEnd - loopDuration;
              }
              // Ensure start doesn't become negative after adjustment
              newStart = Math.max(0, newStart);
              // Ensure loop still meets minimum duration after clamping (and within song bounds)
              newEnd = Math.min(actualSongBeats, Math.max(newStart + minLoopDurationBeats, newEnd));
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
              // Clamp end resizing to actual song beats
              newEnd = Math.min(newEnd, actualSongBeats);
             }
            break;
    }

    if (newStart !== null && newEnd !== null && (newStart !== loopStartBeat || newEnd !== loopEndBeat)) {
      setLoopRange(newStart, newEnd);
    }

  }, [loopDragState, loopStartBeat, loopEndBeat, numMeasures, setLoopRange, calculateBeatFromX, actualSongBeats]); // Added loopStartBeat/EndBeat dependencies

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
      // --- Top Half: Initiate Loop Drag OR Project Resize ---
      event.preventDefault();

      // Check for Project Resize Handle interaction first
      const endOfProjectBeat = numMeasures * BEATS_PER_MEASURE;
      const handleBaseX = beatToX(endOfProjectBeat) + PROJECT_RESIZE_HANDLE_GAP;
      const handleTipX = handleBaseX + PROJECT_RESIZE_HANDLE_WIDTH;
      const handleMinX = handleBaseX - PROJECT_RESIZE_AREA_PIXELS / 2;
      const handleMaxX = handleTipX + PROJECT_RESIZE_AREA_PIXELS / 2;

      if (mouseX >= handleMinX && mouseX <= handleMaxX) {
        // Start Project Resizing
        setIsResizingProject(true);
        return; // Prevent loop drag logic
      }

      // --- If not resizing project, check for Loop interactions ---
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
      // Only update cursor if not currently dragging anything
      if (isResizingProject) {
        setCursorStyle('ew-resize');
        return;
      }
      if (loopDragState.type !== null || isSeeking) return;

      const mouseY = event.nativeEvent.offsetY;
      const mouseX = event.nativeEvent.offsetX;
      let newCursor = 'pointer'; // Default for bottom or outside loop

      if (mouseY < TOP_SECTION_HEIGHT) {
          const currentBeatRaw = calculateBeatFromX(mouseX);
          const handleBeatThreshold = HANDLE_PIXEL_THRESHOLD / effectivePixelsPerBeat; // Use effective value

          // Check for Project Resize Handle Hover first
          const endOfProjectBeat = numMeasures * BEATS_PER_MEASURE;
          const handleBaseX = beatToX(endOfProjectBeat) + PROJECT_RESIZE_HANDLE_GAP;
          const handleTipX = handleBaseX + PROJECT_RESIZE_HANDLE_WIDTH;
          const handleMinX = handleBaseX - PROJECT_RESIZE_AREA_PIXELS / 2;
          const handleMaxX = handleTipX + PROJECT_RESIZE_AREA_PIXELS / 2;

          if (mouseX >= handleMinX && mouseX <= handleMaxX) {
              newCursor = 'ew-resize';
          } else {
              // --- Check Loop Handle Hover ---
              newCursor = 'cell'; // Default for top section (creating/outside loop)
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
      }
      setCursorStyle(newCursor);
  }, [loopDragState.type, isSeeking, loopStartBeat, loopEndBeat, loopEnabled, calculateBeatFromX, effectivePixelsPerBeat, beatToX, numMeasures]); // Added resize dependencies

  // --- Project Resize Drag Handlers ---
  const handleProjectResizeMove = useCallback((event: MouseEvent) => {
    if (!isResizingProject || !overlayRef.current) return; // Check flag

    const overlayRect = overlayRef.current.getBoundingClientRect();
    const mouseX = event.clientX - overlayRect.left;
    const targetBeatRaw = calculateUnclampedBeatFromX(mouseX);

    // Quantize to the nearest beat, enforce minimum project beats
    const quantizedBeat = Math.max(MIN_PROJECT_BEATS, Math.round(targetBeatRaw));

    // Calculate the required number of measures to contain this beat
    const newNumMeasures = Math.max(1, Math.ceil(quantizedBeat / BEATS_PER_MEASURE)); // Ensure at least 1 measure

    // Only call setNumMeasures if it actually changes
    if (newNumMeasures !== numMeasures) {
         // Call the function from the store to update the actual project length
         setNumMeasures(newNumMeasures);
         // The parent component is responsible for reacting to this change,
         // potentially adjusting renderMeasures and scroll position if needed.
    }
  }, [isResizingProject, calculateUnclampedBeatFromX, numMeasures, setNumMeasures, actualSongBeats /* Recalculate if actualSongBeats changes */]);

  const handleProjectResizeEnd = useCallback(() => {
    if (isResizingProject) {
        setIsResizingProject(false);
    }
  }, [isResizingProject]);

  // Effect to manage global mouse listeners
  useEffect(() => {
    let currentMoveHandler: ((event: MouseEvent) => void) | null = null;
    let currentEndHandler: ((event: MouseEvent) => void) | null = null;

    if (isResizingProject) {
        currentMoveHandler = handleProjectResizeMove;
        currentEndHandler = handleProjectResizeEnd;
    } else if (loopDragState.type) {
        currentMoveHandler = handleLoopMove;
        currentEndHandler = handleLoopEnd;
    } else if (isSeeking) {
        currentMoveHandler = handleSeekMove;
        currentEndHandler = handleSeekEnd;
    }

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
  }, [
      isResizingProject, handleProjectResizeMove, handleProjectResizeEnd, // Resize state/handlers
      loopDragState.type, handleLoopMove, handleLoopEnd,                 // Loop state/handlers
      isSeeking, handleSeekMove, handleSeekEnd                            // Seek state/handlers
  ]);

  // Draw canvas (with DPR and dynamic rendering)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = effectivePixelsPerBeat * totalRenderBeats; // Use render beats
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

    // --- Draw Disabled Area Background ---
    const disabledAreaStartX = beatToX(actualSongBeats);
    ctx.fillStyle = DISABLED_AREA_COLOR;
    ctx.fillRect(disabledAreaStartX, 0, logicalWidth - disabledAreaStartX, logicalHeight);

    // --- Draw Loop Region (Top Half) - Constrained by actualSongBeats ---
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

    // --- Draw Project Resize Handle (Top Half) ---
    const endOfProjectBeat = numMeasures * BEATS_PER_MEASURE;
    const handleBaseX = beatToX(endOfProjectBeat) + PROJECT_RESIZE_HANDLE_GAP;
    // Use logicalWidth declared earlier in the effect

    if (handleBaseX < logicalWidth) { // Only draw if visible
        const handleTipX = handleBaseX + PROJECT_RESIZE_HANDLE_WIDTH;
        const handleCenterY = TOP_SECTION_HEIGHT / 2;
        const handleHeight = PROJECT_RESIZE_HANDLE_WIDTH * PROJECT_RESIZE_HANDLE_HEIGHT_RATIO;
        const topY = handleCenterY - handleHeight / 2;
        const bottomY = handleCenterY + handleHeight / 2;

        ctx.fillStyle = PROJECT_RESIZE_HANDLE_COLOR;
        ctx.beginPath();
        ctx.moveTo(handleBaseX, topY);      // Top left corner of base
        ctx.lineTo(handleBaseX, bottomY);   // Bottom left corner of base
        ctx.lineTo(handleTipX, handleCenterY); // Pointy tip to the right
        ctx.closePath();
        ctx.fill();
    }

    // --- Draw Dividing Line ---
    ctx.beginPath();
    ctx.moveTo(0, TOP_SECTION_HEIGHT + 0.5); // +0.5 for sharpness
    ctx.lineTo(logicalWidth, TOP_SECTION_HEIGHT + 0.5);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- Dynamic Grid Lines and Labels ---
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

    for (let beat = 0; beat <= totalRenderBeats; beat += 0.25) { // Iterate smallest unit up to render limit
        const x = beatToX(beat) + 0.5; // +0.5 for sharpness
        const isMeasureStart = beat % BEATS_PER_MEASURE === 0;
        const isBeatStart = beat % 1 === 0;
        const measureNumber = Math.floor(beat / BEATS_PER_MEASURE) + 1;
        const isBeyondSong = beat > actualSongBeats; // Check if beyond actual song length

        let drawLine = false;
        let lineLength = 5; // Default shortest line (sub-beat)
        let lineWidth = 0.5;
        // Dimmer colors for lines beyond the song length
        let baseStrokeStyle = isBeyondSong ? '#333' : '#444'; // Base style lighter for active area
        let measureStrokeStyle = isBeyondSong ? '#555' : '#888';
        let beatStrokeStyle = isBeyondSong ? '#444' : '#666';
        let strokeStyle = baseStrokeStyle;
        let drawLabel = false;

        if (isMeasureStart) {
            // Always draw measure lines
            drawLine = true;
            lineLength = HEADER_HEIGHT - TOP_SECTION_HEIGHT; // Full height in bottom
            lineWidth = 1;
            strokeStyle = measureStrokeStyle;

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
                     strokeStyle = beatStrokeStyle;
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
                     strokeStyle = baseStrokeStyle; // Use the base subdivision style
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
            // Dimmer color for labels beyond the song length
            ctx.fillStyle = isBeyondSong ? '#666' : 'white';
            let label = '';
            if (subdivisionLevel === 'sub_beat') {
                const beatInMeasure = beat % BEATS_PER_MEASURE;
                label = `${measureNumber}.${beatInMeasure + 1}`; // e.g., 1.1, 1.2, etc. (using 1-based beat)
            } else if (subdivisionLevel === 'beat') {
                 label = `${measureNumber}.${beat % BEATS_PER_MEASURE + 1}`; // e.g., 1.1, 1.2 etc.
            } else { // Measure level labels
                 label = measureNumber.toString();
            }

            ctx.fillText(label, x + 4, 2); // Padding
            lastLabelX = x; // Update last label position
        }
    }

  }, [
      // Include new props in dependencies
      numMeasures,
      renderMeasures,
      // Existing dependencies
      loopEnabled,
      loopStartBeat,
      loopEndBeat,
      beatToX,
      effectivePixelsPerBeat,
      actualSongBeats, // Derived from numMeasures
      totalRenderBeats // Derived from renderMeasures
  ]);

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
        width: `${effectivePixelsPerBeat * totalRenderBeats}px` // Use render beats for width
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
        onMouseLeave={() => {if (!isResizingProject && !loopDragState.type && !isSeeking) setCursorStyle('pointer')}} // Reset cursor only if not dragging
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