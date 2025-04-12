import React, { useRef, useEffect, useState } from 'react';
import useStore from '../../store/store';

function MeasuresHeader() {
  const { seekTo, numMeasures } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pixelsPerMeasure = 400;

  const handleMeasureClick = (measure: number) => {
    // Set current beat to the start of the clicked measure (assuming 4 beats per measure)
    seekTo((measure - 1) * 4);
  };

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
      <div style={{ position: 'relative', width: '100%', height: '100%', zIndex: 1 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div 
            key={i}
            onClick={() => handleMeasureClick(i + 1)}
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