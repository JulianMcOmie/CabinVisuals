'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import useStore from '../../store/store';
import { MIDIBlock, Track } from '../../lib/types';

import {
  KEY_COUNT,
  BEATS_PER_MEASURE,
} from './utils/constants';

import {
  getCoordsAndDerived,
} from './utils/utils';

import { drawMidiEditor } from './utils/canvas';

import { useZoomScroll } from './hooks/useZoomScroll';
import { useMidiEditorInteractions } from './hooks/useMidiEditorInteractions';

interface MidiEditorProps {
  block: MIDIBlock;
  track: Track;
}

function MidiEditor({ block, track }: MidiEditorProps) {
  const { 
    updateMidiBlock,
    moveMidiBlock,
    selectNotes: storeSelectNotes, 
    setSelectedWindow,
    selectedWindow,
    numMeasures,
    currentBeat,
    seekTo
  } = useStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const invisibleSpacerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [editorDimensions, setEditorDimensions] = useState({ width: 0, height: 0 });
  // -------------------------------------------
  
  useEffect(() => {
    const editorElement = editorRef.current;
    if (!editorElement) return;

    const updateDimensions = () => {
      const newWidth = editorElement.clientWidth;
      const newHeight = editorElement.clientHeight;
      
      console.log('🔄 Dimension Update Triggered:', {
        newWidth,
        newHeight,
        elementExists: !!editorElement
      });
      
      setEditorDimensions({
        width: newWidth,
        height: newHeight,
      });
    };

    console.log('🎬 Setting up dimension tracking with ResizeObserver');
    updateDimensions();

    // Use ResizeObserver to watch the actual element size
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    
    resizeObserver.observe(editorElement);

    return () => {
      console.log('🛑 Cleaning up dimension tracking');
      resizeObserver.unobserve(editorElement);
    };
  }, []);

  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]); 

  const { 
    pixelsPerBeat, 
    pixelsPerSemitone, 
    scrollX, 
    scrollY, 
    handleGridScroll 
  } = useZoomScroll({ editorRef, numMeasures });

  const blockStartBeat = block.startBeat;
  const blockDuration = block.endBeat - block.startBeat;

  const totalGridWidth = numMeasures * BEATS_PER_MEASURE * pixelsPerBeat; 
  const totalGridHeight = KEY_COUNT * pixelsPerSemitone;
  
  // Wrap getCoordsAndDerived in useCallback to ensure stable reference for dependencies
  // Must be defined before useMidiEditorInteractions which uses it
  const getCoordsAndDerivedCallback = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!invisibleSpacerRef.current) {
        console.warn("getCoordsAndDerivedCallback called before invisibleSpacerRef is assigned.");
        return null;
    }
    return getCoordsAndDerived(e, invisibleSpacerRef as React.RefObject<HTMLDivElement>, scrollX, scrollY, pixelsPerBeat, pixelsPerSemitone);
  }, [invisibleSpacerRef, scrollX, scrollY, pixelsPerBeat, pixelsPerSemitone]); // Dependencies now include values from useZoomScroll

  const { 
    handleCanvasMouseDown, 
    handleCanvasMouseMove, 
    handleCanvasMouseUp, 
    handleCanvasContextMenu, 
    hoverCursor, 
    selectionBox, 
    isDragging
  } = useMidiEditorInteractions({
    block,
    trackId: track.id, 
    selectedNoteIds,
    setSelectedNoteIds, 
    updateMidiBlock,
    moveMidiBlock,
    storeSelectNotes,
    seekTo,
    selectedWindow,
    pixelsPerBeat,
    pixelsPerSemitone,
    getCoordsAndDerivedCallback, 
    currentBeat,
    numMeasures,
    blockStartBeat, 
    blockDuration, 
    setSelectedWindow
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!editorDimensions.width || !editorDimensions.height) return;
    
    const dpr = window.devicePixelRatio || 1;
    
    console.log('📐 MIDI Editor Dimensions:', {
      editorWidth: editorDimensions.width,
      editorHeight: editorDimensions.height,
      canvasBitmapWidth: editorDimensions.width * dpr,
      canvasBitmapHeight: editorDimensions.height * dpr,
      canvasCSSWidth: `${editorDimensions.width}px`,
      canvasCSSHeight: `${editorDimensions.height}px`,
      dpr: dpr
    });
    
    // Set bitmap resolution based on visible dimensions
    canvas.width = editorDimensions.width * dpr;
    canvas.height = editorDimensions.height * dpr;
    // Set CSS dimensions to match (prevents stretching)
    canvas.style.width = `${editorDimensions.width}px`;
    canvas.style.height = `${editorDimensions.height}px`;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.save();
    ctx.scale(dpr, dpr);
    
    drawMidiEditor(
      ctx,
      block.notes,
      selectedNoteIds,
      editorDimensions.width,
      editorDimensions.height,
      numMeasures,
      selectionBox,
      isDragging,
      pixelsPerBeat,
      pixelsPerSemitone,
      blockStartBeat,
      blockDuration,
      scrollX,
      scrollY,
      currentBeat
    );

    ctx.restore(); 

  }, [
      block.notes, 
      blockDuration, 
      blockStartBeat, 
      editorDimensions,
      selectionBox, 
      isDragging, 
      selectedNoteIds,
      pixelsPerBeat,
      pixelsPerSemitone,
      scrollX, 
      scrollY,
      numMeasures,
      currentBeat
  ]);

  const handleEditorClick = () => {
      setSelectedWindow('midiEditor');
  }
  
  const [isDraggingRuler, setIsDraggingRuler] = useState(false);

  const updatePlayheadFromRuler = (clientX: number, rulerElement: HTMLElement) => {
    const rect = rulerElement.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const beat = (clickX + scrollX) / pixelsPerBeat;
    const snappedBeat = Math.round(beat * 4) / 4; // Snap to quarter beats
    const maxBeat = numMeasures * BEATS_PER_MEASURE;
    seekTo(Math.max(0, Math.min(snappedBeat, maxBeat)));
  };

  const handleBeatRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingRuler(true);
    updatePlayheadFromRuler(e.clientX, e.currentTarget);
  };

  useEffect(() => {
    if (!isDraggingRuler) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rulerElement = editorRef.current?.querySelector('[data-beat-ruler="true"]') as HTMLElement;
      if (rulerElement) {
        updatePlayheadFromRuler(e.clientX, rulerElement);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingRuler(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingRuler, scrollX, pixelsPerBeat, numMeasures, seekTo]);

  return (
    <div
        ref={editorRef}
        className="midi-editor relative border border-gray-700 rounded-md"
        style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
        onClick={handleEditorClick}
    >
        {/* Beat Ruler at the top */}
        <div 
          data-beat-ruler="true"
          style={{
            height: '30px',
            backgroundColor: '#1a1a1a',
            borderBottom: '1px solid #444',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0,
            cursor: 'pointer',
            userSelect: 'none'
          }}
          onMouseDown={handleBeatRulerMouseDown}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            transform: `translateX(-${scrollX}px)`,
            pointerEvents: 'none'
          }}>
            {/* Render beat markers */}
            {Array.from({ length: numMeasures * BEATS_PER_MEASURE + 1 }).map((_, beatIndex) => {
              const isMeasureStart = beatIndex % BEATS_PER_MEASURE === 0;
              const measureNumber = Math.floor(beatIndex / BEATS_PER_MEASURE) + 1;
              return (
                <div
                  key={`beat-${beatIndex}`}
                  style={{
                    position: 'absolute',
                    left: `${beatIndex * pixelsPerBeat}px`,
                    top: 0,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Measure number label for measure starts */}
                  {isMeasureStart && (
                    <div style={{
                      fontSize: '11px',
                      color: '#aaa',
                      paddingLeft: '4px',
                      paddingTop: '2px',
                      userSelect: 'none'
                    }}>
                      {measureNumber}
                    </div>
                  )}
                  {/* Tick mark */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '1px',
                    height: isMeasureStart ? '12px' : '6px',
                    backgroundColor: isMeasureStart ? '#888' : '#555'
                  }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Main editor area */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          {/* Canvas Layer (Bottom) - Positioned absolutely to fill parent */}
          <canvas
              ref={canvasRef} 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                display: 'block',
                zIndex: 1, // Lower z-index
                pointerEvents: 'none' // Ignore mouse events
                // width/height are set programmatically in useEffect
              }}
            />

          {/* Scrollable Grid Layer (Top) - Positioned absolutely to fill parent */}
          <div
              className="piano-roll-grid"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%', // Fill parent width
                height: '100%',// Fill parent height
                overflow: 'scroll',
                zIndex: 2, // Higher z-index
                backgroundColor: 'transparent' // Allows canvas to show through
              }}
              onScroll={handleGridScroll}
              ref={scrollContainerRef}
            >
              {/* Sizer & Interaction Div (Inside Scrollable Grid) - MUST NOT be absolute */}
              <div className="invisible-spacer"
                  ref={invisibleSpacerRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseMove={handleCanvasMouseMove}
                  onContextMenu={handleCanvasContextMenu}
                  style={{
                    position: 'relative', // Or static (default) - NOT absolute
                    width: `${totalGridWidth}px`, // `${totalGridWidth}px`, // Full scrollable width
                    height: `${totalGridHeight}px`,  // Full scrollable height
                    backgroundColor: 'transparent',
                    cursor: hoverCursor,
                  }}
              />
            </div>
        </div>
    </div>
  );
}

export default MidiEditor; 