'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Maximize2 } from 'lucide-react';
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
  
  const isTransparent = object.opacity < 1.0;
  // Use provided emissive properties, defaulting if undefined
  const emissiveColor = object.emissive ?? object.color; // Default emissive to base color if not provided
  const emissiveIntensity = object.emissiveIntensity ?? 0; // Default intensity to 0

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
        opacity={object.opacity}
        transparent={isTransparent}
        depthWrite={!isTransparent}
        emissive={emissiveColor}       // Apply emissive color
        emissiveIntensity={emissiveIntensity} // Apply emissive intensity
        toneMapped={false} // Disable tone mapping for emissive materials for stronger bloom
      />
    </mesh>
  );
}

// Main VisualizerView component
function VisualizerView() {
  const { timeManager, tracks } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Initialize VisualizerManager with timeManager and initial tracks
  const [visualizerManager] = useState(() => new VisualizerManager(timeManager, tracks));
  
  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  // Effect to update VisualizerManager when tracks change
  useEffect(() => {
    visualizerManager.setTracks(tracks);
  }, [tracks, visualizerManager]); // Depend on tracks and the manager instance
  
  // Fullscreen change handler
  const handleFullscreenChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [handleFullscreenChange]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  return (
    <div 
      className="visualizer-view" 
      ref={containerRef} 
      style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Canvas style={{ background: '#000' }} camera={{ position: [0, 0, 15] }}>
            <Scene visualizerManager={visualizerManager} />
            <EffectComposer>
              <Bloom 
                intensity={1.0}
                luminanceThreshold={0.1}
                luminanceSmoothing={0.2}
                mipmapBlur={true}
              />
            </EffectComposer>
          </Canvas>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="absolute top-3 right-3 rounded-md transition-all border hover:bg-[#444]"
                style={{
                  backgroundColor: "rgba(40, 40, 40, 0.7)",
                  borderColor: "rgba(80, 80, 80, 0.5)",
                  color: "rgba(255, 255, 255, 0.7)",
                }}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isFullscreen ? 'Exit Fullscreen' : 'Expand Visualizer'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

export default VisualizerView; 