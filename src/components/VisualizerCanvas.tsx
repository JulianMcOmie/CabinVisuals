'use client';

import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type { EffectComposer as PostProcessingEffectComposer } from 'postprocessing';
import type { VisualObject3D } from '../lib/VisualizerManager';

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

// Scene component that handles animation and object rendering
function Scene({ objects }: { objects: VisualObject3D[] }) {
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

// Helper component to access R3F context and control clock/updates
const R3FController = ({ 
    r3fInternalsRef, 
    isExporting, 
    updateCurrentObjects 
}: {
    r3fInternalsRef: React.MutableRefObject<{ 
        gl: THREE.WebGLRenderer | null, 
        scene: THREE.Scene | null, 
        camera: THREE.Camera | null, 
        invalidate: (() => void) | null 
    }>;
    isExporting: boolean;
    updateCurrentObjects: () => void;
}) => {
    const { gl, scene, camera, invalidate, clock } = useThree();

    // Store R3F internals in the ref for parent access
    useEffect(() => {
        r3fInternalsRef.current = { gl, scene, camera, invalidate };
        // Cleanup function optional, depends if these refs change significantly
    }, [gl, scene, camera, invalidate, r3fInternalsRef]);

    // Effect to pause/resume R3F clock based on export state
    useEffect(() => {
        if (isExporting) {
            if (clock.running) {
                clock.stop();
                console.log("R3F clock stopped for export.");
            }
        } else {
            if (!clock.running) {
                clock.start();
                console.log("R3F clock started after export.");
            }
        }
    }, [isExporting, clock]);

    // Frame loop for normal playback updates
    useFrame(() => {
        // Only update state for the Scene if not exporting and clock is running
        if (!isExporting && clock.running) {
            updateCurrentObjects(); // Call the update function passed via props
        }
    });

    // This component doesn't render anything itself
    return null; 
};

// Props for VisualizerCanvas
interface VisualizerCanvasProps {
  objects: VisualObject3D[];
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  composerRef: React.RefObject<PostProcessingEffectComposer | null>;
  r3fInternalsRef: React.MutableRefObject<{ 
      gl: THREE.WebGLRenderer | null, 
      scene: THREE.Scene | null, 
      camera: THREE.Camera | null, 
      invalidate: (() => void) | null 
  }>;
  isExporting: boolean;
  updateCurrentObjects: () => void;
}

// Main VisualizerCanvas component
const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({ 
  objects, 
  canvasRef, 
  composerRef, 
  r3fInternalsRef, 
  isExporting, 
  updateCurrentObjects 
}) => {
  return (
    <Canvas 
      ref={canvasRef}
      style={{ background: '#000', width: '100%', height: '100%' }} 
      camera={{ position: [0, 0, 15] }} 
      gl={{ preserveDrawingBuffer: true }}
    >
      <R3FController 
        r3fInternalsRef={r3fInternalsRef} 
        isExporting={isExporting}
        updateCurrentObjects={updateCurrentObjects}
      /> 
      <Scene objects={objects} />
      <EffectComposer ref={composerRef}>
          <Bloom 
              intensity={1.0}
              luminanceThreshold={0.1}
              luminanceSmoothing={0.2}
              mipmapBlur={true}
          />
      </EffectComposer>
    </Canvas>
  );
}

export default VisualizerCanvas; 