'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import useStore from '../../store/store';
import { MIDIBlock, MIDINote, Track } from '../../lib/types';

import PianoRollHeader from './components/PianoRollHeader';
import PianoKeys from './components/PianoKeys';

import {
  KEY_COUNT,
  BEATS_PER_MEASURE,
  PIXELS_PER_BEAT,
  PIXELS_PER_SEMITONE,
} from './utils/constants';

import {
  getCoordsAndDerived,
  debounce
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
      setEditorDimensions({
        width: editorElement.clientWidth,
        height: editorElement.clientHeight,
      });
    };

    updateDimensions();

    const handleResize = debounce(updateDimensions, 100);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
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
  const blockWidth = blockDuration * pixelsPerBeat;
  const blockHeight = KEY_COUNT * pixelsPerSemitone;

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
  
  return (
    <div
        ref={editorRef}
        className="midi-editor relative border border-gray-700 rounded-md"
        style={{ overflow: 'hidden', height: '100%', }}
        onClick={handleEditorClick}
    >
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
                  height: `${blockHeight}px`,  // Full scrollable height
                  backgroundColor: 'transparent',
                  cursor: hoverCursor,
                }}
            />
          </div>
    </div>
  );
}

export default MidiEditor; 