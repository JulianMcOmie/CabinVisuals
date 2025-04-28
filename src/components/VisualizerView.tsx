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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Initialize VisualizerManager with timeManager and initial tracks
  const [visualizerManager] = useState(() => new VisualizerManager(timeManager, tracks));
  
  // State to hold the objects for the Scene component
  const [currentObjects, setCurrentObjects] = useState<VisualObject3D[]>([]);
  
  // Refs to store R3F internals needed for props
  const r3fInternalsRef = useRef<{ 
      gl: THREE.WebGLRenderer | null, 
      scene: THREE.Scene | null, 
      camera: THREE.Camera | null, 
      invalidate: (() => void) | null 
  }>({ gl: null, scene: null, camera: null, invalidate: null });
  const composerRef = useRef<PostProcessingEffectComposer>(null);
  
  // --- Wrapper function for export invalidation ---
  const invalidateForExport = useCallback(() => {
    console.log("DEBUG: invalidateForExport called");
    const originalInvalidate = r3fInternalsRef.current.invalidate;
    if (originalInvalidate) {
        // 1. Explicitly update the state needed for rendering this frame
        const objects = visualizerManager.getVisualObjects();
        console.log("DEBUG: Setting currentObjects for export frame:", objects);
        setCurrentObjects(objects);

        // 2. Now, trigger the R3F redraw using the function from the ref
        originalInvalidate();
    } else {
        console.warn("DEBUG: invalidateForExport called but original invalidate not found in ref.");
    }
  }, [visualizerManager, setCurrentObjects]); // Dependencies: visualizerManager and setCurrentObjects are stable
  
  // Callback to resize the EffectComposer
  const resizeComposer = useCallback((width: number, height: number) => {
    if (composerRef.current) {
      console.log(`DEBUG: Resizing EffectComposer to ${width}x${height}`);
      composerRef.current.setSize(width, height);
    } else {
      console.warn("DEBUG: resizeComposer called but composerRef is null");
    }
  }, []); // No dependencies needed if composerRef is stable
  
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
    const hostWindow = containerRef.current?.ownerDocument.defaultView || window;
    hostWindow.addEventListener('resize', updateDimensions);
    return () => hostWindow.removeEventListener('resize', updateDimensions);
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
  
  // Frame update callback for VisualizerCanvas
  const updateCurrentObjects = useCallback(() => {
    // Only update state for the Scene if not exporting 
    // (The check for clock.running is now internal to R3FController within VisualizerCanvas)
    if (!isExporting) {
        const liveObjects = visualizerManager.getVisualObjects();
        setCurrentObjects(liveObjects); // Update state passed to Scene
    }
  }, [isExporting, visualizerManager]);
  
  // --- DEBUG LOG --- 
  // Evaluate the conditions needed to render ExportView
  const shouldRenderExportView = 
    isExportViewOpen && 
    !!r3fInternalsRef.current.gl && 
    !!r3fInternalsRef.current.scene && 
    !!r3fInternalsRef.current.camera && 
    !!r3fInternalsRef.current.invalidate && 
    !!canvasRef.current;
    
  // Function to assemble ExportView props (including the new callback)
  // Note: This is simplified. Ensure ALL necessary props are passed.
  // It assumes ExportView internally creates ExportRenderer or handles deps.
  // If ExportView expects individual deps, adjust accordingly.
  const getExportViewProps = () => {
    if (!shouldRenderExportView) return null;
    return {
        gl: r3fInternalsRef.current.gl!,
        scene: r3fInternalsRef.current.scene!,
        camera: r3fInternalsRef.current.camera!,
        canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
        visualizerManager: visualizerManager, 
        timeManager: timeManager, 
        invalidate: invalidateForExport, 
        resizeComposer: resizeComposer // Pass the new resize function
        // Pass any other props ExportView needs directly
    };
  };

  const exportViewProps = getExportViewProps();

  return (
    <div 
      className="visualizer-view" 
      ref={containerRef} 
      style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {dimensions.width > 0 && dimensions.height > 0 && (
          <VisualizerCanvas
            objects={currentObjects}
            canvasRef={canvasRef}
            composerRef={composerRef}
            r3fInternalsRef={r3fInternalsRef}
            isExporting={isExporting}
            updateCurrentObjects={updateCurrentObjects}
          />
        )}
        {/* Beat indicator overlay - styled like page.tsx */}
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