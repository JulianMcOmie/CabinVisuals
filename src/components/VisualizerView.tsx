'use client';

import React, { useEffect, useRef } from 'react';
import useStore from '../store/store';

const VisualizerView: React.FC = () => {
  const { timeManager, trackManager, currentBeat } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Adjust canvas to fit container
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.offsetWidth;
        canvasRef.current.height = containerRef.current.offsetHeight;
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);
  
  // TODO: Implement animation frame for visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // TODO: Set up frame animation for visualization
    // TODO: Get visual objects from trackManager.getObjectsAtTime
    // TODO: Render the objects on canvas
    
    // This is just a placeholder showing that the canvas works
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.fillText('Visualizer View', 20, 50);
    ctx.fillText(`Current Beat: ${currentBeat}`, 20, 100);
    
  }, [currentBeat]);
  
  return (
    <div className="visualizer-view" ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <h2>Visualizer View</h2>
      <canvas 
        ref={canvasRef} 
        style={{ 
          width: '100%', 
          height: 'calc(100% - 40px)', 
          background: '#000' 
        }}
      />
    </div>
  );
};

export default VisualizerView; 