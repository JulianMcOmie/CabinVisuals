import { MIDIBlock, MIDINote } from '../../../lib/types';
import { 
  GRID_SNAP, 
  MINIMUM_NOTE_DURATION, 
  PASTE_OFFSET,
  BEATS_PER_MEASURE
} from './constants';
import { generateNoteId, isNoteInSelectionBox } from './utils';

/**
 * Creates a new MIDI note at the specified position
 */
export const createNewNote = (
  blockId: string,
  beatPosition: number,
  pitch: number,
  blockDuration: number
): MIDINote | null => {
  // Snap to grid
  const snappedBeat = Math.floor(beatPosition / GRID_SNAP) * GRID_SNAP;
  
  // Ensure values are in valid range
  if (snappedBeat < 0 || snappedBeat >= blockDuration || pitch < 0 || pitch > 127) {
    return null;
  }
  
  // Create a new note
  return {
    id: generateNoteId(),
    startBeat: snappedBeat,
    duration: 1, // Default to 1 beat
    velocity: 100,
    pitch
  };
};

/**
 * Creates a block with the selected notes removed
 */
export const deleteSelectedNotes = (
  block: MIDIBlock,
  selectedNoteIds: string[]
): MIDIBlock => {
  const updatedBlock = { ...block };
  updatedBlock.notes = block.notes.filter(note => !selectedNoteIds.includes(note.id));
  return updatedBlock;
};

/**
 * Makes a deep copy of the selected notes
 */
export const copyNotes = (
  notes: MIDINote[],
  selectedNoteIds: string[]
): MIDINote[] => {
  return notes
    .filter(note => selectedNoteIds.includes(note.id))
    .map(note => ({ ...note })); // Create a deep copy
};

/**
 * Creates duplicates of notes with option/alt drag
 */
export const duplicateNotes = (
  block: MIDIBlock,
  selectedNoteIds: string[]
): { notes: MIDINote[], ids: string[] } => {
  // Get the notes to be duplicated
  const notesToDuplicate = block.notes
    .filter(note => selectedNoteIds.includes(note.id))
    .map(note => ({ 
      ...note,
      id: generateNoteId()
    }));
  
  return {
    notes: notesToDuplicate,
    ids: notesToDuplicate.map(note => note.id)
  };
};

/**
 * Pastes copied notes with an offset
 */
export const pasteNotes = (
  block: MIDIBlock, 
  copiedNotes: MIDINote[], 
  offset: number = PASTE_OFFSET,
  currentBeat: number,
  numMeasures: number
): { updatedBlock: MIDIBlock, pastedNoteIds: string[] } => {
  if (copiedNotes.length === 0) {
    return { updatedBlock: block, pastedNoteIds: [] };
  }  
  // Find the leftmost position of copied notes to calculate relative positions
  const minBeat = Math.min(...copiedNotes.map(note => note.startBeat));
  
  // Create new notes with new IDs and offset positions
  const newNotes = copiedNotes.map(note => {
    // Calculate position relative to the leftmost note and add paste offset
    const relativePosition = note.startBeat - minBeat;
    //const newStartBeat = minBeat + relativePosition + offset;
    const newStartBeat = currentBeat + relativePosition;// + offset;

    // Ensure the note fits within the block
    if (newStartBeat + note.duration > numMeasures * BEATS_PER_MEASURE) {
      return null; // Skip notes that would extend beyond the block
    }
    
    return {
      ...note,
      id: generateNoteId(block.id),
      startBeat: newStartBeat
    };
  }).filter(note => note !== null) as MIDINote[];
  
  if (newNotes.length === 0) {
    return { updatedBlock: block, pastedNoteIds: [] };
  }
  
  // Add pasted notes to block
  const updatedBlock = { ...block };
  updatedBlock.notes = [...block.notes, ...newNotes];
  
  return { 
    updatedBlock, 
    pastedNoteIds: newNotes.map(note => note.id) 
  };
};

/**
 * Moves selected notes by the given delta
 */
export const moveSelectedNotes = (
  block: MIDIBlock,
  selectedNoteIds: string[],
  beatDelta: number,
  pitchDelta: number
): MIDIBlock => {
  // We might not need blockDuration here anymore if we remove clamping
  // const blockDuration = block.endBeat - block.startBeat;
  
  const updatedBlock = { ...block };
  updatedBlock.notes = block.notes.map(note => {
    if (selectedNoteIds.includes(note.id)) {
      const newStartBeat = note.startBeat + beatDelta;
      const newPitch = note.pitch + pitchDelta;
      
      // Keep pitch clamping, remove horizontal clamping
      return {
        ...note,
        // --- REMOVED CLAMPING --- 
        startBeat: newStartBeat, 
        // -----------------------
        pitch: Math.max(0, Math.min(127, newPitch))
      };
    }
    return note;
  });
  
  return updatedBlock;
};

/**
 * Resizes notes from their start edge
 */
export const resizeNotesFromStart = (
  block: MIDIBlock,
  noteIds: string[],
  deltaBeats: number,
  initialDragStates: Map<string, { startBeat: number, duration: number }>
): MIDIBlock => {
  const updatedBlock = { ...block };
  updatedBlock.notes = [...block.notes];
  
  for (const noteId of noteIds) {
    const initialState = initialDragStates.get(noteId);
    if (!initialState) continue;

    deltaBeats = Math.min(deltaBeats, initialState.duration - MINIMUM_NOTE_DURATION);
  }

  for (const noteId of noteIds) {
    const initialState = initialDragStates.get(noteId);
    if (!initialState) continue;
    
    const noteIndex = block.notes.findIndex(note => note.id === noteId);
    if (noteIndex === -1) continue;
    
    const note = { ...block.notes[noteIndex] };
    let newStartBeat = initialState.startBeat + deltaBeats;
    
    // Update note properties
    note.duration = note.duration - (newStartBeat - note.startBeat);
    note.startBeat = newStartBeat;
    
    updatedBlock.notes[noteIndex] = note;
  }
  
  return updatedBlock;
};

/**
 * Resizes notes from their end edge
 */
export const resizeNotesFromEnd = (
  block: MIDIBlock,
  noteIds: string[],
  deltaBeats: number,
  initialDragStates: Map<string, { startBeat: number, duration: number }>
): MIDIBlock => {
  const updatedBlock = { ...block };
  updatedBlock.notes = [...block.notes];
  
  for (const noteId of noteIds) {
    const initialState = initialDragStates.get(noteId);
    if (!initialState) continue;

    deltaBeats = Math.max(deltaBeats, -1 * initialState.duration + MINIMUM_NOTE_DURATION);
  }

  for (const noteId of noteIds) {
    const initialState = initialDragStates.get(noteId);
    if (!initialState) continue;
    
    const noteIndex = block.notes.findIndex(note => note.id === noteId);
    if (noteIndex === -1) continue;
    
    const note = { ...block.notes[noteIndex] };
    let newDuration = initialState.duration + deltaBeats;
    
    note.duration = newDuration;
    updatedBlock.notes[noteIndex] = note;
  }
  
  return updatedBlock;
};

/**
 * Toggles a note's selection state
 */
export const toggleNoteSelection = (
  block: MIDIBlock,
  noteId: string,
  currentSelectedIds: string[]
): { 
  selectedIds: string[], 
  selectedNotes: MIDINote[] 
} => {
  let newSelectedIds: string[];
  
  if (currentSelectedIds.includes(noteId)) {
    // Remove from selection
    newSelectedIds = currentSelectedIds.filter(id => id !== noteId);
  } else {
    // Add to selection
    newSelectedIds = [...currentSelectedIds, noteId];
  }
  
  // Get the notes corresponding to these IDs
  const selectedNotes = block.notes.filter(note => newSelectedIds.includes(note.id));
  
  return { selectedIds: newSelectedIds, selectedNotes };
};

/**
 * Updates selection based on the selection box
 */
export const processSelectionBoxNotes = (
  block: MIDIBlock,
  selectionBox: { startX: number, startY: number, endX: number, endY: number },
  currentSelectedIds: string[],
  addToSelection: boolean = false,
  pixelsPerBeat: number,
  pixelsPerSemitone: number
): {
  selectedIds: string[],
  selectedNotes: MIDINote[]
} => {
  // Find notes that intersect with the selection box
  const notesInSelection = block.notes.filter(note => 
    isNoteInSelectionBox(block.startBeat, note, selectionBox, pixelsPerBeat, pixelsPerSemitone)
  );
  
  let newSelectedIds: string[];
  
  if (addToSelection) {
    // Add to existing selection if shift is held
    newSelectedIds = [...new Set([...currentSelectedIds, ...notesInSelection.map(n => n.id)])];
  } else {
    // Replace selection
    newSelectedIds = notesInSelection.map(n => n.id);
  }
  
  // Get the notes corresponding to these IDs
  const selectedNotes = block.notes.filter(note => newSelectedIds.includes(note.id));
  
  return { selectedIds: newSelectedIds, selectedNotes };
}; 