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
  
  // State for note operations
  const [dragOperation, setDragOperation] = useState<'none' | 'start' | 'end' | 'move'>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartBeat, setDragStartBeat] = useState(0);
  const [dragDuration, setDragDuration] = useState(0);
  const [dragNoteId, setDragNoteId] = useState<string | null>(null);

  // Handle mouse events for note operations
  useEffect(() => {
    const handleMouseUp = () => {
      setDragNoteId(null);
      setDragOperation('none');
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
        
        // Convert to absolute beat and pitch, snap to grid
        const targetAbsoluteBeat = Math.round(mouseX / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP + block.startBeat;
        const pitch = KEY_COUNT - Math.round(mouseY / PIXELS_PER_SEMITONE) - 1 + LOWEST_NOTE;
        
        // Calculate offset from where the drag started (using relative start beat)
        const dragStartAbsoluteBeat = block.startBeat + dragStartBeat; 
        const targetStartAbsoluteBeat = targetAbsoluteBeat; // In this new model, target == where mouse is

        // Calculate the new relative start beat
        const newRelativeStartBeat = targetStartAbsoluteBeat - block.startBeat;

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
    updateMidiBlock
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
  };
  
  // Add a new note on click
  const handleCanvasClick = (e: React.MouseEvent) => {
    // Don't create a note if we just finished dragging
    if (dragNoteId || !notesContainerRef.current) 
    {
        setDragNoteId(null);
        return;
    }
    
    const containerRect = notesContainerRef.current.getBoundingClientRect();
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

  // Calculate dimensions based on block and key count
  const blockDuration = block.endBeat - block.startBeat;
  const editorWidth = blockDuration * PIXELS_PER_BEAT;
  const editorHeight = KEY_COUNT * PIXELS_PER_SEMITONE;

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
            onClick={handleCanvasClick}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Grid lines */}
            {/* Horizontal lines (pitch) */}
            {Array.from({ length: KEY_COUNT + 1 }).map((_, i) => (
              <div key={`h-${i}`} style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${i * PIXELS_PER_SEMITONE}px`,
                height: '1px',
                backgroundColor: i % 12 === 0 ? '#666' : '#333' // Highlight octaves
              }} />
            ))}
            
            {/* Vertical lines (beats) */}
            {Array.from({ length: Math.ceil(blockDuration / GRID_SNAP) + 1 }).map((_, i) => (
              <div key={`v-${i}`} style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${i * GRID_SNAP * PIXELS_PER_BEAT}px`,
                width: '1px',
                backgroundColor: 
                  i % (4/GRID_SNAP) === 0 ? '#666' :  // Measure lines
                  i % (1/GRID_SNAP) === 0 ? '#444' :  // Beat lines
                  '#333'                              // Grid lines
              }} />
            ))}
            
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