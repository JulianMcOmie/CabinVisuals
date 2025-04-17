import { MIDIBlock, MIDINote } from '../../../lib/types';
import { 
  KEY_COUNT,
  LOWEST_NOTE 
} from './constants';
import { createNewNote, toggleNoteSelection, processSelectionBoxNotes } from './noteOperations';

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
  y: number,
  pixelsPerBeat: number,
  pixelsPerSemitone: number
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
  const noteX = note.startBeat * pixelsPerBeat;
  const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * pixelsPerSemitone;
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
 * Handles mouse up after drawing a selection box or creating a new note
 */
export const handleSelectionBoxComplete = (
  block: MIDIBlock,
  selectionBox: { startX: number, startY: number, endX: number, endY: number },
  selectedNoteIds: string[],
  isDragging: boolean,
  coords: { beat: number, pitch: number },
  pixelsPerBeat: number,
  pixelsPerSemitone: number
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
    const newNote = createNewNote(block.id, beat - block.startBeat, pitch, blockDuration);
    
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
    const selection = processSelectionBoxNotes(block, selectionBox, selectedNoteIds, addToExistingSelection, pixelsPerBeat, pixelsPerSemitone);
    
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