import React, { useRef, useEffect, useState } from 'react';
import useStore from '../../store/store';

function MeasuresHeader() {
  const { seekTo } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const handleMeasureClick = (measure: number) => {
    // Set current beat to the start of the clicked measure (assuming 4 beats per measure)
    seekTo((measure - 1) * 4);
  };

  // Update dimensions when the component mounts or window resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    // Initial measurement
    updateDimensions();

    // Add resize listener
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Draw canvas when dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

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
  }, [dimensions]);

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
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />
      <div style={{ position: 'relative', width: '100%', height: '100%', zIndex: 1 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div 
            key={i}
            onClick={() => handleMeasureClick(i + 1)}
            style={{
              position: 'absolute',
              left: `${i * 400 + 10}px`,
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