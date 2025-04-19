import { MIDIBlock, MIDINote } from '../../../lib/types';
import { 
  GRID_SNAP,
  KEY_COUNT,
  LOWEST_NOTE,
  PIXELS_PER_BEAT,
  PIXELS_PER_SEMITONE
} from './constants';
import { duplicateNotes, moveSelectedNotes, resizeNotesFromStart, resizeNotesFromEnd } from './noteOperations';

/**
 * Handles duplication of notes when Option/Alt key is pressed during drag
 */
export const handleOptionDrag = (
  block: MIDIBlock,
  selectedNoteIds: string[],
  dragNoteId: string | null // Allow null for safety
): {
  updatedBlock: MIDIBlock,
  newSelectedIds: string[],
  newDragNoteId: string | null, // Allow null
  notesToSelect: MIDINote[]
} => {
  if (!dragNoteId) {
    // Safety check: Should not happen if called correctly, but handle gracefully
    console.error("handleOptionDrag called with null dragNoteId");
    return { updatedBlock: block, newSelectedIds: [], newDragNoteId: null, notesToSelect: [] };
  }

  // Duplicate the selected notes. Assuming duplicateNotes returns the new notes and their IDs.
  const { notes: notesToDuplicate, ids: newNoteIds } = duplicateNotes(block, selectedNoteIds);

  // Create the updated block with original + duplicated notes
  const updatedBlock = { 
      ...block, 
      notes: [...block.notes, ...notesToDuplicate] 
  };

  // --- FIX: Find the new ID corresponding to the original dragNoteId --- 
  let newDragNoteId: string | null = null;
  // Find the index of the original dragNoteId within the selectedNoteIds array
  const originalSelectedIndex = selectedNoteIds.indexOf(dragNoteId);

  if (originalSelectedIndex !== -1 && originalSelectedIndex < newNoteIds.length) {
    // If found and the index is valid for the new IDs array, use the corresponding new ID
    newDragNoteId = newNoteIds[originalSelectedIndex];
  } else {
    // Fallback or error case: Couldn't map the original drag ID to a new one.
    // This might happen if dragNoteId wasn't actually in selectedNoteIds.
    // Defaulting to null or the first new ID might be options, but null is safer.
    console.warn(`Could not map original dragNoteId (${dragNoteId}) to a new ID during duplication.`);
    // Optionally, just pick the first new note ID if available?
    // newDragNoteId = newNoteIds.length > 0 ? newNoteIds[0] : null;
  }
  // ------------------------------------------------------------------
    
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
  initialDragStates: Map<string, { startBeat: number, duration: number }>,
  pixelsPerBeat: number,
  pixelsPerSemitone: number
): MIDIBlock => {
  // Get the primary note being dragged
  const primaryNoteIndex = block.notes.findIndex(note => note.id === dragNoteId);
  if (primaryNoteIndex === -1) return block;
  const primaryNote = block.notes[primaryNoteIndex];
  if (dragOperation === 'move' && selectedNoteIds.length > 0) {
    const { x, y } = coords;
    
    // Calculate the target position for the primary note
    const targetX = x - clickOffset.x;
    const targetY = y - clickOffset.y;
    
    // Convert to beat and pitch, with snapping
    const targetBeat = Math.round(targetX / pixelsPerBeat / GRID_SNAP) * GRID_SNAP;
    const targetPitch = KEY_COUNT - Math.floor(targetY / pixelsPerSemitone) - 1 + LOWEST_NOTE;
    
    // Calculate the delta from primary note's original position
    const beatDelta = targetBeat - primaryNote.startBeat;
    const pitchDelta = targetPitch - primaryNote.pitch;
    
    // Skip if no change
    if (beatDelta === 0 && pitchDelta === 0) return block;
    
    // Move selected notes
    return moveSelectedNotes(block, selectedNoteIds, beatDelta, pitchDelta);
  } else if (dragOperation === 'start' && dragNoteId) {
    const updatedBlock = { ...block };
    updatedBlock.notes = [...block.notes];

    // Resize note from its start edge
    const dx = coords.x - dragStart.x;
    const deltaBeats = Math.round(dx / pixelsPerBeat / GRID_SNAP) * GRID_SNAP;
    
    return resizeNotesFromStart(block, selectedNoteIds, deltaBeats, initialDragStates);
  } else if (dragOperation === 'end' && dragNoteId) {
    const updatedBlock = { ...block };
    updatedBlock.notes = [...block.notes];

    // Resize note from its end edge
    const dx = coords.x - dragStart.x;
    let deltaBeats = Math.round(dx / pixelsPerBeat / GRID_SNAP) * GRID_SNAP;
    
    return resizeNotesFromEnd(block, selectedNoteIds, deltaBeats, initialDragStates);
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