import { MIDINote } from '../../../lib/types';
import {
  PIXELS_PER_BEAT,
  PIXELS_PER_SEMITONE,
  KEY_COUNT,
  LOWEST_NOTE,
  RESIZE_HANDLE_WIDTH
} from './constants';

/**
 * Checks if a note is within the boundaries of a selection box
 */
export const isNoteInSelectionBox = (
  blockStartBeat: number,
  note: MIDINote,
  selectionBox: { startX: number, startY: number, endX: number, endY: number },
  pixelsPerBeat: number,
  pixelsPerSemitone: number
): boolean => {
  // Get normalized selection box coordinates
  const left = Math.min(selectionBox.startX, selectionBox.endX);
  const right = Math.max(selectionBox.startX, selectionBox.endX);
  const top = Math.min(selectionBox.startY, selectionBox.endY);
  const bottom = Math.max(selectionBox.startY, selectionBox.endY);
  
  // Calculate note positions in pixels
  const noteLeft = (blockStartBeat + note.startBeat) * pixelsPerBeat;
  const noteRight = (blockStartBeat + note.startBeat + note.duration) * pixelsPerBeat;
  const noteTop = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * pixelsPerSemitone;
  const noteBottom = noteTop + pixelsPerSemitone;
  
  // Check if the note intersects with the selection box
  return !(
    noteRight < left ||
    noteLeft > right ||
    noteBottom < top ||
    noteTop > bottom
  );
};

/**
 * Generates a unique ID for a new note
 */
export const generateNoteId = (blockId?: string): string => {
  return Math.random().toString(36).substring(2, 15);
};

/**
 * Converts mouse event coordinates to canvas coordinates and beat/pitch values
 */
export const getCoordsFromEvent = (
  e: MouseEvent | React.MouseEvent,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  pixelsPerBeat: number,
  pixelsPerSemitone: number
): { x: number, y: number, beat: number, pitch: number } | null => {
  const canvas = canvasRef.current;
  if (!canvas) return null;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Calculate beat and pitch
  const beat = (x / pixelsPerBeat);
  const pitch = KEY_COUNT - Math.floor(y / pixelsPerSemitone) - 1 + LOWEST_NOTE;
  
  // --- DEBUG LOG --- 
  console.log(`[getCoordsFromEvent] clientX: ${e.clientX}, clientY: ${e.clientY}, rectLeft: ${rect.left}, rectTop: ${rect.top} => Calculated x: ${x}, y: ${y}, beat: ${beat.toFixed(2)}`);
  // --- END DEBUG LOG --- 

  return { x, y, beat, pitch };
};

/**
 * Finds a note at the given coordinates and determines which part of the note was clicked
 */
export const findNoteAt = (
  x: number, 
  y: number, 
  notes: MIDINote[], 
  selectedNoteIds: string[],
  pixelsPerBeat: number,
  pixelsPerSemitone: number,
  blockStartBeat: number,
  blockDuration: number
): { note: MIDINote, area: 'start' | 'end' | 'body' } | null => {
  // --- NEW DEBUG LOG --- 
  console.log(`[findNoteAt] Received blockStartBeat: ${blockStartBeat}`);
  // --- END NEW DEBUG LOG --- 

  // --- DEBUG LOG --- 
  console.log(`[findNoteAt] Checking coords x=${x.toFixed(2)}, y=${y.toFixed(2)}`);
  // --- END DEBUG LOG --- 

  // Helper function to check a single note (to avoid code duplication)
  const checkNote = (note: MIDINote) => {
    const noteX = (blockStartBeat + note.startBeat) * pixelsPerBeat;
    const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * pixelsPerSemitone;
    const noteWidth = note.duration * pixelsPerBeat;
    const noteHeight = pixelsPerSemitone;
    const noteEndX = noteX + noteWidth;

    // --- DEBUG LOG --- 
    console.log(`[findNoteAt] Checking note ${note.id} (beat ${note.startBeat}) at drawing bounds: x[${noteX.toFixed(2)} - ${noteEndX.toFixed(2)}] (Using note.startBeat directly)`);
    // --- END DEBUG LOG --- 

    if (
      x >= noteX && 
      x <= noteEndX && 
      y >= noteY && 
      y <= noteY + noteHeight
    ) {
      // --- DEBUG LOG --- 
      console.log(`[findNoteAt] HIT note ${note.id}! Checking area...`);
      console.log(`           Handle width: ${RESIZE_HANDLE_WIDTH}`);
      console.log(`           Start check: x (${x.toFixed(2)}) <= noteX (${noteX.toFixed(2)}) + handleWidth (${RESIZE_HANDLE_WIDTH}) => ${x <= noteX + RESIZE_HANDLE_WIDTH}`);
      console.log(`           End check:   x (${x.toFixed(2)}) >= noteEndX (${noteEndX.toFixed(2)}) - handleWidth (${RESIZE_HANDLE_WIDTH}) => ${x >= noteEndX - RESIZE_HANDLE_WIDTH}`);
      // --- END DEBUG LOG --- 
      if (x <= noteX + RESIZE_HANDLE_WIDTH) {
        console.log(`[findNoteAt] Area: START`); // Log final decision
        return { note, area: 'start' as const };
      } else if (x >= noteEndX - RESIZE_HANDLE_WIDTH) {
        console.log(`[findNoteAt] Area: END`); // Log final decision
        return { note, area: 'end' as const };
      } else {
        console.log(`[findNoteAt] Area: BODY`); // Log final decision
        return { note, area: 'body' as const };
      }
    } else {
        // --- DEBUG LOG --- 
        // Only log misses if you expect few notes, otherwise it's too noisy
        // console.log(`[findNoteAt] MISS note ${note.id}`);
        // --- END DEBUG LOG --- 
    }
    return null; // No hit for this note
  };

  // First check if any selected note was clicked (prioritize selected notes)
  if (selectedNoteIds.length > 0) {
    for (const noteId of selectedNoteIds) {
      const note = notes.find(n => n.id === noteId);
      if (!note) continue;
      const result = checkNote(note);
      if (result) return result; // Return immediately if selected note hit
    }
  }
  
  // If no selected note was clicked, check all notes
  for (const note of notes) {
    // Skip checking if this note was already checked (because it was selected)
    if (selectedNoteIds.includes(note.id)) continue;
    const result = checkNote(note);
    if (result) return result; // Return immediately if any note hit
  }
  
  // --- DEBUG LOG --- 
  console.log(`[findNoteAt] No note found at x=${x.toFixed(2)}, y=${y.toFixed(2)}`);
  // --- END DEBUG LOG --- 
  return null;
}; 