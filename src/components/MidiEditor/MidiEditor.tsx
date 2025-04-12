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

function MidiEditor({ block, track }: MidiEditorProps) {
  const { updateMidiBlock } = useStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // State for note operations
  const [dragOperation, setDragOperation] = useState<'none' | 'start' | 'end' | 'move'>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartBeat, setDragStartBeat] = useState(0);
  const [dragDuration, setDragDuration] = useState(0);
  const [dragNoteId, setDragNoteId] = useState<string | null>(null);
  const [clickOffset, setClickOffset] = useState({ x: 0, y: 0 });

  // Calculate dimensions based on block and key count
  const blockDuration = block.endBeat - block.startBeat;
  const editorWidth = blockDuration * PIXELS_PER_BEAT;
  const editorHeight = KEY_COUNT * PIXELS_PER_SEMITONE;

  // Draw grid lines on canvas
  useEffect(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    
    // Set canvas dimensions (considering device pixel ratio for sharpness)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = editorWidth * dpr;
    canvas.height = editorHeight * dpr;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Scale all drawing operations by dpr
    ctx.scale(dpr, dpr);
    
    // Clear the canvas
    ctx.clearRect(0, 0, editorWidth, editorHeight);
    
    // Draw horizontal lines (pitch)
    for (let i = 0; i <= KEY_COUNT; i++) {
      const y = i * PIXELS_PER_SEMITONE;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(editorWidth, y);
      
      // Check if this is an octave line (every 12th line)
      if (i % 12 === 0) {
        ctx.strokeStyle = '#666'; // Stronger color for octaves
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
  }, [blockDuration, editorWidth, editorHeight]);

  // Handle mouse events for note operations
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Don't create a note if we just finished dragging
      if (dragNoteId || !notesContainerRef.current) 
      {
        setDragNoteId(null);
        setDragOperation('none');
        return;
      }
      
      const containerRect = notesContainerRef.current.getBoundingClientRect();
      
      // Check if the click is inside the notes container
      if (
        e.clientX < containerRect.left || 
        e.clientX > containerRect.right || 
        e.clientY < containerRect.top || 
        e.clientY > containerRect.bottom
      ) {
        // Click is outside the notes container, don't create a note
        return;
      }
      
      const x = e.clientX - containerRect.left;
      const y = e.clientY - containerRect.top;
      
      // Convert to absolute beat and pitch
      const absoluteBeat = Math.floor(x / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP + block.startBeat;
      const pitch = KEY_COUNT - Math.floor(y / PIXELS_PER_SEMITONE) - 1 + LOWEST_NOTE;
      
      // Calculate relative beat for the note
      const relativeBeat = absoluteBeat - block.startBeat;
      const blockDuration = block.endBeat - block.startBeat;

      // Ensure relative beat is within block boundaries [0, blockDuration)
      if (relativeBeat < 0 || relativeBeat >= blockDuration) return;
      
      // Ensure pitch is valid
      if (pitch < 0 || pitch > 127) return;
      
      // Create a new note with a unique ID and RELATIVE startBeat
      const newNote: MIDINote = {
        id: `note-${block.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        startBeat: relativeBeat,
        duration: 1, // Default to 1 beat
        velocity: 100, // Default velocity
        pitch
      };
      
      // Create updated block with new note
      const updatedBlock = { ...block };
      updatedBlock.notes = [...block.notes, newNote];
      
      // Update the block in the store
      updateMidiBlock(track.id, updatedBlock);
    };
  
    // Delete a note on right click
    const handleNoteRightClick = (e: React.MouseEvent, note: MIDINote) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Filter using note.id as it's the unique identifier
      const updatedBlock = { ...block };
      updatedBlock.notes = block.notes.filter(n => n.id !== note.id);
      
      // Update the block in the store
      updateMidiBlock(track.id, updatedBlock);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (dragOperation === 'none' || !dragNoteId || !notesContainerRef.current) {
        return;
      }
      
      const containerRect = notesContainerRef.current.getBoundingClientRect();
      
      // Find the note being edited using its ID
      const noteIndex = block.notes.findIndex(note => note.id === dragNoteId);
      
      if (noteIndex === -1) return;
      
      // Get current note
      const note = { ...block.notes[noteIndex] };
      const blockDuration = block.endBeat - block.startBeat; // Duration of the block

      // Update the note based on drag operation
      if (dragOperation === 'start') {
        // Calculate change based on delta
        const deltaX = e.clientX - dragStart.x;
        const beatChange = Math.round(deltaX / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;
        
        // Calculate new relative start beat
        const newRelativeStartBeat = dragStartBeat + beatChange;

        // Clamp the new relative start beat (0 to current end - min duration)
        const clampedNewRelativeStartBeat = Math.max(
          0,
          Math.min(dragStartBeat + note.duration - GRID_SNAP, newRelativeStartBeat)
        );

        // Update relative start beat and duration
        note.duration = (dragStartBeat + note.duration) - clampedNewRelativeStartBeat;
        note.startBeat = clampedNewRelativeStartBeat;

      } else if (dragOperation === 'end') {
        // For end resize, use delta from initial relative drag state
        const deltaX = e.clientX - dragStart.x;
        const beatChange = Math.round(deltaX / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;
        
        // Calculate new relative duration
        const newDuration = dragDuration + beatChange;
        
        // Ensure minimum duration and clamp within block boundaries
        note.duration = Math.min(blockDuration - note.startBeat, Math.max(GRID_SNAP, newDuration));

      } else if (dragOperation === 'move') {
        // For move, use absolute cursor position to find target absolute beat
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;
        
        // Adjust for the click offset within the note
        const adjustedMouseX = mouseX - clickOffset.x;
        const adjustedMouseY = mouseY - clickOffset.y;
        
        // Convert to absolute beat and pitch, snap to grid
        const targetAbsoluteBeat = Math.round((adjustedMouseX) / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP + block.startBeat;
        const pitch = KEY_COUNT - Math.round((adjustedMouseY) / PIXELS_PER_SEMITONE) - 1 + LOWEST_NOTE;
        
        // Calculate the new relative start beat
        const newRelativeStartBeat = targetAbsoluteBeat - block.startBeat;

        // Apply the position with constraints (relative to block: 0 to blockDuration - noteDuration)
        note.startBeat = Math.max(
          0, 
          Math.min(blockDuration - note.duration, newRelativeStartBeat)
        );
        note.pitch = Math.max(0, Math.min(127, pitch));
      }
      
      // Update the note in the block
      const updatedBlock = { ...block };
      updatedBlock.notes[noteIndex] = note;
      updateMidiBlock(track.id, updatedBlock);
    };
    
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [
    block, 
    track,
    dragOperation, 
    dragStart, 
    dragNoteId, 
    dragStartBeat, // Should be relative now 
    dragDuration, 
    updateMidiBlock,
    clickOffset
  ]);
  

  
  // Handle starting to drag a note
  const handleNoteMouseDown = (e: React.MouseEvent, note: MIDINote, operation: 'start' | 'end' | 'move') => {
    e.stopPropagation();
    setDragOperation(operation);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragNoteId(note.id);
    // Store the RELATIVE start beat
    setDragStartBeat(note.startBeat);
    setDragDuration(note.duration);
    
    if (operation === 'move' && notesContainerRef.current) {
      // Calculate offset from the note's top-left corner
      const containerRect = notesContainerRef.current.getBoundingClientRect();
      const noteX = note.startBeat * PIXELS_PER_BEAT;
      const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * PIXELS_PER_SEMITONE;
      
      const clickX = e.clientX - containerRect.left - noteX;
      const clickY = e.clientY - containerRect.top - noteY;
      
      setClickOffset({ x: clickX, y: clickY });
    }
  };
  

  
  // Delete a note on right click
  const handleNoteRightClick = (e: React.MouseEvent, note: MIDINote) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Filter using note.id as it's the unique identifier
    const updatedBlock = { ...block };
    updatedBlock.notes = block.notes.filter(n => n.id !== note.id);
    
    // Update the block in the store
    updateMidiBlock(track.id, updatedBlock);
  };

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
          
          {/* Notes area */}
          <div 
            ref={notesContainerRef}
            style={{ 
              position: 'relative',
              width: `${editorWidth}px`, 
              height: `${editorHeight}px`,
              backgroundColor: '#2a2a2a'
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Grid canvas */}
            <canvas
              ref={gridCanvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${editorWidth}px`,
                height: `${editorHeight}px`,
                pointerEvents: 'none'
              }}
            />
            
            {/* Render notes */}
            {block.notes.map(note => {
              // Calculate absolute start beat for rendering position
              const noteAbsoluteStartBeat = block.startBeat + note.startBeat;
              
              // Position calculation uses absolute start beat
              const noteX = (noteAbsoluteStartBeat - block.startBeat) * PIXELS_PER_BEAT;
              const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * PIXELS_PER_SEMITONE;
              const noteWidth = note.duration * PIXELS_PER_BEAT;
              
              return (
                <div 
                  key={note.id}
                  style={{
                    position: 'absolute',
                    left: `${noteX}px`,
                    top: `${noteY}px`,
                    width: `${noteWidth}px`,
                    height: `${PIXELS_PER_SEMITONE}px`,
                    backgroundColor: '#4a90e2',
                    borderRadius: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    cursor: 'move',
                    zIndex: 2
                  }}
                  onMouseDown={(e) => handleNoteMouseDown(e, note, 'move')}
                  onContextMenu={(e) => handleNoteRightClick(e, note)}
                >
                  {/* Left resize handle */}
                  <div 
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '5px',
                      height: '100%',
                      cursor: 'w-resize'
                    }}
                    onMouseDown={(e) => handleNoteMouseDown(e, note, 'start')}
                  />
                  
                  {/* Right resize handle */}
                  <div 
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: '5px',
                      height: '100%',
                      cursor: 'e-resize'
                    }}
                    onMouseDown={(e) => handleNoteMouseDown(e, note, 'end')}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MidiEditor; 