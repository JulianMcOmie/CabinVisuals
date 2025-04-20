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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [editorDimensions, setEditorDimensions] = useState({ width: 0, height: 0 });
  // -------------------------------------------

  // Use state dimensions, fallback if needed
  // Use original constants for initial calculation before state/hook values are ready
  const editorWidth = editorDimensions.width || numMeasures * BEATS_PER_MEASURE * PIXELS_PER_BEAT; 
  const editorHeight = editorDimensions.height || KEY_COUNT * PIXELS_PER_SEMITONE;
  
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
    if (!canvasRef.current) {
        console.warn("getCoordsAndDerivedCallback called before canvasRef is assigned.");
        return null;
    }
    return getCoordsAndDerived(e, canvasRef as React.RefObject<HTMLCanvasElement>, scrollX, scrollY, pixelsPerBeat, pixelsPerSemitone);
  }, [canvasRef, scrollX, scrollY, pixelsPerBeat, pixelsPerSemitone]); // Dependencies now include values from useZoomScroll

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
    canvas.width = totalGridWidth * dpr;
    canvas.height = totalGridHeight * dpr;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(-scrollX, -scrollY);
    
    drawMidiEditor(
      ctx,
      block.notes,
      selectedNoteIds,
      editorDimensions.width,
      editorDimensions.height,
      blockDuration,
      blockStartBeat,
      totalGridWidth,
      selectionBox,
      isDragging,
      pixelsPerBeat,
      pixelsPerSemitone,
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
        style={{ overflow: 'hidden', height: '100%' }}
        onClick={handleEditorClick}
    >
      <div className="piano-roll flex flex-col h-full">
        <div className="flex">
          <div className="piano-roll-header" style={{ overflow: 'hidden' }}>
            <PianoRollHeader 
              startBeat={block.startBeat} 
              endBeat={block.endBeat} 
              pixelsPerBeat={pixelsPerBeat} 
              scrollX={scrollX}
            />
          </div>
        </div>
        <div className="flex" style={{ flex: 1, minHeight: 0 }}>
          <div className="piano-keys" style={{ overflow: 'hidden', flexShrink: 0 }}>
            <PianoKeys 
              keyCount={KEY_COUNT} 
              keyHeight={pixelsPerSemitone} 
              scrollY={scrollY}
            />
          </div>
          <div
            className="piano-roll-grid relative"
            style={{
              width: `${editorWidth}px`,
              overflow: 'scroll',
              height: '100%'
            }}
            onScroll={handleGridScroll}
          >
            <canvas
              ref={canvasRef} 
              style={{
                display: 'block',
                width: `${totalGridWidth}px`,   // Full content width
                height: `${blockHeight}px`, // Full content height
                cursor: hoverCursor
              }}
              // Width/Height attributes still set by editorDimensions in useEffect
              onMouseDown={handleCanvasMouseDown}
              onMouseUp={handleCanvasMouseUp}
              onMouseMove={handleCanvasMouseMove}
              onContextMenu={handleCanvasContextMenu}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MidiEditor; 