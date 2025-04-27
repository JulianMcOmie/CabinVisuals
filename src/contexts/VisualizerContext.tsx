import React, { createContext, useContext, useRef, ReactNode } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import VisualizerManager from '../lib/VisualizerManager';
import TimeManager from '../lib/TimeManager';

// Define the shape of the context value
export interface VisualizerContextValue {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  visualizerManager: VisualizerManager;
  timeManager: TimeManager;
  invalidate: () => void;
}

// Create the context with a null default value
const VisualizerContext = createContext<VisualizerContextValue | null>(null);

/**
 * Custom hook to consume the VisualizerContext.
 * Throws an error if used outside of a VisualizerContextProvider.
 */
export const useVisualizerContext = (): VisualizerContextValue => {
  const context = useContext(VisualizerContext);
  if (!context) {
    throw new Error('useVisualizerContext must be used within a VisualizerContextProvider');
  }
  return context;
};

// Define the props for the context provider component
interface VisualizerContextProviderProps {
  children: ReactNode;
  visualizerManager: VisualizerManager; // Instance passed from the parent component
  canvasRef: React.RefObject<HTMLCanvasElement>; // Ref passed from the parent component
}

/**
 * Provider component that wraps parts of the application needing access
 * to R3F internals and the VisualizerManager/TimeManager instances.
 * It should be placed *inside* the R3F <Canvas> component.
 */
export const VisualizerContextProvider: React.FC<VisualizerContextProviderProps> = ({
  children,
  visualizerManager,
  canvasRef
}) => {
  // Access R3F state and functions using the useThree hook
  // This hook must be called from a component within the <Canvas>
  const { gl, scene, camera, invalidate } = useThree();

  // Get the TimeManager instance from the VisualizerManager
  const timeManager = visualizerManager.getTimeManager();

  // Basic check to ensure essential R3F elements are available
  // This should generally always pass if the provider is placed correctly.
  if (!gl || !scene || !camera || !invalidate || !timeManager || !canvasRef) {
    console.error("VisualizerContext: R3F internals or managers not fully available. Ensure Provider is inside Canvas and props are passed.");
    // Optionally render an error placeholder or null
    return null;
  }

  // Construct the context value object
  const contextValue: VisualizerContextValue = {
    gl,
    scene,
    camera,
    canvasRef, // Pass the ref through
    visualizerManager,
    timeManager,
    invalidate,
  };

  // Provide the value to children components
  return (
    <VisualizerContext.Provider value={contextValue}>
      {children}
    </VisualizerContext.Provider>
  );
}; 