import { MIDIBlock, MIDINote } from '../../../lib/types';
import { 
  PIXELS_PER_BEAT,
  PIXELS_PER_SEMITONE,
  GRID_SNAP,
  KEY_COUNT,
  LOWEST_NOTE 
} from './constants';
import { duplicateNotes, moveSelectedNotes, resizeNoteFromStart, resizeNoteFromEnd } from './noteOperations';

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