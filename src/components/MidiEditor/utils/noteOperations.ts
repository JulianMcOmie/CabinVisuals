import { MIDIBlock, MIDINote } from '../../../lib/types';
import { 
  GRID_SNAP, 
  PASTE_OFFSET,
  PIXELS_PER_BEAT,
  PIXELS_PER_SEMITONE,
  KEY_COUNT,
  LOWEST_NOTE 
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
    id: generateNoteId(blockId),
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
      id: generateNoteId(block.id)
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
  offset: number = PASTE_OFFSET
): { updatedBlock: MIDIBlock, pastedNoteIds: string[] } => {
  if (copiedNotes.length === 0) {
    return { updatedBlock: block, pastedNoteIds: [] };
  }
  
  const blockDuration = block.endBeat - block.startBeat;
  
  // Find the leftmost position of copied notes to calculate relative positions
  const minBeat = Math.min(...copiedNotes.map(note => note.startBeat));
  
  // Create new notes with new IDs and offset positions
  const newNotes = copiedNotes.map(note => {
    // Calculate position relative to the leftmost note and add paste offset
    const relativePosition = note.startBeat - minBeat;
    const newStartBeat = minBeat + relativePosition + offset;
    
    // Ensure the note fits within the block
    if (newStartBeat + note.duration > blockDuration) {
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
  const blockDuration = block.endBeat - block.startBeat;
  
  const updatedBlock = { ...block };
  updatedBlock.notes = block.notes.map(note => {
    if (selectedNoteIds.includes(note.id)) {
      const newStartBeat = note.startBeat + beatDelta;
      const newPitch = note.pitch + pitchDelta;
      
      // Clamp values to valid ranges
      return {
        ...note,
        startBeat: Math.max(0, Math.min(blockDuration - note.duration, newStartBeat)),
        pitch: Math.max(0, Math.min(127, newPitch))
      };
    }
    return note;
  });
  
  return updatedBlock;
};

/**
 * Resizes a note from its start edge
 */
export const resizeNoteFromStart = (
  block: MIDIBlock,
  noteId: string,
  deltaBeats: number,
  dragStartBeat: number
): MIDIBlock => {
  const noteIndex = block.notes.findIndex(note => note.id === noteId);
  if (noteIndex === -1) return block;
  
  const note = { ...block.notes[noteIndex] };
  let newStartBeat = dragStartBeat + deltaBeats;
  
  // Clamp to valid range
  newStartBeat = Math.max(0, Math.min(note.startBeat + note.duration - GRID_SNAP, newStartBeat));
  
  // Update note properties
  note.duration = note.duration - (newStartBeat - note.startBeat);
  note.startBeat = newStartBeat;
  
  // Create new block with updated note
  const updatedBlock = { ...block };
  updatedBlock.notes = [...block.notes];
  updatedBlock.notes[noteIndex] = note;
  
  return updatedBlock;
};

/**
 * Resizes a note from its end edge
 */
export const resizeNoteFromEnd = (
  block: MIDIBlock,
  noteId: string,
  deltaBeats: number,
  dragDuration: number
): MIDIBlock => {
  const noteIndex = block.notes.findIndex(note => note.id === noteId);
  if (noteIndex === -1) return block;
  
  const note = { ...block.notes[noteIndex] };
  const blockDuration = block.endBeat - block.startBeat;
  let newDuration = dragDuration + deltaBeats;
  
  // Clamp to valid range
  newDuration = Math.max(GRID_SNAP, Math.min(blockDuration - note.startBeat, newDuration));
  note.duration = newDuration;
  
  // Create new block with updated note
  const updatedBlock = { ...block };
  updatedBlock.notes = [...block.notes];
  updatedBlock.notes[noteIndex] = note;
  
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
  addToSelection: boolean = false
): {
  selectedIds: string[],
  selectedNotes: MIDINote[]
} => {
  // Find notes that intersect with the selection box
  const notesInSelection = block.notes.filter(note => 
    isNoteInSelectionBox(note, selectionBox)
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

/**
 * Handles note click for selection and drag setup
 */
export const handleNoteClick = (
  block: MIDIBlock,
  note: MIDINote,
  area: 'start' | 'end' | 'body',
  selectedNoteIds: string[],
  shiftKey: boolean,
  x: number,
  y: number
): {
  selectedIds: string[],
  selectedNotes: MIDINote[],
  dragOperation: 'start' | 'end' | 'move',
  cursorType: 'w-resize' | 'e-resize' | 'move',
  clickOffset: { x: number, y: number }
} => {
  let newSelectedIds: string[];
  let selectedNotes: MIDINote[];
  
  // Handle selection behavior
  if (!shiftKey && !selectedNoteIds.includes(note.id)) {
    // If not holding shift and note is not already selected, select only this note
    newSelectedIds = [note.id];
    selectedNotes = [note];
  } else if (shiftKey) {
    // If holding shift, toggle this note's selection
    const selection = toggleNoteSelection(block, note.id, selectedNoteIds);
    newSelectedIds = selection.selectedIds;
    selectedNotes = selection.selectedNotes;
  } else {
    // Note is already selected, keep current selection
    newSelectedIds = selectedNoteIds;
    selectedNotes = block.notes.filter(n => selectedNoteIds.includes(n.id));
  }
  
  // Set drag operation and cursor type based on clicked area
  let dragOperation: 'start' | 'end' | 'move';
  let cursorType: 'w-resize' | 'e-resize' | 'move';
  
  if (area === 'start') {
    dragOperation = 'start';
    cursorType = 'w-resize';
  } else if (area === 'end') {
    dragOperation = 'end';
    cursorType = 'e-resize';
  } else {
    dragOperation = 'move';
    cursorType = 'move';
  }
  
  // Calculate click offset within the note for smooth dragging (only needed for move operation)
  const noteX = note.startBeat * PIXELS_PER_BEAT;
  const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * PIXELS_PER_SEMITONE;
  const clickOffset = { x: x - noteX, y: y - noteY };
  
  return {
    selectedIds: newSelectedIds,
    selectedNotes,
    dragOperation,
    cursorType,
    clickOffset
  };
};

/**
 * Handles duplication of notes when Option/Alt key is pressed during drag
 */
export const handleOptionDrag = (
  block: MIDIBlock,
  selectedNoteIds: string[],
  dragNoteId: string
): {
  updatedBlock: MIDIBlock,
  newSelectedIds: string[],
  newDragNoteId: string,
  notesToSelect: MIDINote[]
} => {
  // Duplicate the selected notes
  const { notes: notesToDuplicate, ids: newNoteIds } = duplicateNotes(block, selectedNoteIds);
  
  // Create duplicate notes and add them to the block
  const updatedBlock = { ...block };
  updatedBlock.notes = [...block.notes, ...notesToDuplicate];
  
  // Update the drag note ID to the duplicated version of the originally clicked note
  const originalNoteIndex = block.notes.findIndex(note => note.id === dragNoteId);
  const newDragNoteId = originalNoteIndex !== -1 
    ? notesToDuplicate[newNoteIds.indexOf(notesToDuplicate[originalNoteIndex].id)].id
    : dragNoteId;
    
  return {
    updatedBlock,
    newSelectedIds: newNoteIds,
    newDragNoteId,
    notesToSelect: notesToDuplicate
  };
};

/**
 * Handles drag movement for different types of operations (move, resize start, resize end)
 */
export const handleDragMove = (
  block: MIDIBlock,
  dragOperation: 'move' | 'start' | 'end',
  dragNoteId: string,
  selectedNoteIds: string[],
  coords: { x: number, y: number },
  clickOffset: { x: number, y: number },
  dragStart: { x: number, y: number },
  dragStartBeat: number,
  dragDuration: number
): MIDIBlock => {
  if (dragOperation === 'move' && selectedNoteIds.length > 0) {
    // Get the primary note being dragged
    const primaryNoteIndex = block.notes.findIndex(note => note.id === dragNoteId);
    if (primaryNoteIndex === -1) return block;
    
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
    if (beatDelta === 0 && pitchDelta === 0) return block;
    
    // Move selected notes
    return moveSelectedNotes(block, selectedNoteIds, beatDelta, pitchDelta);
  } else if (dragOperation === 'start' && dragNoteId) {
    // Resize note from its start edge
    const dx = coords.x - dragStart.x;
    const deltaBeats = Math.round(dx / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;
    
    return resizeNoteFromStart(block, dragNoteId, deltaBeats, dragStartBeat);
  } else if (dragOperation === 'end' && dragNoteId) {
    // Resize note from its end edge
    const dx = coords.x - dragStart.x;
    const deltaBeats = Math.round(dx / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;
    
    return resizeNoteFromEnd(block, dragNoteId, deltaBeats, dragDuration);
  }
  
  return block;
};

/**
 * Determines if the mouse has moved enough to be considered a drag
 */
export const isDragThresholdMet = (
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  threshold: number = 5
): boolean => {
  const dx = currentX - startX;
  const dy = currentY - startY;
  return Math.sqrt(dx * dx + dy * dy) > threshold;
};

/**
 * Handles mouse up after drawing a selection box or creating a new note
 */
export const handleSelectionBoxComplete = (
  block: MIDIBlock,
  selectionBox: { startX: number, startY: number, endX: number, endY: number },
  selectedNoteIds: string[],
  isDragging: boolean,
  coords: { beat: number, pitch: number }
): {
  action: 'create-note' | 'selection',
  newNote?: MIDINote,
  selectedIds: string[],
  selectedNotes: MIDINote[]
} => {
  // Check if selection box is very small (basically a click)
  const boxWidth = Math.abs(selectionBox.endX - selectionBox.startX);
  const boxHeight = Math.abs(selectionBox.endY - selectionBox.startY);
  
  if (boxWidth < 5 && boxHeight < 5 && !isDragging) {
    // Treat as a click for note creation
    const { beat, pitch } = coords;
    
    // Create a new note
    const blockDuration = block.endBeat - block.startBeat;
    const newNote = createNewNote(block.id, beat, pitch, blockDuration);
    
    if (newNote) {
      return {
        action: 'create-note',
        newNote,
        selectedIds: [newNote.id],
        selectedNotes: [newNote]
      };
    }
    
    return {
      action: 'selection',
      selectedIds: [],
      selectedNotes: []
    };
  } else {
    // Process notes inside selection box with shift key state
    const addToExistingSelection = selectedNoteIds.length > 0;
    const selection = processSelectionBoxNotes(block, selectionBox, selectedNoteIds, addToExistingSelection);
    
    return {
      action: 'selection',
      selectedIds: selection.selectedIds,
      selectedNotes: selection.selectedNotes
    };
  }
};

/**
 * Handles context menu (right-click) on notes to delete them
 */
export const handleContextMenuOnNote = (
  block: MIDIBlock,
  noteId: string
): MIDIBlock => {
  const updatedBlock = { ...block };
  updatedBlock.notes = block.notes.filter(note => note.id !== noteId);
  return updatedBlock;
}; 