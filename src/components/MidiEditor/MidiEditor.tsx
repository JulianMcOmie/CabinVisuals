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
  BEATS_PER_MEASURE,
} from './utils/constants';

import {
  getCoordsFromEvent,
  findNoteAt,
  generateNoteId
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

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), waitFor);
  };
}

function MidiEditor({ block, track }: MidiEditorProps) {
  const { 
    updateMidiBlock, 
    selectNotes: storeSelectNotes, 
    setSelectedWindow,
    selectedWindow,
    numMeasures
  } = useStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- NEW: State for reactive dimensions ---
  const [editorDimensions, setEditorDimensions] = useState({ width: 0, height: 0 });
  // -------------------------------------------

  // Use state dimensions, fallback if needed
  const editorWidth = editorDimensions.width || numMeasures * BEATS_PER_MEASURE * PIXELS_PER_BEAT; 
  const editorHeight = editorDimensions.height || KEY_COUNT * PIXELS_PER_SEMITONE;
  
  // --- NEW: Effect to listen for resize and update dimensions ---
  useEffect(() => {
    const editorElement = editorRef.current;
    if (!editorElement) return;

    // Function to update dimensions
    const updateDimensions = () => {
      setEditorDimensions({
        width: editorElement.clientWidth,
        height: editorElement.clientHeight,
      });
    };

    // Initial dimensions
    updateDimensions();

    // Debounced resize handler
    const handleResize = debounce(updateDimensions, 100); // Adjust debounce time as needed

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Empty dependency array: run once on mount
  // -------------------------------------------------------------

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

  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [zoomX, setZoomX] = useState(1);
  const [zoomY, setZoomY] = useState(1);
  const [pixelsPerBeat, setPixelsPerBeat] = useState(PIXELS_PER_BEAT); //useState(editorWidth / (numMeasures * BEATS_PER_MEASURE));
  const [pixelsPerSemitone, setPixelsPerSemitone] = useState(PIXELS_PER_SEMITONE);
  
  // Copy/paste related state
  const [copiedNotes, setCopiedNotes] = useState<MIDINote[]>([]);

  const blockStartBeat = block.startBeat;


  const blockDuration = block.endBeat - block.startBeat;
  const blockWidth = blockDuration * pixelsPerBeat;
  const blockHeight = KEY_COUNT * pixelsPerSemitone;
  
  // Draw canvas using our extracted drawing function
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!editorDimensions.width || !editorDimensions.height) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = editorDimensions.width * dpr;
    canvas.height = editorDimensions.height * dpr;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.scale(dpr, dpr);
    
    drawMidiEditor(
      ctx,
      block.notes,
      selectedNoteIds,
      editorDimensions.width,
      editorDimensions.height,
      blockWidth,
      blockHeight,
      blockDuration,
      blockStartBeat,
      selectionBox,
      isDragging,
      pixelsPerBeat,
      pixelsPerSemitone
    );
  }, [
      block.notes, 
      blockDuration, 
      blockStartBeat, 
      editorDimensions,
      selectionBox, 
      isDragging, 
      selectedNoteIds,
      blockWidth,
      blockHeight,
      pixelsPerBeat,
      pixelsPerSemitone
  ]);

  // Helper to get coords and derived values
  const getCoordsAndDerived = (e: MouseEvent | React.MouseEvent) => {
    const coords = getCoordsFromEvent(e, canvasRef, pixelsPerBeat, pixelsPerSemitone);
    if (!coords) return null;
    
    const { x, y, beat, pitch } = coords;
    return { x, y, beat, pitch };
  };

  // Mouse event handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setSelectedWindow('midiEditor');
    const coords = getCoordsAndDerived(e);
    if (!coords) return;
    
    const { x, y, beat, pitch } = coords;
    const noteClickResult = findNoteAt(
      x,
      y,
      block.notes,
      selectedNoteIds,
      pixelsPerBeat,
      pixelsPerSemitone,
      blockStartBeat,
      blockDuration
    );
    
    setIsDragging(false);
    setDragStart({ x: coords.x, y: coords.y });
    
    if (noteClickResult) {
      // Clicked on a note
      e.stopPropagation();
      const { note, area } = noteClickResult;
      
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
        y,
        pixelsPerBeat,
        pixelsPerSemitone
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
        
        // Apply state updates immediately
        updateMidiBlock(track.id, updatedBlock);
        setSelectedNoteIds(newSelectedIds);
        storeSelectNotes(notesToSelect);
        setDragNoteId(newDragNoteId);
        
        // Update initialDragStates for the newly created notes
        setInitialDragStates(prev => {
            const newStates = new Map(prev);
            notesToSelect.forEach(newNote => {
                newStates.set(newNote.id, { startBeat: newNote.startBeat, duration: newNote.duration });
            });
            return newStates;
        });

        setIsDragging(true); // Skip drag threshold check
      } else {
         // Update initialDragStates for non-duplicate drag start
          setInitialDragStates(prev => {
            const newStates = new Map(); // Start fresh for this selection
            selectedIds.forEach(id => {
              const selectedNote = block.notes.find(n => n.id === id);
              if (selectedNote) {
                newStates.set(id, { startBeat: selectedNote.startBeat, duration: selectedNote.duration });
              }
            });
            return newStates;
          });
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
    // If we were dragging a note, the global mouseup already handles resetting state.
    // If we were creating a selection box, the global mouseup will handle completion.
    // This handler might not be strictly necessary anymore unless needed for other canvas-specific mouseup actions.
    // Keep it simple for now, global handler takes precedence.
    // console.log("handleCanvasMouseUp - Now likely handled by global listener");
  };
  
  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setSelectedWindow('midiEditor');
    
    const coords = getCoordsAndDerived(e);
    if (!coords) return;
    
    const result = findNoteAt(coords.x, coords.y, block.notes, selectedNoteIds, pixelsPerBeat, pixelsPerSemitone, blockStartBeat, blockDuration);
    if (result) {
      // Found a note, delete it using the utility function
      const updatedBlock = handleContextMenuOnNote(block, result.note.id);
      updateMidiBlock(track.id, updatedBlock);
    }
  };
  
  // Modified canvasMouseMove to handle selection box updates
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCoordsAndDerived(e);
    if (!coords) {
      setHoverCursor('default');
      return;
    }
    
    const { x, y, beat, pitch } = coords;
    
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
    const cursorResult = findNoteAt(x, y, block.notes, selectedNoteIds, pixelsPerBeat, pixelsPerSemitone, blockStartBeat, blockDuration);
    
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
        const coords = getCoordsAndDerived(e);
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
          
          // Handle Option/Alt key duplication HERE too
          if (dragOperation === 'move' && (e.altKey || e.metaKey) && initialDragStates.size > 0) { // Ensure initial states exist
            // Use initialDragStates.keys() as the IDs to duplicate
            const idsToDuplicate = Array.from(initialDragStates.keys());
            // Need the original primary drag note ID before duplication
            const originalDragNoteId = dragNoteId; // Assume dragNoteId holds the original ID at this point
            
            const { 
              updatedBlock, 
              newSelectedIds, 
              newDragNoteId, 
              notesToSelect 
            } = handleOptionDrag(block, idsToDuplicate, originalDragNoteId);
            
            // Apply state updates immediately
            updateMidiBlock(track.id, updatedBlock);
            setSelectedNoteIds(newSelectedIds);
            storeSelectNotes(notesToSelect);
            setDragNoteId(newDragNoteId);

            // Update initialDragStates for the newly created notes
            setInitialDragStates(prev => {
                const newStates = new Map(); // Start fresh with only the new notes for this drag
                notesToSelect.forEach(newNote => {
                    newStates.set(newNote.id, { startBeat: newNote.startBeat, duration: newNote.duration });
                });
                return newStates;
            });
            // Proceed with the drag using the new notes
          }
        } else {
          return; // Don't start dragging yet
        }
      }
      
      // Ensure coords use the *current* state after potential duplication
      const derivedCoords = getCoordsAndDerived(e);
      if (!derivedCoords) return;
      
      // Use utility function to handle drag movement
      if (dragOperation === 'move' || dragOperation === 'start' || dragOperation === 'end') {
        // Pass the CURRENT dragNoteId and selectedNoteIds (updated if duplication happened)
        const updatedBlock = handleDragMove(
          block,
          dragOperation,
          dragNoteId, // Use current dragNoteId
          selectedNoteIds, // Use current selectedNoteIds
          derivedCoords, // Pass the whole coords object
          clickOffset,
          dragStart, // Pass original dragStart (client coords)
          initialDragStates, // Pass potentially updated initialDragStates
          pixelsPerBeat,
          pixelsPerSemitone
        );
        
        if (updatedBlock !== block) {
          updateMidiBlock(track.id, updatedBlock);
        }
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (dragOperation === 'select') {
        if (selectionBox) {
          const derivedCoords = getCoordsAndDerived(e);

          // --- FIX: Only process selection if coords are valid --- 
          if (derivedCoords) { 
            const { action, newNote, selectedIds, selectedNotes } = handleSelectionBoxComplete(
              block,
              selectionBox,
              selectedNoteIds, 
              isDragging, 
              derivedCoords, // Pass valid coords
              pixelsPerBeat, 
              pixelsPerSemitone
            );
            
            if (action === 'create-note' && newNote) {
              // ... add new note ...
              const updatedBlock = { ...block };
              updatedBlock.notes = [...block.notes, newNote];
              updateMidiBlock(track.id, updatedBlock);
              setSelectedNoteIds([newNote.id]);
              storeSelectNotes([newNote]);
            } else {
              // Update selection based on the box
              setSelectedNoteIds(selectedIds);
              storeSelectNotes(selectedNotes);
            }
          } else {
              // Coords were null (mouseup far away?), just clear selection box visually
              // but maybe don't alter the note selection state?
              // Or perhaps clear the selection?
              // Current behaviour: selection state is updated only if coords are valid.
              console.warn("MouseUp for selection box occurred too far away to get coordinates.");
          }
          // ----------------------------------------------------
        } 
        // Reset selection box state regardless of coords
        setSelectionBox(null);
      }

      // Reset ALL drag operations
      setDragNoteId(null);
      setDragOperation('none'); 
      setSelectionBox(null); 
      setIsDragging(false);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts if this window is selected
      if (selectedWindow !== 'midiEditor') return;

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
    window.addEventListener('mouseup', handleMouseUp); // This listener now handles selection end
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
    setCopiedNotes,
    selectedWindow,
    pixelsPerBeat,
    pixelsPerSemitone
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
              pixelsPerBeat={pixelsPerBeat} 
            />
          </div>
        </div>
        <div className="flex min-h-[768px]">
          <div className="piano-keys">
            <PianoKeys 
              keyCount={KEY_COUNT} 
              keyHeight={pixelsPerSemitone} 
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