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
  note: MIDINote,
  selectionBox: { startX: number, startY: number, endX: number, endY: number }
): boolean => {
  // Get normalized selection box coordinates
  const left = Math.min(selectionBox.startX, selectionBox.endX);
  const right = Math.max(selectionBox.startX, selectionBox.endX);
  const top = Math.min(selectionBox.startY, selectionBox.endY);
  const bottom = Math.max(selectionBox.startY, selectionBox.endY);
  
  // Calculate note positions in pixels
  const noteLeft = note.startBeat * PIXELS_PER_BEAT;
  const noteRight = (note.startBeat + note.duration) * PIXELS_PER_BEAT;
  const noteTop = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * PIXELS_PER_SEMITONE;
  const noteBottom = noteTop + PIXELS_PER_SEMITONE;
  
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
  canvasRef: React.RefObject<HTMLCanvasElement | null>
): { x: number, y: number, beat: number, pitch: number } | null => {
  const canvas = canvasRef.current;
  if (!canvas) return null;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Calculate beat and pitch
  const beat = (x / PIXELS_PER_BEAT);
  const pitch = KEY_COUNT - Math.floor(y / PIXELS_PER_SEMITONE) - 1 + LOWEST_NOTE;
  
  return { x, y, beat, pitch };
};

/**
 * Finds a note at the given coordinates and determines which part of the note was clicked
 */
export const findNoteAt = (
  x: number, 
  y: number, 
  notes: MIDINote[], 
  selectedNoteIds: string[]
): { note: MIDINote, area: 'start' | 'end' | 'body' } | null => {
  // First check if any selected note was clicked (prioritize selected notes)
  if (selectedNoteIds.length > 0) {
    for (const noteId of selectedNoteIds) {
      const note = notes.find(n => n.id === noteId);
      if (!note) continue;
      
      const noteX = note.startBeat * PIXELS_PER_BEAT;
      const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * PIXELS_PER_SEMITONE;
      const noteWidth = note.duration * PIXELS_PER_BEAT;
      const noteHeight = PIXELS_PER_SEMITONE;
      
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
    const noteX = note.startBeat * PIXELS_PER_BEAT;
    const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * PIXELS_PER_SEMITONE;
    const noteWidth = note.duration * PIXELS_PER_BEAT;
    const noteHeight = PIXELS_PER_SEMITONE;
    
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