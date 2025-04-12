'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
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
  
  // Determine which type of geometry to render
  const renderGeometry = () => {
    switch (object.type) {
      case 'triangleFractal':
        return <TriangleFractalGeometry 
          positions={object.trianglePositions || []} 
          triangleSize={object.triangleSize || 0.1} 
        />;
      case 'sphere':
        return <sphereGeometry args={[0.5, 32, 32]} />;
      case 'cube':
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };
  
  return (
    <mesh
      ref={meshRef}
      position={object.position}
      rotation={object.rotation as any}
      scale={object.scale}
    >
      {renderGeometry()}
      <meshStandardMaterial 
        color={object.color} 
        transparent={object.opacity !== undefined && object.opacity < 1}
        opacity={object.opacity || 1}
        side={THREE.DoubleSide} // Render both sides of triangles
      />
    </mesh>
  );
}

// Component for rendering triangle fractal geometry
function TriangleFractalGeometry({ 
  positions, 
  triangleSize 
}: { 
  positions: [number, number, number][], 
  triangleSize: number 
}) {
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  
  // Only re-create geometry when positions change
  useEffect(() => {
    if (!geometryRef.current || positions.length === 0) return;
    
    // Group positions into triangle triplets
    const triangles = [];
    for (let i = 0; i < positions.length; i += 3) {
      if (i + 2 < positions.length) {
        triangles.push([positions[i], positions[i+1], positions[i+2]]);
      }
    }
    
    // Create new array to hold all positions
    const positionArray = new Float32Array(triangles.length * 9); // 3 points per triangle, 3 coords per point
    
    // Fill position array
    triangles.forEach((triangle, triangleIndex) => {
      for (let i = 0; i < 3; i++) {
        const point = triangle[i];
        positionArray[triangleIndex * 9 + i * 3] = point[0];
        positionArray[triangleIndex * 9 + i * 3 + 1] = point[1];
        positionArray[triangleIndex * 9 + i * 3 + 2] = point[2];
      }
    });
    
    // Set position attribute
    geometryRef.current.setAttribute(
      'position',
      new THREE.BufferAttribute(positionArray, 3)
    );
    
    // Compute normals for proper lighting
    geometryRef.current.computeVertexNormals();
    
    // Mark geometry as needing update
    geometryRef.current.attributes.position.needsUpdate = true;
    
  }, [positions]);
  
  return <bufferGeometry ref={geometryRef} />;
}

// Main VisualizerView component
function VisualizerView() {
  const { timeManager, trackManager, currentBeat } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [visualizerManager] = useState(() => new VisualizerManager(timeManager, trackManager));
  
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