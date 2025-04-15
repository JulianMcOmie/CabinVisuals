'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store/store';
import VisualizerManager, { VisualObject3D } from '../lib/VisualizerManager';

// Scene component that handles animation and object rendering
function Scene({ visualizerManager }: { visualizerManager: VisualizerManager }) {
  const [objects, setObjects] = useState<VisualObject3D[]>([]);
  
  // Update objects on each frame
  useFrame(() => {
    setObjects(visualizerManager.getVisualObjects());
  });
  
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      {objects.map(obj => (
        <VisualObject key={obj.id} object={obj} />
      ))}
    </>
  );
}

// Component for a single visual object
function VisualObject({ object }: { object: VisualObject3D }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  return (
    <mesh
      ref={meshRef}
      position={object.position}
      rotation={object.rotation as any}
      scale={object.scale}
    >
      {/* Conditionally render geometry based on type */}
      {object.type === 'sphere' ? (
        <sphereGeometry args={[0.5, 32, 32]} /> // Radius 0.5 for base sphere
      ) : (
        <boxGeometry args={[1, 1, 1]} /> // Default to cube
      )}
      <meshStandardMaterial 
        color={object.color} 
      />
    </mesh>
  );
}

// Main VisualizerView component
function VisualizerView() {
  const { timeManager, currentBeat, getVisualObjectsAtTime } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [visualizerManager] = useState(() => new VisualizerManager(timeManager, getVisualObjectsAtTime));
  
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
}

export default VisualizerView; 