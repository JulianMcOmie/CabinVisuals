'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store/store';
import VisualizerManager, { VisualObject3D } from '../lib/VisualizerManager';

// Scene component that handles animation and object rendering
const Scene: React.FC<{ visualizerManager: VisualizerManager }> = ({ visualizerManager }) => {
  const [objects, setObjects] = useState<VisualObject3D[]>([]);
  
  // Update objects on each frame
  useFrame(() => {
    setObjects(visualizerManager.getVisualObjects());
  });
  
  return (
    <>
      {/* Add ambient light */}
      <ambientLight intensity={0.5} />
      
      {/* Add directional light */}
      <directionalLight position={[10, 10, 5]} intensity={1} />
      
      {/* Render all visual objects */}
      {objects.map(obj => (
        <VisualObject key={obj.id} object={obj} />
      ))}
    </>
  );
};

// Component for a single visual object
const VisualObject: React.FC<{ object: VisualObject3D }> = ({ object }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  return (
    <mesh
      ref={meshRef}
      position={object.position}
      rotation={object.rotation as any}
      scale={object.scale}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={object.color} />
    </mesh>
  );
};

// Main VisualizerView component
const VisualizerView: React.FC = () => {
  const { timeManager, currentBeat } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [visualizerManager] = useState(() => new VisualizerManager(timeManager));
  
  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight - 40 // Account for header
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  return (
    <div className="visualizer-view" ref={containerRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ padding: '10px', margin: 0 }}>Visualizer View (Beat: {currentBeat.toFixed(2)})</h2>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Canvas style={{ background: '#000' }}>
            <Scene visualizerManager={visualizerManager} />
          </Canvas>
        )}
      </div>
    </div>
  );
};

export default VisualizerView; 