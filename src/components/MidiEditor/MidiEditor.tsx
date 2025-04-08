'use client';

import React, { useState, useRef, useEffect } from 'react';
import useStore from '../../store/store';
import { MIDIBlock, MIDINote } from '../../lib/types';
import PianoRollHeader from './PianoRollHeader';
import PianoKeys from './PianoKeys';

interface MidiEditorProps {
  selectedBlockId: string;
}

// Constants
const PIXELS_PER_BEAT = 50; // Greater detail than timeline view
const PIXELS_PER_SEMITONE = 16; // Height of each piano key
const GRID_SNAP = 0.25; // Snap to 1/4 beat
const KEY_COUNT = 88; // 88 piano keys (A0 to C8)
const LOWEST_NOTE = 21; // A0 MIDI note number

const MidiEditor: React.FC<MidiEditorProps> = ({ selectedBlockId }) => {
  const { trackManager, updateMidiBlock } = useStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  
  // Find the selected block and its parent track
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [selectedBlock, setSelectedBlock] = useState<MIDIBlock | null>(null);
  
  // State for note operations
  const [dragOperation, setDragOperation] = useState<'none' | 'start' | 'end' | 'move'>('none');
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartBeat, setDragStartBeat] = useState(0);
  const [dragDuration, setDragDuration] = useState(0);
  const [dragNoteId, setDragNoteId] = useState<string | null>(null);
  
  // Find the selected block and its parent track
  useEffect(() => {
    if (!selectedBlockId) return;
    
    const tracks = trackManager.getTracks();
    for (const track of tracks) {
      const block = track.midiBlocks.find(block => block.id === selectedBlockId);
      if (block) {
        setSelectedTrack(track);
        setSelectedBlock(block);
        return;
      }
    }
    
    // Reset if block not found
    setSelectedTrack(null);
    setSelectedBlock(null);
  }, [selectedBlockId, trackManager]);
  
  // Handle mouse events for note operations
  useEffect(() => {
    if (!selectedBlock || !selectedTrack) return;
    
    const handleMouseUp = () => {
      setDragOperation('none');
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (dragOperation === 'none' || !dragNoteId || !notesContainerRef.current) return;
      
      const containerRect = notesContainerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      
      // Calculate beat and pitch changes
      const beatChange = Math.round(deltaX / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;
      const pitchChange = Math.round(deltaY / PIXELS_PER_SEMITONE) * -1; // Invert Y direction
      
      // Create updated block with modified note
      const updatedBlock = { ...selectedBlock };
      
      // Find the note being edited
      const noteIndex = updatedBlock.notes.findIndex(note => 
        `note-${updatedBlock.id}-${note.startBeat}-${note.pitch}` === dragNoteId
      );
      
      if (noteIndex === -1) return;
      
      // Create a copy of the notes array
      updatedBlock.notes = [...updatedBlock.notes];
      
      // Get current note
      const note = { ...updatedBlock.notes[noteIndex] };
      
      // Update the note based on drag operation
      if (dragOperation === 'start') {
        // Resize start (don't move beyond end)
        const newStartBeat = Math.max(
          selectedBlock.startBeat,
          Math.min(dragStartBeat + note.duration - GRID_SNAP, dragStartBeat + beatChange)
        );
        note.duration = note.startBeat + note.duration - newStartBeat;
        note.startBeat = newStartBeat;
      } else if (dragOperation === 'end') {
        // Resize end (ensure minimum duration)
        note.duration = Math.max(GRID_SNAP, dragDuration + beatChange);
      } else if (dragOperation === 'move') {
        // Move note (constrain within block boundaries)
        note.startBeat = Math.max(
          selectedBlock.startBeat,
          Math.min(selectedBlock.endBeat - note.duration, dragStartBeat + beatChange)
        );
        note.pitch = Math.max(0, Math.min(127, note.pitch + pitchChange));
      }
      
      // Update the note in the block
      updatedBlock.notes[noteIndex] = note;
      
      // Update the block in the store
      updateMidiBlock(selectedTrack.id, updatedBlock);
    };
    
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [
    selectedBlock, 
    selectedTrack, 
    dragOperation, 
    dragStartX, 
    dragStartY, 
    dragNoteId, 
    dragStartBeat, 
    dragDuration, 
    updateMidiBlock
  ]);
  
  // Get the ID for a note (used for drag operations)
  const getNoteId = (note: MIDINote): string => {
    return `note-${selectedBlock?.id}-${note.startBeat}-${note.pitch}`;
  };
  
  // Handle starting to drag a note
  const handleNoteMouseDown = (e: React.MouseEvent, note: MIDINote, operation: 'start' | 'end' | 'move') => {
    e.stopPropagation();
    setDragOperation(operation);
    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
    setDragNoteId(getNoteId(note));
    setDragStartBeat(note.startBeat);
    setDragDuration(note.duration);
  };
  
  // Add a new note on click
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!selectedBlock || !selectedTrack || !notesContainerRef.current) return;
    
    const containerRect = notesContainerRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;
    
    // Convert to beat and pitch
    const beat = Math.floor(x / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP + selectedBlock.startBeat;
    const pitch = KEY_COUNT - Math.floor(y / PIXELS_PER_SEMITONE) - 1 + LOWEST_NOTE;
    
    // Ensure beat is within block boundaries
    if (beat < selectedBlock.startBeat || beat >= selectedBlock.endBeat) return;
    
    // Ensure pitch is valid
    if (pitch < 0 || pitch > 127) return;
    
    // Create a new note
    const newNote: MIDINote = {
      startBeat: beat,
      duration: 1, // Default to 1 beat
      velocity: 100, // Default velocity
      pitch
    };
    
    // Create updated block with new note
    const updatedBlock = { ...selectedBlock };
    updatedBlock.notes = [...updatedBlock.notes, newNote];
    
    // Update the block in the store
    updateMidiBlock(selectedTrack.id, updatedBlock);
  };
  
  // Delete a note on right click
  const handleNoteRightClick = (e: React.MouseEvent, note: MIDINote) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedBlock || !selectedTrack) return;
    
    // Create updated block without the note
    const updatedBlock = { ...selectedBlock };
    updatedBlock.notes = selectedBlock.notes.filter(n => 
      n.startBeat !== note.startBeat || n.pitch !== note.pitch
    );
    
    // Update the block in the store
    updateMidiBlock(selectedTrack.id, updatedBlock);
  };

  // If no block is selected, show a message
  if (!selectedBlock || !selectedTrack) {
    return (
      <div className="midi-editor" style={{ padding: '20px' }}>
        <p>Select a MIDI block to edit</p>
      </div>
    );
  }

  // Calculate dimensions based on block and key count
  const blockDuration = selectedBlock.endBeat - selectedBlock.startBeat;
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
        MIDI Editor - {selectedTrack.name} - Block {selectedBlock.startBeat} to {selectedBlock.endBeat}
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
              startBeat={selectedBlock.startBeat} 
              endBeat={selectedBlock.endBeat} 
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
            {selectedBlock.notes.map(note => {
              const noteX = (note.startBeat - selectedBlock.startBeat) * PIXELS_PER_BEAT;
              const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * PIXELS_PER_SEMITONE;
              const noteWidth = note.duration * PIXELS_PER_BEAT;
              
              return (
                <div 
                  key={getNoteId(note)}
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
};

export default MidiEditor; 