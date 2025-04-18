import { MIDINote } from '../../../lib/types';
import {
  KEY_COUNT,
  LOWEST_NOTE,
  NOTE_COLOR,
  SELECTED_NOTE_COLOR,
  SELECTION_BOX_COLOR,
  SELECTION_BOX_BORDER_COLOR,
  GRID_SNAP,
  SelectionBox
} from './constants';

/**
 * Renders the entire MIDI editor canvas, including grid, notes, and selection box
 */
export const drawMidiEditor = (
  ctx: CanvasRenderingContext2D,
  notes: MIDINote[],
  selectedNoteIds: string[],
  editorWidth: number,
  editorHeight: number,
  blockWidth: number,
  blockHeight: number,
  blockDuration: number,
  blockStartBeat: number,
  selectionBox: SelectionBox,
  isDragging: boolean,
  pixelsPerBeat: number,
  pixelsPerSemitone: number
): void => {
  ctx.clearRect(0, 0, editorWidth, editorHeight);
  
  // Draw grid
  drawGrid(ctx, editorWidth, editorHeight, blockDuration, pixelsPerBeat, pixelsPerSemitone);

  // Draw block box
  drawMidiBlockBox(ctx, blockDuration, blockHeight, blockStartBeat, pixelsPerBeat);
  
  // Draw notes
  drawNotes(ctx, notes, selectedNoteIds, pixelsPerBeat, pixelsPerSemitone, blockStartBeat);
  
  // Draw selection box if active
  if (selectionBox && isDragging) {
    drawSelectionBox(ctx, selectionBox);
  }
};

/**
 * Draws the horizontal and vertical grid lines
 */
const drawGrid = (
  ctx: CanvasRenderingContext2D,
  editorWidth: number,
  editorHeight: number,
  blockDuration: number,
  pixelsPerBeat: number,
  pixelsPerSemitone: number
): void => {
  // Draw horizontal lines (pitch)
  for (let i = 0; i <= KEY_COUNT; i++) {
    const y = i * pixelsPerSemitone;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(editorWidth, y);
    
    // Check if this is an octave line (every 12th line)
    if (i % 12 === 0) {
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
    }
    
    ctx.stroke();
  }
  
  // Draw vertical lines (beats)
  for (let i = 0; i <= Math.ceil(editorWidth / (GRID_SNAP * pixelsPerBeat)); i++) {
    const x = i * GRID_SNAP * pixelsPerBeat;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, editorHeight);
    
    // Different styles for different beat divisions
    if (i % (4/GRID_SNAP) === 0) {
      ctx.strokeStyle = '#666'; // Measure lines
      ctx.lineWidth = 1;
    } else if (i % (1/GRID_SNAP) === 0) {
      ctx.strokeStyle = '#444'; // Beat lines
      ctx.lineWidth = 0.5;
    } else {
      ctx.strokeStyle = '#333'; // Grid lines
      ctx.lineWidth = 0.5;
    }
    
    ctx.stroke();
  }
};

/**
 * Draws the block box
 */
const drawMidiBlockBox = (
  ctx: CanvasRenderingContext2D,
  blockDuration: number,
  blockHeight: number,
  blockStartBeat: number,
  pixelsPerBeat: number
): void => {
  // Draw block box
  ctx.strokeStyle = '#00FF00'; // Green color
  ctx.lineWidth = 3;
  ctx.strokeRect(blockStartBeat * pixelsPerBeat, 0, blockDuration * pixelsPerBeat, blockHeight);
};

/**
 * Draws all MIDI notes on the canvas
 */
const drawNotes = (
  ctx: CanvasRenderingContext2D,
  notes: MIDINote[],
  selectedNoteIds: string[],
  pixelsPerBeat: number,
  pixelsPerSemitone: number,
  blockStartBeat: number
): void => {
  notes.forEach(note => {
    const noteX = (note.startBeat + blockStartBeat) * pixelsPerBeat;
    const noteY = (KEY_COUNT - (note.pitch - LOWEST_NOTE) - 1) * pixelsPerSemitone;
    const noteWidth = note.duration * pixelsPerBeat;
    const noteHeight = pixelsPerSemitone;
    
    // Set color based on selection state
    const isSelected = selectedNoteIds.includes(note.id);
    ctx.fillStyle = isSelected ? SELECTED_NOTE_COLOR : NOTE_COLOR;
    
    // Round corners for the note
    const radius = 3;
    ctx.beginPath();
    ctx.moveTo(noteX + radius, noteY);
    ctx.lineTo(noteX + noteWidth - radius, noteY);
    ctx.quadraticCurveTo(noteX + noteWidth, noteY, noteX + noteWidth, noteY + radius);
    ctx.lineTo(noteX + noteWidth, noteY + noteHeight - radius);
    ctx.quadraticCurveTo(noteX + noteWidth, noteY + noteHeight, noteX + noteWidth - radius, noteY + noteHeight);
    ctx.lineTo(noteX + radius, noteY + noteHeight);
    ctx.quadraticCurveTo(noteX, noteY + noteHeight, noteX, noteY + noteHeight - radius);
    ctx.lineTo(noteX, noteY + radius);
    ctx.quadraticCurveTo(noteX, noteY, noteX + radius, noteY);
    ctx.closePath();
    ctx.fill();
    
    // Add shadow effect
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fill();
    ctx.shadowColor = 'transparent'; // Reset shadow
    
    // Optional: Add subtle border
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
};

/**
 * Draws the selection box
 */
const drawSelectionBox = (
  ctx: CanvasRenderingContext2D,
  selectionBox: { startX: number, startY: number, endX: number, endY: number }
): void => {
  // Calculate box dimensions
  const left = Math.min(selectionBox.startX, selectionBox.endX);
  const top = Math.min(selectionBox.startY, selectionBox.endY);
  const width = Math.abs(selectionBox.endX - selectionBox.startX);
  const height = Math.abs(selectionBox.endY - selectionBox.startY);
  
  // Draw semi-transparent selection box
  ctx.fillStyle = SELECTION_BOX_COLOR;
  ctx.fillRect(left, top, width, height);
  
  // Draw selection box border
  ctx.strokeStyle = SELECTION_BOX_BORDER_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, width, height);
}; 