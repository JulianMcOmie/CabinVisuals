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
  // First check if any selected note was clicked (prioritize selected notes)
  if (selectedNoteIds.length > 0) {
    for (const noteId of selectedNoteIds) {
      const note = notes.find(n => n.id === noteId);
      if (!note) continue;
      
      const noteX = (blockStartBeat + note.startBeat - 1) * pixelsPerBeat;
      const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * pixelsPerSemitone;
      const noteWidth = note.duration * pixelsPerBeat;
      const noteHeight = pixelsPerSemitone;
      
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
  for (const note of notes) {
    const noteX = (blockStartBeat + note.startBeat) * pixelsPerBeat;
    const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * pixelsPerSemitone;
    const noteWidth = note.duration * pixelsPerBeat;
    const noteHeight = pixelsPerSemitone;
    
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