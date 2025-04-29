'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import type { EffectComposer as PostProcessingEffectComposer } from 'postprocessing';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Maximize2 } from 'lucide-react';
import useStore from '../store/store';
import VisualizerManager, { VisualObject3D } from '../lib/VisualizerManager';
import { ExportView } from './ExportView';
import VisualizerCanvas from './VisualizerCanvas';

// Main VisualizerView component
function VisualizerView() {
  const { timeManager, tracks, currentBeat } = useStore();
  const isExporting = useStore(state => state.isExporting);
  const isExportViewOpen = useStore(state => state.isExportViewOpen);
  const closeExportView = useStore(state => state.closeExportView);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs for the main, visible canvas
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainComposerRef = useRef<PostProcessingEffectComposer>(null);
  const mainR3fInternalsRef = useRef<{ 
      gl: THREE.WebGLRenderer | null, 
      scene: THREE.Scene | null, 
      camera: THREE.Camera | null, 
      invalidate: (() => void) | null 
  }>({ gl: null, scene: null, camera: null, invalidate: null });

  // Refs for the offscreen export canvas
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportComposerRef = useRef<PostProcessingEffectComposer>(null);
  const exportR3fInternalsRef = useRef<{ 
      gl: THREE.WebGLRenderer | null, 
      scene: THREE.Scene | null, 
      camera: THREE.Camera | null, 
      invalidate: (() => void) | null 
  }>({ gl: null, scene: null, camera: null, invalidate: null });

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [exportDimensions, setExportDimensions] = useState({ width: 1920, height: 1080 }); // Default export dimensions
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Initialize VisualizerManager with timeManager and initial tracks
  const [visualizerManager] = useState(() => new VisualizerManager(timeManager, tracks));
  
  // State to hold the objects for the Scene component (shared by both canvases)
  const [currentObjects, setCurrentObjects] = useState<VisualObject3D[]>([]);
  
  // --- Wrapper function for export invalidation --- 
  // This now targets the EXPORT canvas internals
  const invalidateForExport = useCallback(() => {
    console.log("DEBUG: invalidateForExport called (targeting export canvas)");
    const exportInvalidate = exportR3fInternalsRef.current.invalidate;
    if (exportInvalidate) {
        // 1. Explicitly update the state needed for rendering this frame
        // Both canvases read from this state, so update it once.
        const objects = visualizerManager.getVisualObjects();
        console.log("DEBUG: Setting currentObjects for export frame:", objects);
        setCurrentObjects(objects);

        // 2. Now, trigger the EXPORT R3F redraw using the function from the ref
        exportInvalidate();
    } else {
        console.warn("DEBUG: invalidateForExport called but export invalidate function not found in ref.");
    }
  }, [visualizerManager]); // Dependencies: visualizerManager only (setCurrentObjects is stable)
  
  // Callback to resize the MAIN EffectComposer
  const resizeMainComposer = useCallback((width: number, height: number) => {
    if (mainComposerRef.current) {
      console.log(`DEBUG: Resizing MAIN EffectComposer to ${width}x${height}`);
      mainComposerRef.current.setSize(width, height);
    } else {
      console.warn("DEBUG: resizeMainComposer called but mainComposerRef is null");
    }
  }, []); // No dependencies needed if mainComposerRef is stable

  // Callback to resize the EXPORT EffectComposer
  const resizeExportComposer = useCallback((width: number, height: number) => {
    if (exportComposerRef.current) {
      console.log(`DEBUG: Resizing EXPORT EffectComposer to ${width}x${height}`);
      exportComposerRef.current.setSize(width, height);
    } else {
      console.warn("DEBUG: resizeExportComposer called but exportComposerRef is null");
    }
  }, []); // No dependencies needed if exportComposerRef is stable

  // --- Effects --- 
  // Update dimensions on resize for the main view
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const newWidth = containerRef.current.offsetWidth;
        const newHeight = containerRef.current.offsetHeight;
        setDimensions({ width: newWidth, height: newHeight });
        // Also resize the main composer when the main view resizes
        resizeMainComposer(newWidth, newHeight);
        // Optionally update default export dimensions (or have separate controls)
        // setExportDimensions({ width: newWidth, height: newHeight }); 
      }
    };
    
    updateDimensions();
    const hostWindow = containerRef.current?.ownerDocument.defaultView || window;
    hostWindow.addEventListener('resize', updateDimensions);
    return () => hostWindow.removeEventListener('resize', updateDimensions);
  }, [resizeMainComposer]);
  
  // Effect to update VisualizerManager when tracks change
  useEffect(() => {
    visualizerManager.setTracks(tracks);
  }, [tracks, visualizerManager]); // Depend on tracks and the manager instance
  
  // Fullscreen change handler
  const handleFullscreenChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement);
    // Force resize after exiting fullscreen potentially?
    setTimeout(() => {
        if (containerRef.current) {
            resizeMainComposer(containerRef.current.offsetWidth, containerRef.current.offsetHeight);
        }
    }, 100); // Delay slightly
  }, [resizeMainComposer]);

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
  
  // Frame update callback passed to BOTH VisualizerCanvas instances
  // The R3FController inside each canvas handles pausing based on isExporting
  const updateCurrentObjects = useCallback(() => {
    // Get objects once, used by whichever canvas is currently rendering frames
    const liveObjects = visualizerManager.getVisualObjects();
    setCurrentObjects(liveObjects); 
  }, [visualizerManager]);
  
  // --- ExportView Setup --- 
  // Evaluate the conditions needed to render ExportView (using EXPORT refs)
  const shouldRenderExportView = 
    isExportViewOpen && 
    !!exportR3fInternalsRef.current.gl && 
    !!exportR3fInternalsRef.current.scene && 
    !!exportR3fInternalsRef.current.camera && 
    !!exportR3fInternalsRef.current.invalidate && // Ensure export invalidate is ready
    !!exportCanvasRef.current;
    
  // Function to assemble ExportView props (using EXPORT refs)
  const getExportViewProps = () => {
    if (!shouldRenderExportView) return null;
    return {
        gl: exportR3fInternalsRef.current.gl!,
        scene: exportR3fInternalsRef.current.scene!,
        camera: exportR3fInternalsRef.current.camera!,
        canvasRef: exportCanvasRef as React.RefObject<HTMLCanvasElement>, // Pass export canvas ref
        visualizerManager: visualizerManager, 
        timeManager: timeManager, 
        invalidate: invalidateForExport, // Pass the invalidate targeting export
        resizeComposer: resizeExportComposer, // Pass the resize for export
        onClose: closeExportView, // Pass the close handler
        // TODO: Pass export dimensions if needed by ExportView itself?
        // initialWidth: exportDimensions.width,
        // initialHeight: exportDimensions.height,
    };
  };

  const exportViewProps = getExportViewProps();

  // --- DEBUG LOG --- 
  // useEffect(() => {
  //   console.log("ExportView Props Status:", {
  //       shouldRenderExportView,
  //       exportViewProps: getExportViewProps(), // Call again to see latest status
  //       isExportViewOpen,
  //       gl: !!exportR3fInternalsRef.current.gl,
  //       scene: !!exportR3fInternalsRef.current.scene,
  //       camera: !!exportR3fInternalsRef.current.camera,
  //       invalidate: !!exportR3fInternalsRef.current.invalidate,
  //       canvas: !!exportCanvasRef.current
  //   });
  // }, [shouldRenderExportView, isExportViewOpen]);

  return (
    <div 
      className="visualizer-view" 
      ref={containerRef} 
      style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      {/* Main Visible Canvas Area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {dimensions.width > 0 && dimensions.height > 0 && (
          <VisualizerCanvas
            objects={currentObjects}
            canvasRef={mainCanvasRef} // Use main ref
            composerRef={mainComposerRef} // Use main ref
            r3fInternalsRef={mainR3fInternalsRef} // Use main ref
            isExporting={isExporting} // Let this canvas know about export state (to pause)
            updateCurrentObjects={updateCurrentObjects}
          />
        )}
        {/* Overlays for the main canvas */}
        <div
          className="absolute top-3 left-3 px-3 py-1 rounded-md border text-xs text-gray-300"
          style={{
            backgroundColor: "rgba(40, 40, 40, 0.7)",
            borderColor: "rgba(80, 80, 80, 0.5)",
          }}
        >
          Beat: {currentBeat.toFixed(2)}
        </div>
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

      {/* Offscreen Canvas for Exporting - Always rendered but hidden */}
      {/* Ensure it has dimensions BEFORE the Canvas component mounts */}
      {exportDimensions.width > 0 && exportDimensions.height > 0 && (
          <div style={{
              position: 'absolute',
              left: '-9999px', // Position offscreen
              top: '-9999px',
              width: `${exportDimensions.width}px`, 
              height: `${exportDimensions.height}px`, 
              // background: 'red', // For debugging visibility
              // zIndex: 1000, // For debugging visibility
          }}>
              <VisualizerCanvas
                  objects={currentObjects} // Share the same objects
                  canvasRef={exportCanvasRef} // Use export ref
                  composerRef={exportComposerRef} // Use export ref
                  r3fInternalsRef={exportR3fInternalsRef} // Use export ref
                  isExporting={true} // This canvas's clock should initially be stopped if it respects this
                  updateCurrentObjects={updateCurrentObjects} // Share the update logic
              />
          </div>
      )}

      {/* Conditionally render ExportView using the prepared props */}
      {exportViewProps && (
          <ExportView 
              {...exportViewProps} // Spread the generated props
          />
      )}
    </div>
  );
}

export default VisualizerView; 