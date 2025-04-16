import React, { useRef, useEffect, useState, useCallback } from 'react';
import useStore from '../../store/store';

// Helper function for quantization (adjust as needed)
const quantizeBeat = (beat: number): number => {
  return Math.round(beat); // Simple rounding to the nearest beat
};

function MeasuresHeader() {
  const { 
    seekTo, 
    numMeasures, 
    loopEnabled, 
    loopStartBeat, 
    loopEndBeat, 
    // Get loop actions from store
    setLoopRange,
    toggleLoop
  } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [isSeeking, setIsSeeking] = useState(false);
  const [loopDragState, setLoopDragState] = useState<{
    type: 'creating' | 'moving' | 'resizing-start' | 'resizing-end' | null;
    initialBeat: number;
    initialStartBeat: number | null;
    initialEndBeat: number | null;
  }>({ type: null, initialBeat: 0, initialStartBeat: null, initialEndBeat: null });

  const pixelsPerBeat = 100; 
  const beatsPerMeasure = 4;
  const headerHeight = 40;
  const topSectionHeight = headerHeight / 2;
  const bottomSectionHeight = headerHeight / 2;

  // --- Utility Functions ---
  const calculateBeatFromX = (mouseX: number): number => {
    const totalWidth = pixelsPerBeat * beatsPerMeasure * numMeasures;
    // Clamp mouseX to prevent calculation errors if dragging outside bounds
    const clampedMouseX = Math.max(0, Math.min(mouseX, totalWidth));
    const clickedBeat = (clampedMouseX / totalWidth) * (numMeasures * beatsPerMeasure);
    const totalBeats = numMeasures * beatsPerMeasure;
    return Math.max(0, Math.min(clickedBeat, totalBeats));
  };

  // Convert beat number to pixel X coordinate
  const beatToX = (beat: number): number => {
      return beat * pixelsPerBeat;
  }

  // --- Seeking Handlers (Bottom Half) ---
  const handleSeekMove = useCallback((event: MouseEvent) => {
    if (!isSeeking || !overlayRef.current) return;
    const overlayRect = overlayRef.current.getBoundingClientRect();
    const mouseX = event.clientX - overlayRect.left;
    const targetBeat = calculateBeatFromX(mouseX);
    seekTo(targetBeat);
  }, [isSeeking, seekTo, numMeasures, pixelsPerBeat, beatsPerMeasure, calculateBeatFromX]);

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

      switch (type) {
          case 'creating':
              newStart = Math.min(initialBeat, currentBeat);
              newEnd = Math.max(initialBeat, currentBeat);
              break;
          case 'moving':
              if (initialStartBeat !== null && initialEndBeat !== null) {
                const delta = currentBeat - initialBeat;
                const loopDuration = initialEndBeat - initialStartBeat;
                newStart = initialStartBeat + delta;
                // Prevent dragging loop start beyond 0
                if (newStart < 0) {
                    newStart = 0;
                }
                newEnd = newStart + loopDuration; 
                // Prevent dragging loop end beyond total beats
                const totalBeats = numMeasures * beatsPerMeasure;
                if (newEnd > totalBeats) {
                    newEnd = totalBeats;
                    newStart = newEnd - loopDuration;
                }
              }
              break;
          case 'resizing-start':
              if (initialEndBeat !== null) {
                newStart = Math.min(currentBeat, initialEndBeat); // Prevent start passing end
                newEnd = initialEndBeat;
              }
              break;
          case 'resizing-end':
               if (initialStartBeat !== null) {
                newStart = initialStartBeat;
                newEnd = Math.max(currentBeat, initialStartBeat); // Prevent end passing start
               }
              break;
      }

      if (newStart !== null && newEnd !== null) {
        // Update loop range in the store immediately during drag
        setLoopRange(newStart, newEnd); 
      }

  }, [loopDragState, pixelsPerBeat, numMeasures, beatsPerMeasure, setLoopRange, calculateBeatFromX]);

  const handleLoopEnd = useCallback(() => {
      // Reset loop drag state when mouse is released
      setLoopDragState({ type: null, initialBeat: 0, initialStartBeat: null, initialEndBeat: null });
  }, []);

  // --- Combined Mouse Down Handler ---
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const mouseY = event.nativeEvent.offsetY;
    const mouseX = event.nativeEvent.offsetX;
    const clickedBeatRaw = calculateBeatFromX(mouseX);
    const clickedBeat = quantizeBeat(clickedBeatRaw);

    if (mouseY < topSectionHeight) {
      // --- Top Half: Initiate Loop Drag ---
      event.preventDefault();
      const handleSize = 10; // Pixel threshold for resizing handles
      const handleBeatThreshold = handleSize / pixelsPerBeat; // Convert pixel threshold to beats

      let dragType: typeof loopDragState.type = 'creating'; // Default to creating

      // Check if clicking on or near existing loop handles/body (only if loop exists)
      if (loopStartBeat !== null && loopEndBeat !== null) {
          const startHandleX = beatToX(loopStartBeat);
          const endHandleX = beatToX(loopEndBeat);
          
          // Check for resizing start handle
          if (Math.abs(mouseX - startHandleX) <= handleSize || Math.abs(clickedBeat - loopStartBeat) <= handleBeatThreshold) {
              dragType = 'resizing-start';
          }
          // Check for resizing end handle
          else if (Math.abs(mouseX - endHandleX) <= handleSize || Math.abs(clickedBeat - loopEndBeat) <= handleBeatThreshold) {
              dragType = 'resizing-end';
          }
          // Check for moving the body (if loop is active)
          else if (loopEnabled && clickedBeat >= loopStartBeat && clickedBeat <= loopEndBeat) {
              dragType = 'moving';
          }
           // If clicking inside an inactive loop, treat as creating
          else if (!loopEnabled && clickedBeat >= loopStartBeat && clickedBeat <= loopEndBeat) {
              dragType = 'creating';
          }
          // Clicking outside any part of the loop defaults to 'creating'
      }

      setLoopDragState({
        type: dragType,
        initialBeat: clickedBeat, // Use quantized beat
        initialStartBeat: loopStartBeat, // Store the state at drag start
        initialEndBeat: loopEndBeat
      });

    } else {
      // --- Bottom Half: Initiate Seeking ---
      event.preventDefault();
      setIsSeeking(true);
      // Perform initial seek
      seekTo(clickedBeatRaw); // Use raw beat for seeking precision
    }
  };

  // Effect to manage global mouse listeners for BOTH seeking and loop dragging
  useEffect(() => {
    const isLoopDragging = loopDragState.type !== null;

    const currentMoveHandler = isLoopDragging ? handleLoopMove : handleSeekMove;
    const currentEndHandler = isLoopDragging ? handleLoopEnd : handleSeekEnd;
    const shouldListen = isSeeking || isLoopDragging;

    if (shouldListen) {
      window.addEventListener('mousemove', currentMoveHandler);
      window.addEventListener('mouseup', currentEndHandler);
    } else {
      // Ensure both potential listeners are removed if neither drag is active
      window.removeEventListener('mousemove', handleLoopMove);
      window.removeEventListener('mouseup', handleLoopEnd);
      window.removeEventListener('mousemove', handleSeekMove);
      window.removeEventListener('mouseup', handleSeekEnd);
    }

    // Cleanup listeners on unmount or change of handlers
    return () => {
      window.removeEventListener('mousemove', handleLoopMove);
      window.removeEventListener('mouseup', handleLoopEnd);
      window.removeEventListener('mousemove', handleSeekMove);
      window.removeEventListener('mouseup', handleSeekEnd);
    };
  }, [isSeeking, loopDragState.type, handleSeekMove, handleSeekEnd, handleLoopMove, handleLoopEnd]);

  // Draw canvas when dimensions or loop state change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalWidth = pixelsPerBeat * beatsPerMeasure * numMeasures;

    // Set canvas dimensions
    canvas.width = totalWidth;
    canvas.height = headerHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Draw Loop Region (Top Half) ---
    if (loopStartBeat !== null && loopEndBeat !== null) {
      const loopStartX = beatToX(loopStartBeat);
      const loopEndX = beatToX(loopEndBeat);
      const loopWidth = loopEndX - loopStartX;

      ctx.fillStyle = loopEnabled ? 'rgba(80, 120, 255, 0.5)' : 'rgba(150, 150, 150, 0.5)'; 
      ctx.fillRect(loopStartX, 0, loopWidth, topSectionHeight);

      // Optional: Draw resize handles visually
      const handleWidth = 4; // Width of the handle indicator
      ctx.fillStyle = loopEnabled ? 'rgba(50, 80, 200, 0.8)' : 'rgba(100, 100, 100, 0.8)';
      // Start handle
      ctx.fillRect(loopStartX - handleWidth / 2, 0, handleWidth, topSectionHeight);
      // End handle
      ctx.fillRect(loopEndX - handleWidth / 2, 0, handleWidth, topSectionHeight);
    }

    // --- Draw Dividing Line ---
    ctx.beginPath();
    ctx.moveTo(0, topSectionHeight + 0.5);
    ctx.lineTo(canvas.width, topSectionHeight + 0.5);
    ctx.strokeStyle = '#aaa'; // Slightly lighter gray for the divider
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- Draw Grid Lines and Beat Subdivisions (Bottom Half) ---
    const totalBeats = numMeasures * beatsPerMeasure;
    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = beat * pixelsPerBeat + 0.5; // 0.5 offset for sharp lines
      ctx.beginPath();
      ctx.moveTo(x, topSectionHeight); // Start from the dividing line
      
      if (beat % beatsPerMeasure === 0) {
        // Measure line
        ctx.lineTo(x, headerHeight);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
      } else {
        // Beat subdivision line (shorter)
        ctx.lineTo(x, headerHeight - 5); // Adjust height as needed
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    }

    // --- Draw Measure Numbers (Top Half - above grid lines) ---
     ctx.fillStyle = 'white';
     ctx.font = 'bold 12px sans-serif';
     ctx.textAlign = 'left';
     ctx.textBaseline = 'top'; 
    for (let measure = 0; measure < numMeasures; measure++) {
        const x = measure * beatsPerMeasure * pixelsPerBeat + 10; // Add some padding
        const y = 2; // Position near the top
        ctx.fillText((measure + 1).toString(), x, y);
    }

  }, [numMeasures, pixelsPerBeat, beatsPerMeasure, headerHeight, topSectionHeight, loopEnabled, loopStartBeat, loopEndBeat, beatToX]);

  return (
    <div 
      ref={containerRef}
      className="measures-header" 
      style={{
        display: 'flex',
        height: `${headerHeight}px`,
        borderBottom: '1px solid #ccc',
        backgroundColor: 'black',
        width: '3000px' // Keep this or make dynamic based on parent?
      }}
    >
      <canvas 
        ref={canvasRef}
        style={{ 
            position: 'absolute', 
            width: `${pixelsPerBeat * beatsPerMeasure * numMeasures}px`, 
            height: `${headerHeight}px` // Use variable
        }}
      />
      <div 
        ref={overlayRef}
        onMouseDown={handleMouseDown} 
        style={{ 
          position: 'relative', 
          width: '100%', 
          height: '100%', 
          zIndex: 1,
          cursor: 'pointer'
        }}
      >
      </div>
    </div>
  );
}

export default MeasuresHeader; 