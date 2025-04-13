'use client';

import React, { useState, useRef, useEffect } from 'react';
import useStore from '../../store/store';
import { MIDIBlock, MIDINote, Track } from '../../lib/types';
import PianoRollHeader from './PianoRollHeader';
import PianoKeys from './PianoKeys';

interface MidiEditorProps {
  block: MIDIBlock;
  track: Track;
}

// Constants
const PIXELS_PER_BEAT = 50; // Greater detail than timeline view
const PIXELS_PER_SEMITONE = 16; // Height of each piano key
const GRID_SNAP = 0.25; // Snap to 1/4 beat
const KEY_COUNT = 88; // 88 piano keys (A0 to C8)
const LOWEST_NOTE = 21; // A0 MIDI note number
const NOTE_COLOR = '#4a90e2'; // Color for MIDI notes
const SELECTED_NOTE_COLOR = '#b3d9ff'; // Even brighter color for selected notes, closer to white
const RESIZE_HANDLE_WIDTH = 5; // Width of resize handles in pixels
const SELECTION_BOX_COLOR = 'rgba(100, 181, 255, 0.2)'; // Semi-transparent blue for selection box
const SELECTION_BOX_BORDER_COLOR = 'rgba(100, 181, 255, 0.8)'; // More opaque blue for selection box border
const PASTE_OFFSET = 1.5; // Offset in beats when pasting notes (2 beats to the right)

function MidiEditor({ block, track }: MidiEditorProps) {
  const { updateMidiBlock, selectNotes: storeSelectNotes } = useStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State for drag operations
  const [dragOperation, setDragOperation] = useState<'none' | 'select' | 'start' | 'end' | 'move'>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartBeat, setDragStartBeat] = useState(0);
  const [dragDuration, setDragDuration] = useState(0);
  const [dragNoteId, setDragNoteId] = useState<string | null>(null);
  const [clickOffset, setClickOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hoverCursor, setHoverCursor] = useState<'default' | 'move' | 'w-resize' | 'e-resize'>('default');
  
  // Selection related state
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  
  // Copy/paste related state
  const [copiedNotes, setCopiedNotes] = useState<MIDINote[]>([]);

  const blockDuration = block.endBeat - block.startBeat;
  const editorWidth = blockDuration * PIXELS_PER_BEAT;
  const editorHeight = KEY_COUNT * PIXELS_PER_SEMITONE;

  // Draw grid lines, notes, and selection box on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = editorWidth * dpr;
    canvas.height = editorHeight * dpr;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, editorWidth, editorHeight);
    
    // Draw horizontal lines (pitch)
    for (let i = 0; i <= KEY_COUNT; i++) {
      const y = i * PIXELS_PER_SEMITONE;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(editorWidth, y);
      
      // Check if this is an octave line (every 12th line)
      if (i % 12 === 0) {
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
      }
      
      ctx.stroke();
    }
    
    // Draw vertical lines (beats)
    for (let i = 0; i <= Math.ceil(blockDuration / GRID_SNAP); i++) {
      const x = i * GRID_SNAP * PIXELS_PER_BEAT;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, editorHeight);
      
      // Different styles for different beat divisions
      if (i % (4/GRID_SNAP) === 0) {
        ctx.strokeStyle = '#666'; // Measure lines
        ctx.lineWidth = 1;
      } else if (i % (1/GRID_SNAP) === 0) {
        ctx.strokeStyle = '#444'; // Beat lines
        ctx.lineWidth = 0.5;
      } else {
        ctx.strokeStyle = '#333'; // Grid lines
        ctx.lineWidth = 0.5;
      }
      
      ctx.stroke();
    }
    
    // Draw notes
    block.notes.forEach(note => {
      const noteX = note.startBeat * PIXELS_PER_BEAT;
      const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * PIXELS_PER_SEMITONE;
      const noteWidth = note.duration * PIXELS_PER_BEAT;
      const noteHeight = PIXELS_PER_SEMITONE;
      
      // Set color based on selection state
      const isSelected = selectedNoteIds.includes(note.id);
      ctx.fillStyle = isSelected ? SELECTED_NOTE_COLOR : NOTE_COLOR;
      
      // Round corners for the note
      const radius = 3;
      ctx.beginPath();
      ctx.moveTo(noteX + radius, noteY);
      ctx.lineTo(noteX + noteWidth - radius, noteY);
      ctx.quadraticCurveTo(noteX + noteWidth, noteY, noteX + noteWidth, noteY + radius);
      ctx.lineTo(noteX + noteWidth, noteY + noteHeight - radius);
      ctx.quadraticCurveTo(noteX + noteWidth, noteY + noteHeight, noteX + noteWidth - radius, noteY + noteHeight);
      ctx.lineTo(noteX + radius, noteY + noteHeight);
      ctx.quadraticCurveTo(noteX, noteY + noteHeight, noteX, noteY + noteHeight - radius);
      ctx.lineTo(noteX, noteY + radius);
      ctx.quadraticCurveTo(noteX, noteY, noteX + radius, noteY);
      ctx.closePath();
      ctx.fill();
      
      // Add shadow effect
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
      ctx.fill();
      ctx.shadowColor = 'transparent'; // Reset shadow
      
      // Optional: Add subtle border
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    
    // Draw selection box if active
    if (selectionBox && isDragging) {
      // Draw semi-transparent selection box
      ctx.fillStyle = SELECTION_BOX_COLOR;
      ctx.fillRect(
        Math.min(selectionBox.startX, selectionBox.endX),
        Math.min(selectionBox.startY, selectionBox.endY),
        Math.abs(selectionBox.endX - selectionBox.startX),
        Math.abs(selectionBox.endY - selectionBox.startY)
      );
      
      // Draw selection box border
      ctx.strokeStyle = SELECTION_BOX_BORDER_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.min(selectionBox.startX, selectionBox.endX),
        Math.min(selectionBox.startY, selectionBox.endY),
        Math.abs(selectionBox.endX - selectionBox.startX),
        Math.abs(selectionBox.endY - selectionBox.startY)
      );
    }
  }, [block.notes, blockDuration, editorWidth, editorHeight, selectionBox, isDragging, selectedNoteIds]);

  // Helper function to check if a note is inside the selection box
  const isNoteInSelectionBox = (note: MIDINote, box: { startX: number, startY: number, endX: number, endY: number }) => {
    if (!box) return false;
    
    const noteX = note.startBeat * PIXELS_PER_BEAT;
    const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * PIXELS_PER_SEMITONE;
    const noteWidth = note.duration * PIXELS_PER_BEAT;
    const noteHeight = PIXELS_PER_SEMITONE;
    const noteEndX = noteX + noteWidth;
    const noteEndY = noteY + noteHeight;
    
    const boxLeft = Math.min(box.startX, box.endX);
    const boxRight = Math.max(box.startX, box.endX);
    const boxTop = Math.min(box.startY, box.endY);
    const boxBottom = Math.max(box.startY, box.endY);
    
    // Check if note overlaps with selection box
    return !(
      noteEndX < boxLeft ||
      noteX > boxRight ||
      noteEndY < boxTop ||
      noteY > boxBottom
    );
  };

  // Helper functions for canvas interactions
  const getCoordsFromEvent = (e: MouseEvent | React.MouseEvent): { x: number, y: number, beat: number, pitch: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate beat and pitch
    const beat = (x / PIXELS_PER_BEAT);
    const pitch = KEY_COUNT - Math.floor(y / PIXELS_PER_SEMITONE) - 1 + LOWEST_NOTE;
    
    return { x, y, beat, pitch };
  };
  
  // Modified findNoteAt to work with multiple note selection
  const findNoteAt = (x: number, y: number): { note: MIDINote, area: 'start' | 'end' | 'body' } | null => {
    // First check if any selected note was clicked (prioritize selected notes)
    if (selectedNoteIds.length > 0) {
      for (const noteId of selectedNoteIds) {
        const note = block.notes.find(n => n.id === noteId);
        if (!note) continue;
        
        const noteX = note.startBeat * PIXELS_PER_BEAT;
        const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * PIXELS_PER_SEMITONE;
        const noteWidth = note.duration * PIXELS_PER_BEAT;
        const noteHeight = PIXELS_PER_SEMITONE;
        
        if (
          x >= noteX && 
          x <= noteX + noteWidth && 
          y >= noteY && 
          y <= noteY + noteHeight
        ) {
          if (x <= noteX + RESIZE_HANDLE_WIDTH) {
            return { note, area: 'start' };
          } else if (x >= noteX + noteWidth - RESIZE_HANDLE_WIDTH) {
            return { note, area: 'end' };
          } else {
            return { note, area: 'body' };
          }
        }
      }
    }
    
    // If no selected note was clicked, check all notes
    for (const note of block.notes) {
      const noteX = note.startBeat * PIXELS_PER_BEAT;
      const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * PIXELS_PER_SEMITONE;
      const noteWidth = note.duration * PIXELS_PER_BEAT;
      const noteHeight = PIXELS_PER_SEMITONE;
      
      if (
        x >= noteX && 
        x <= noteX + noteWidth && 
        y >= noteY && 
        y <= noteY + noteHeight
      ) {
        if (x <= noteX + RESIZE_HANDLE_WIDTH) {
          return { note, area: 'start' };
        } else if (x >= noteX + noteWidth - RESIZE_HANDLE_WIDTH) {
          return { note, area: 'end' };
        } else {
          return { note, area: 'body' };
        }
      }
    }
    
    return null;
  };

  // Mouse event handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCoordsFromEvent(e);
    if (!coords) return;
    
    const { x, y, beat, pitch } = coords;
    const result = findNoteAt(x, y);
    
    setIsDragging(false);
    setDragStart({ x: e.clientX, y: e.clientY });
    
    if (result) {
      // Clicked on a note
      e.stopPropagation();
      const { note, area } = result;
      
      // Handle selection behavior
      if (!e.shiftKey && !selectedNoteIds.includes(note.id)) {
        // If not holding shift and note is not already selected, select only this note
        setSelectedNoteIds([note.id]);
        storeSelectNotes([note]);
      } else if (e.shiftKey) {
        // If holding shift, toggle this note's selection
        if (selectedNoteIds.includes(note.id)) {
          const newSelectedIds = selectedNoteIds.filter(id => id !== note.id);
          setSelectedNoteIds(newSelectedIds);
          storeSelectNotes(block.notes.filter(n => newSelectedIds.includes(n.id)));
        } else {
          const newSelectedIds = [...selectedNoteIds, note.id];
          setSelectedNoteIds(newSelectedIds);
          storeSelectNotes(block.notes.filter(n => newSelectedIds.includes(n.id)));
        }
      }
      
      // Set up for dragging
      setDragNoteId(note.id);
      setDragStartBeat(note.startBeat);
      setDragDuration(note.duration);
      
      if (area === 'start') {
        setDragOperation('start');
        setHoverCursor('w-resize');
      } else if (area === 'end') {
        setDragOperation('end');
        setHoverCursor('e-resize');
      } else {
        setDragOperation('move');
        setHoverCursor('move');
        
        // Calculate click offset within the note for smooth dragging
        const noteX = note.startBeat * PIXELS_PER_BEAT;
        const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * PIXELS_PER_SEMITONE;
        setClickOffset({ x: x - noteX, y: y - noteY });
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
        // If selection box is very small (basically a click), create a note
        const boxWidth = Math.abs(selectionBox.endX - selectionBox.startX);
        const boxHeight = Math.abs(selectionBox.endY - selectionBox.startY);
        
        if (boxWidth < 5 && boxHeight < 5 && !isDragging) {
          // Treat as a click for note creation
          const coords = getCoordsFromEvent(e);
          if (!coords) return;
          
          const { beat, pitch } = coords;
          
          // Snap to grid
          const snappedBeat = Math.floor(beat / GRID_SNAP) * GRID_SNAP;
          
          // Ensure values are in valid range
          if (snappedBeat < 0 || snappedBeat >= blockDuration || pitch < 0 || pitch > 127) {
            setDragOperation('none');
            setSelectionBox(null);
            return;
          }
          
          // Create a new note
          const newNote: MIDINote = {
            id: `note-${block.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            startBeat: snappedBeat,
            duration: 1, // Default to 1 beat
            velocity: 100,
            pitch
          };
          
          // Add to block
          const updatedBlock = { ...block };
          updatedBlock.notes = [...block.notes, newNote];
          updateMidiBlock(track.id, updatedBlock);
        } else {
          // Process notes inside selection box
          const notesInSelection = block.notes.filter(note => 
            isNoteInSelectionBox(note, selectionBox)
          );
          
          if (e.shiftKey) {
            // Add to existing selection if shift is held
            const newSelectedIds = [...new Set([...selectedNoteIds, ...notesInSelection.map(n => n.id)])];
            setSelectedNoteIds(newSelectedIds);
            storeSelectNotes(block.notes.filter(n => newSelectedIds.includes(n.id)));
          } else {
            // Replace selection
            setSelectedNoteIds(notesInSelection.map(n => n.id));
            storeSelectNotes(notesInSelection);
          }
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
    
    const coords = getCoordsFromEvent(e);
    if (!coords) return;
    
    const result = findNoteAt(coords.x, coords.y);
    if (result) {
      // Found a note, delete it
      const { note } = result;
      const updatedBlock = { ...block };
      updatedBlock.notes = block.notes.filter(n => n.id !== note.id);
      updateMidiBlock(track.id, updatedBlock);
    }
  };
  
  // Modified canvasMouseMove to handle selection box updates
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCoordsFromEvent(e);
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
      
      // Set isDragging if we've moved a significant distance
      if (!isDragging) {
        const dx = x - selectionBox.startX;
        const dy = y - selectionBox.startY;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          setIsDragging(true);
        }
      }
      
      return;
    }
    
    // Skip hover effects if we're already in a drag operation
    if (dragOperation !== 'none') return;
    
    // Handle hover cursor
    const result = findNoteAt(x, y);
    
    if (result) {
      // Cursor is over a note, set the appropriate cursor style
      if (result.area === 'start') {
        setHoverCursor('w-resize');
      } else if (result.area === 'end') {
        setHoverCursor('e-resize');
      } else {
        setHoverCursor('move');
      }
    } else {
      // Not over a note
      setHoverCursor('default');
    }
  };

  // Modified global mouse move handler to handle multi-select movement and alt/option-drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Handle selection box updates
      if (dragOperation === 'select' && selectionBox) {
        const coords = getCoordsFromEvent(e);
        if (!coords) return;
        
        // Update selection box
        setSelectionBox({
          ...selectionBox,
          endX: coords.x,
          endY: coords.y
        });
        
        // Set isDragging if we've moved a significant distance
        if (!isDragging) {
          const dx = coords.x - selectionBox.startX;
          const dy = coords.y - selectionBox.startY;
          if (Math.sqrt(dx * dx + dy * dy) > 5) {
            setIsDragging(true);
          }
        }
        
        return;
      }
      
      // Handle note modifications
      if (dragOperation === 'none' || !dragNoteId) return;
      
      // Check if we've dragged enough to be considered a drag vs. click
      if (!isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) { // 5px threshold
          setIsDragging(true);
          
          // Check for Alt/Option key when starting drag (for duplicating notes)
          if (dragOperation === 'move' && (e.altKey || e.metaKey)) {
            // Get the notes to be duplicated
            const notesToDuplicate = block.notes
              .filter(note => selectedNoteIds.includes(note.id))
              .map(note => ({ 
                ...note,
                id: `note-${block.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
              }));
            
            // Create duplicate notes and add them to the block
            const updatedBlock = { ...block };
            updatedBlock.notes = [...block.notes, ...notesToDuplicate];
            updateMidiBlock(track.id, updatedBlock);
            
            // Update the selection to the new duplicated notes
            const newNoteIds = notesToDuplicate.map(note => note.id);
            setSelectedNoteIds(newNoteIds);
            storeSelectNotes(notesToDuplicate);
            
            // Update the drag note ID to the duplicated version of the originally clicked note
            const originalNoteIndex = block.notes.findIndex(note => note.id === dragNoteId);
            if (originalNoteIndex !== -1) {
              setDragNoteId(notesToDuplicate[notesToDuplicate.length - 1].id);
            }
          }
        } else {
          return; // Don't start dragging yet
        }
      }
      
      const coords = getCoordsFromEvent(e);
      if (!coords) return;
      
      // Special handling for move operation with multiple selected notes
      if (dragOperation === 'move' && selectedNoteIds.length > 0) {
        // Get the primary note being dragged
        const primaryNoteIndex = block.notes.findIndex(note => note.id === dragNoteId);
        if (primaryNoteIndex === -1) return;
        
        const primaryNote = block.notes[primaryNoteIndex];
        
        const { x, y } = coords;
        
        // Calculate the target position for the primary note
        const targetX = x - clickOffset.x;
        const targetY = y - clickOffset.y;
        
        // Convert to beat and pitch, with snapping
        const targetBeat = Math.round(targetX / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;
        const targetPitch = KEY_COUNT - Math.floor(targetY / PIXELS_PER_SEMITONE) - 1 + LOWEST_NOTE;
        
        // Calculate the delta from primary note's original position
        const beatDelta = targetBeat - primaryNote.startBeat;
        const pitchDelta = targetPitch - primaryNote.pitch;
        
        // Skip if no change
        if (beatDelta === 0 && pitchDelta === 0) return;
        
        // Update all selected notes with the same delta
        const updatedBlock = { ...block };
        updatedBlock.notes = block.notes.map(note => {
          if (selectedNoteIds.includes(note.id)) {
            const newStartBeat = note.startBeat + beatDelta;
            const newPitch = note.pitch + pitchDelta;
            
            // Clamp values
            return {
              ...note,
              startBeat: Math.max(0, Math.min(blockDuration - note.duration, newStartBeat)),
              pitch: Math.max(0, Math.min(127, newPitch))
            };
          }
          return note;
        });
        
        // Update block
        updateMidiBlock(track.id, updatedBlock);
        return;
      }
      
      // Handle single note operations (start/end resize)
      const noteIndex = block.notes.findIndex(note => note.id === dragNoteId);
      if (noteIndex === -1) return;
      
      const note = { ...block.notes[noteIndex] };
      
      if (dragOperation === 'start') {
        // Resizing from start - adjust start beat and duration
        const deltaBeats = Math.round((e.clientX - dragStart.x) / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;
        let newStartBeat = dragStartBeat + deltaBeats;
        
        // Clamp to valid range
        newStartBeat = Math.max(0, Math.min(note.startBeat + note.duration - GRID_SNAP, newStartBeat));
        
        note.duration = note.duration - (newStartBeat - note.startBeat);
        note.startBeat = newStartBeat;
        
      } else if (dragOperation === 'end') {
        // Resizing from end - adjust duration only
        const deltaBeats = Math.round((e.clientX - dragStart.x) / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;
        let newDuration = dragDuration + deltaBeats;
        
        // Clamp to valid range
        newDuration = Math.max(GRID_SNAP, Math.min(blockDuration - note.startBeat, newDuration));
        
        note.duration = newDuration;
      }
      
      // Update the note in the block
      const updatedBlock = { ...block };
      updatedBlock.notes = [...block.notes];
      updatedBlock.notes[noteIndex] = note;
      updateMidiBlock(track.id, updatedBlock);
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      setDragNoteId(null);
      setDragOperation('none');
      setIsDragging(false);
      setSelectionBox(null);
      
      // When mouse is up, we need to reset the hover cursor 
      // and let the regular mousemove handler take over
      const element = canvasRef.current;
      if (element) {
        const rect = element.getBoundingClientRect();
        if (
          e.clientX >= rect.left && 
          e.clientX <= rect.right && 
          e.clientY >= rect.top && 
          e.clientY <= rect.bottom
        ) {
          // Mouse is still over the canvas, check if it's over a note
          const coords = getCoordsFromEvent(e);
          if (coords) {
            const result = findNoteAt(coords.x, coords.y);
            if (result) {
              if (result.area === 'start') setHoverCursor('w-resize');
              else if (result.area === 'end') setHoverCursor('e-resize');
              else setHoverCursor('move');
            } else {
              setHoverCursor('default');
            }
          }
        }
      }
    };
    
    // Handle key events
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if focus is on an input element
      if (document.activeElement && 
          (document.activeElement.tagName === 'INPUT' || 
           document.activeElement.tagName === 'TEXTAREA')) {
        return; // Don't handle shortcuts when typing in form controls
      }

      // Delete key to remove selected notes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNoteIds.length > 0) {
          const updatedBlock = { ...block };
          updatedBlock.notes = block.notes.filter(note => !selectedNoteIds.includes(note.id));
          updateMidiBlock(track.id, updatedBlock);
          setSelectedNoteIds([]);
          storeSelectNotes([]);
        }
      }
      
      // Escape key to clear selection
      if (e.key === 'Escape') {
        setSelectedNoteIds([]);
        storeSelectNotes([]);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    block, 
    track.id, 
    dragNoteId, 
    dragOperation, 
    dragStart, 
    dragStartBeat, 
    dragDuration, 
    isDragging, 
    updateMidiBlock, 
    blockDuration,
    selectionBox,
    selectedNoteIds,
    storeSelectNotes,
    clickOffset
  ]);

  // Handle key events for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if focus is on an input element
      if (document.activeElement && 
          (document.activeElement.tagName === 'INPUT' || 
           document.activeElement.tagName === 'TEXTAREA')) {
        return; // Don't handle shortcuts when typing in form controls
      }

      // Copy selected notes (Ctrl+C)
      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        if (selectedNoteIds.length > 0) {
          const notesToCopy = block.notes
            .filter(note => selectedNoteIds.includes(note.id))
            .map(note => ({ ...note })); // Create a deep copy
          
          setCopiedNotes(notesToCopy);
          console.log(`Copied ${notesToCopy.length} notes`);
        }
      }
      
      // Paste notes (Ctrl+V)
      if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        if (copiedNotes.length > 0) {
          // Find the leftmost position of copied notes to calculate relative positions
          const minBeat = Math.min(...copiedNotes.map(note => note.startBeat));
          
          // Create new notes with new IDs and offset positions
          const newNotes = copiedNotes.map(note => {
            // Calculate position relative to the leftmost note and add paste offset
            const relativePosition = note.startBeat - minBeat;
            const newStartBeat = minBeat + relativePosition + PASTE_OFFSET;
            
            // Ensure the note fits within the block
            if (newStartBeat + note.duration > blockDuration) {
              return null; // Skip notes that would extend beyond the block
            }
            
            return {
              ...note,
              id: `note-${block.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              startBeat: newStartBeat
            };
          }).filter(note => note !== null) as MIDINote[];
          
          if (newNotes.length > 0) {
            // Add pasted notes to block
            const updatedBlock = { ...block };
            updatedBlock.notes = [...block.notes, ...newNotes];
            updateMidiBlock(track.id, updatedBlock);
            
            // Select the newly pasted notes
            setSelectedNoteIds(newNotes.map(note => note.id));
            storeSelectNotes(newNotes);
            
            console.log(`Pasted ${newNotes.length} notes`);
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [block, track.id, selectedNoteIds, copiedNotes, blockDuration, updateMidiBlock, storeSelectNotes]);

  return (
    <div 
      ref={editorRef}
      className="midi-editor" 
      style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#222',
        color: '#ddd',
        position: 'relative'
      }}
    >
      <h3 style={{ margin: '0', padding: '10px' }}>
        MIDI Editor - {track.name} - Block {block.startBeat} to {block.endBeat}
      </h3>
      
      <div style={{ 
        display: 'flex', 
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* Piano keys on the left */}
        <div style={{ 
          width: '40px', 
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundColor: '#1a1a1a',
          borderRight: '1px solid #333'
        }}>
          <div style={{ height: `${editorHeight}px` }}>
            <PianoKeys keyCount={KEY_COUNT} keyHeight={PIXELS_PER_SEMITONE} />
          </div>
        </div>
        
        {/* Main editor area */}
        <div style={{ 
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          position: 'relative'
        }}>
          {/* Beat header at top */}
          <div style={{ 
            position: 'sticky', 
            top: 0, 
            height: '30px',
            backgroundColor: 'black',
            zIndex: 1,
            borderBottom: '1px solid #333'
          }}>
            <PianoRollHeader 
              startBeat={block.startBeat} 
              endBeat={block.endBeat} 
              pixelsPerBeat={PIXELS_PER_BEAT} 
            />
          </div>
          
          {/* Notes area - now using canvas instead of divs */}
          <div 
            style={{ 
              position: 'relative',
              width: `${editorWidth}px`, 
              height: `${editorHeight}px`,
              backgroundColor: '#2a2a2a'
            }}
          >
            {/* Single canvas for grid and notes */}
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${editorWidth}px`,
                height: `${editorHeight}px`,
                cursor: dragOperation !== 'none' 
                  ? (dragOperation === 'move' ? 'move' : 
                     dragOperation === 'start' ? 'w-resize' :
                     dragOperation === 'end' ? 'e-resize' : 'default')
                  : hoverCursor
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onContextMenu={handleCanvasContextMenu}
              onMouseLeave={() => setHoverCursor('default')} // Reset cursor when mouse leaves canvas
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MidiEditor; 