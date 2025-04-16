import React, { useRef, useEffect, useState, useCallback } from 'react';
import useStore from '../../store/store';

function MeasuresHeader() {
  const { seekTo, numMeasures } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);

  const pixelsPerMeasure = 400;
  const beatsPerMeasure = 4;

  // Function to calculate beat from mouse X position relative to the overlay
  const calculateBeatFromX = (mouseX: number): number => {
    const clickedBeat = (mouseX / pixelsPerMeasure) * beatsPerMeasure;
    // Ensure beat is within valid range (0 to total beats)
    const totalBeats = numMeasures * beatsPerMeasure;
    return Math.max(0, Math.min(clickedBeat, totalBeats));
  };

  // Combined handler for mouse move (during drag)
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !overlayRef.current) return;

    const overlayRect = overlayRef.current.getBoundingClientRect();
    const mouseX = event.clientX - overlayRect.left; // Position relative to the overlay div
    const targetBeat = calculateBeatFromX(mouseX);
    seekTo(targetBeat);

  }, [isDragging, seekTo, numMeasures]); // Add numMeasures dependency for totalBeats calc

  // Handler for mouse up (stop drag)
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  // Handler for mouse down (start drag AND initial seek)
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault(); // Prevent text selection etc.
    setIsDragging(true);

    // Perform initial seek based on the mousedown position
    const mouseX = event.nativeEvent.offsetX; // Position relative to the target div
    const targetBeat = calculateBeatFromX(mouseX);
    seekTo(targetBeat);
    
    // Add listeners for mouse move and up on the window
    // These will be handled by the useEffect below
  };

  // Effect to manage global mouse listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Draw canvas when dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = pixelsPerMeasure * numMeasures;
    canvas.height = 40;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    for (let i = 0; i < 32; i++) {
      const x = i * 100 + 0.5; // 0.5 offset for sharp lines
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      
      if (i % 4 === 0) {
        ctx.strokeStyle = '#888';
      } else {
        ctx.strokeStyle = '#555';
      }
      ctx.stroke();
    }
  }, [numMeasures]);

  return (
    <div 
      ref={containerRef}
      className="measures-header" 
      style={{
        display: 'flex',
        height: '40px',
        borderBottom: '1px solid #ccc',
        backgroundColor: 'black',
        width: '3000px' // Width to accommodate all measures, minus the 200px for instruments
      }}
    >
      <canvas 
        ref={canvasRef}
        style={{ 
            position: 'absolute', 
            width: `${pixelsPerMeasure * numMeasures}px`, 
            height: '100%'
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
        {Array.from({ length: 8 }).map((_, i) => (
          <div 
            key={i}
            style={{
              position: 'absolute',
              left: `${i * pixelsPerMeasure + 10}px`,
              cursor: 'pointer',
              fontWeight: 'bold',
              color: 'white'
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MeasuresHeader; 