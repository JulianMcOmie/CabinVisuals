'use client';

import React, { useState, useRef, useEffect } from 'react';
import useStore from '../../store/store';
import { MIDIBlock, MIDINote, Track } from '../../lib/types';

// Import subcomponents
import PianoRollHeader from './components/PianoRollHeader';
import PianoKeys from './components/PianoKeys';

// Import utils
import {
  PIXELS_PER_BEAT,
  PIXELS_PER_SEMITONE,
  KEY_COUNT,
  DragOperation,
  CursorType,
  SelectionBox,
} from './utils/constants';

import {
  getCoordsFromEvent,
  findNoteAt,
} from './utils/utils';

import { drawMidiEditor } from './utils/canvas';

import {
  handleNoteClick,
  handleSelectionBoxComplete,
  handleContextMenuOnNote
} from './utils/clickOperations';

import {
  handleOptionDrag,
  handleDragMove,
  isDragThresholdMet
} from './utils/dragOperations';

import { handleKeyboardShortcuts } from './utils/keyboardHandlers';

interface MidiEditorProps {
  block: MIDIBlock;
  track: Track;
}

function MidiEditor({ block, track }: MidiEditorProps) {
  const { 
    updateMidiBlock, 
    selectNotes: storeSelectNotes, 
    setSelectedWindow
  } = useStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State for drag operations
  const [dragOperation, setDragOperation] = useState<DragOperation>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialDragStates, setInitialDragStates] = useState<Map<string, { startBeat: number, duration: number }>>(new Map());
  const [dragNoteId, setDragNoteId] = useState<string | null>(null);
  const [clickOffset, setClickOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hoverCursor, setHoverCursor] = useState<CursorType>('default');
  
  // Selection related state
  const [selectionBox, setSelectionBox] = useState<SelectionBox>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  
  // Copy/paste related state
  const [copiedNotes, setCopiedNotes] = useState<MIDINote[]>([]);

  const blockDuration = block.endBeat - block.startBeat;
  const editorWidth = editorRef.current?.clientWidth || 800; // Default width if ref not available
  const editorHeight = editorRef.current?.clientHeight || KEY_COUNT * PIXELS_PER_SEMITONE; // Default height if ref not available

  const blockWidth = blockDuration * PIXELS_PER_BEAT;
  const blockHeight = KEY_COUNT * PIXELS_PER_SEMITONE;

  // Draw canvas using our extracted drawing function
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = editorWidth * dpr;
    canvas.height = editorHeight * dpr;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.scale(dpr, dpr);
    
    drawMidiEditor(
      ctx,
      block.notes,
      selectedNoteIds,
      editorWidth,
      editorHeight,
      blockWidth,
      blockHeight,
      blockDuration,
      selectionBox,
      isDragging
    );
  }, [block.notes, blockDuration, editorWidth, editorHeight, selectionBox, isDragging, selectedNoteIds]);

  // Mouse event handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setSelectedWindow('midiEditor');
    const coords = getCoordsFromEvent(e, canvasRef);
    if (!coords) return;
    
    const { x, y, beat, pitch } = coords;
    const clickResult = findNoteAt(x, y, block.notes, selectedNoteIds);
    
    setIsDragging(false);
    setDragStart({ x: e.clientX, y: e.clientY });
    
    if (clickResult) {
      // Clicked on a note
      e.stopPropagation();
      const { note, area } = clickResult;
      
      // Use the utility function to handle note click
      const { 
        selectedIds, 
        selectedNotes, 
        dragOperation: newDragOperation, 
        cursorType, 
        clickOffset: newClickOffset 
      } = handleNoteClick(
        block, 
        note, 
        area, 
        selectedNoteIds, 
        e.shiftKey, 
        x, 
        y
      );
      
      // Update state based on results from utility function
      setSelectedNoteIds(selectedIds);
      storeSelectNotes(selectedNotes);
      setDragNoteId(note.id);
      setDragOperation(newDragOperation);
      setHoverCursor(cursorType);
      setClickOffset(newClickOffset);
      // Store initial drag states
      setInitialDragStates(prev => {
        const newStates = new Map(prev);
        // Store initial state for all selected notes
        selectedIds.forEach(id => {
          const selectedNote = block.notes.find(n => n.id === id);
          if (selectedNote) {
            newStates.set(id, { startBeat: selectedNote.startBeat, duration: selectedNote.duration });
          }
        });
        return newStates;
      });
      
      // Handle Option/Alt key for duplication at initial click
      if (e.altKey && newDragOperation === 'move') {
        const { 
          updatedBlock, 
          newSelectedIds, 
          newDragNoteId, 
          notesToSelect 
        } = handleOptionDrag(block, selectedIds, note.id);
        
        // Update state based on the duplication results
        updateMidiBlock(track.id, updatedBlock);
        setSelectedNoteIds(newSelectedIds);
        storeSelectNotes(notesToSelect);
        setDragNoteId(newDragNoteId);
        setIsDragging(true); // Skip drag threshold check
      }
    } else {
      // Clicked on empty space - will start selection box
      setDragOperation('select');
      setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
      
      // Clear selection if not holding shift
      if (!e.shiftKey) {
        setSelectedNoteIds([]);
        storeSelectNotes([]);
      }
      
      setDragNoteId(null);
      setHoverCursor('default');
    }
  };
  
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragNoteId) {
      // We were dragging a note - just end the drag
      setDragNoteId(null);
      setDragOperation('none');
      setSelectionBox(null);
      return;
    }
    
    if (dragOperation === 'select') {
      // Handle selection box completion
      if (selectionBox) {
        const coords = getCoordsFromEvent(e, canvasRef);
        if (!coords) {
          setDragOperation('none');
          setSelectionBox(null);
          return;
        }
        
        const { action, newNote, selectedIds, selectedNotes } = handleSelectionBoxComplete(
          block,
          selectionBox,
          e.shiftKey ? selectedNoteIds : [],
          isDragging,
          coords
        );
        
        if (action === 'create-note' && newNote) {
          // Add new note to block
          const updatedBlock = { ...block };
          updatedBlock.notes = [...block.notes, newNote];
          updateMidiBlock(track.id, updatedBlock);
          
          // Select the new note
          setSelectedNoteIds([newNote.id]);
          storeSelectNotes([newNote]);
        } else {
          // Update selection based on the selection box
          setSelectedNoteIds(selectedIds);
          storeSelectNotes(selectedNotes);
        }
      }
      
      setDragOperation('none');
      setSelectionBox(null);
      return;
    }
    
    // Other operations handled elsewhere
    setDragOperation('none');
    setSelectionBox(null);
  };
  
  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setSelectedWindow('midiEditor');
    
    const coords = getCoordsFromEvent(e, canvasRef);
    if (!coords) return;
    
    const result = findNoteAt(coords.x, coords.y, block.notes, selectedNoteIds);
    if (result) {
      // Found a note, delete it using the utility function
      const updatedBlock = handleContextMenuOnNote(block, result.note.id);
      updateMidiBlock(track.id, updatedBlock);
    }
  };
  
  // Modified canvasMouseMove to handle selection box updates
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCoordsFromEvent(e, canvasRef);
    if (!coords) {
      setHoverCursor('default');
      return;
    }
    
    const { x, y } = coords;
    
    // Update selection box if in select mode
    if (dragOperation === 'select' && selectionBox) {
      setSelectionBox({
        ...selectionBox,
        endX: x,
        endY: y
      });
      
      // Check if drag threshold is met using utility function
      if (!isDragging && isDragThresholdMet(selectionBox.startX, selectionBox.startY, coords.x, coords.y)) {
        setIsDragging(true);
      }
      
      return;
    }
    
    // Skip hover effects if we're already in a drag operation
    if (dragOperation !== 'none') return;
    
    // Handle hover cursor
    const cursorResult = findNoteAt(x, y, block.notes, selectedNoteIds);
    
    if (cursorResult) {
      // Cursor is over a note, set the appropriate cursor style
      if (cursorResult.area === 'start') {
        setHoverCursor('w-resize');
      } else if (cursorResult.area === 'end') {
        setHoverCursor('e-resize');
      } else {
        setHoverCursor('move');
      }
    } else {
      // Not over a note
      setHoverCursor('default');
    }
  };

  // Global mouse handlers and keyboard shortcuts
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Handle selection box updates
      if (dragOperation === 'select' && selectionBox) {
        const coords = getCoordsFromEvent(e, canvasRef);
        if (!coords) return;
        
        // Update selection box
        setSelectionBox({
          ...selectionBox,
          endX: coords.x,
          endY: coords.y
        });
        
        // Check if drag threshold is met using utility function
        if (!isDragging && isDragThresholdMet(selectionBox.startX, selectionBox.startY, coords.x, coords.y)) {
          setIsDragging(true);
        }
        
        return;
      }
      
      // Handle note modifications
      if (dragOperation === 'none' || !dragNoteId) return;
      
      // Check if we've dragged enough to be considered a drag vs. click
      if (!isDragging) {
        if (isDragThresholdMet(dragStart.x, dragStart.y, e.clientX, e.clientY)) {
          setIsDragging(true);
          
          // Check for Alt/Option key when starting drag (for duplicating notes)
          // Only check here if we didn't already duplicate at mousedown
          if (dragOperation === 'move' && (e.altKey || e.metaKey)) {
            const { 
              updatedBlock, 
              newSelectedIds, 
              newDragNoteId, 
              notesToSelect 
            } = handleOptionDrag(block, selectedNoteIds, dragNoteId);
            
            // Update state based on the duplication results
            updateMidiBlock(track.id, updatedBlock);
            setSelectedNoteIds(newSelectedIds);
            storeSelectNotes(notesToSelect);
            setDragNoteId(newDragNoteId);
          }
        } else {
          return; // Don't start dragging yet
        }
      }
      
      const coords = getCoordsFromEvent(e, canvasRef);
      if (!coords) return;
      
      // Use utility function to handle drag movement
      if (dragOperation === 'move' || dragOperation === 'start' || dragOperation === 'end') {
        const updatedBlock = handleDragMove(
          block,
          dragOperation,
          dragNoteId,
          selectedNoteIds,
          coords,
          clickOffset,
          dragStart,
          initialDragStates
        );
        
        // Only update if the block has changed
        if (updatedBlock !== block) {
          updateMidiBlock(track.id, updatedBlock);
        }
      }
    };
    
    const handleMouseUp = () => {
      // End all drag operations
      setDragNoteId(null);
      setDragOperation('none');
      setSelectionBox(null);
      setIsDragging(false);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Use the handler from keyboardHandlers.ts
      handleKeyboardShortcuts(
        e,
        block,
        selectedNoteIds,
        copiedNotes,
        track.id,
        updateMidiBlock,
        setSelectedNoteIds,
        storeSelectNotes,
        setCopiedNotes
      );
    };
    
    // Add event listeners
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    block, 
    track.id, 
    updateMidiBlock, 
    dragNoteId, 
    dragOperation, 
    dragStart,
    initialDragStates,
    selectionBox, 
    selectedNoteIds, 
    storeSelectNotes,
    isDragging,
    clickOffset,
    copiedNotes,
    setCopiedNotes
  ]);

  const handleEditorClick = () => {
      setSelectedWindow('midiEditor');
  }
  
  return (
    <div 
        ref={editorRef} 
        className="midi-editor relative overflow-auto border border-gray-700 rounded-md" 
        onClick={handleEditorClick}
    >
      <div className="piano-roll flex flex-col">
        <div className="flex">
          <div className="piano-roll-header">
            <PianoRollHeader 
              startBeat={block.startBeat} 
              endBeat={block.endBeat} 
              pixelsPerBeat={PIXELS_PER_BEAT} 
            />
          </div>
        </div>
        <div className="flex min-h-[768px]">
          <div className="piano-keys">
            <PianoKeys 
              keyCount={KEY_COUNT} 
              keyHeight={PIXELS_PER_SEMITONE} 
            />
          </div>
          <div 
            className="piano-roll-grid relative" 
            style={{ width: `${editorWidth}px`, height: `${editorHeight}px` }}
          >
            <canvas 
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full"
              width={editorWidth}
              height={editorHeight}
              style={{ cursor: hoverCursor }}
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