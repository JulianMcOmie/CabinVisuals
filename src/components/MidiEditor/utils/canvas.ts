import { MIDINote } from '../../../lib/types';
import {
  KEY_COUNT,
  LOWEST_NOTE,
  NOTE_COLOR,
  SELECTED_NOTE_COLOR,
  SELECTION_BOX_COLOR,
  SELECTION_BOX_BORDER_COLOR,
  GRID_SNAP,
  SelectionBox,
  BEATS_PER_MEASURE
} from './constants';

/**
 * Renders the entire MIDI editor canvas, including grid, notes, and selection box
 */
export const drawMidiEditor = (
  ctx: CanvasRenderingContext2D,
  notes: MIDINote[],
  selectedNoteIds: string[],
  editorWidth: number,   // Visible width
  editorHeight: number,  // Visible height
  blockWidth: number,    // Block width (for block outline, note placement)
  blockHeight: number,   // Total piano roll height
  blockDuration: number,
  blockStartBeat: number,
  totalGridWidth: number, // Renamed parameter for clarity, represents full grid width
  selectionBox: SelectionBox,
  isDragging: boolean,
  pixelsPerBeat: number,
  pixelsPerSemitone: number
): void => {
  // Clear the visible area. Assumes 0,0 is top-left of VISIBLE area AFTER translate
  ctx.clearRect(0, 0, editorWidth, editorHeight);
  
  // Calculate total beats based on totalGridWidth (or could be passed in if available)
  // Note: Ensure numMeasures/BEATS_PER_MEASURE are available or passed if needed
  const totalBeats = totalGridWidth / pixelsPerBeat; 
  
  // Draw grid using totalGridWidth and totalBeats
  drawGrid(ctx, totalGridWidth, editorHeight, totalBeats, pixelsPerBeat, pixelsPerSemitone);

  // Draw block box (uses block specific dimensions)
  drawMidiBlockBox(ctx, blockDuration, blockHeight, blockStartBeat, pixelsPerBeat, pixelsPerSemitone);
  
  // Draw notes (uses note specific dimensions relative to block start)
  drawNotes(ctx, notes, selectedNoteIds, pixelsPerBeat, pixelsPerSemitone, blockStartBeat);
  
  // Draw selection box if active (uses mouse coords relative to visible area)
  if (selectionBox && isDragging) {
    drawSelectionBox(ctx, selectionBox);
  }
};

/**
 * Draws the horizontal and vertical grid lines
 */
const drawGrid = (
  ctx: CanvasRenderingContext2D,
  totalGridWidth: number, // Renamed: Use total width for grid extent
  contentHeight: number, // Still represents the height to draw lines within
  totalBeats: number,    // Renamed: Total beats for vertical line calculation
  pixelsPerBeat: number,
  pixelsPerSemitone: number
): void => {
  // Draw horizontal lines (pitch)
  for (let i = 0; i <= KEY_COUNT; i++) {
    const y = i * pixelsPerSemitone;
    ctx.beginPath();
    ctx.moveTo(0, y);
    // --- Use totalGridWidth --- 
    ctx.lineTo(totalGridWidth, y);
    
    // Octave line styling
    if (i % 12 === 0) {
      ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5;
    }
    ctx.stroke();
  }
  
  // Draw vertical lines (beats)
  // --- Loop based on totalBeats --- 
  const totalGridLines = Math.ceil(totalBeats / GRID_SNAP);
  for (let i = 0; i <= totalGridLines; i++) {
    const x = i * GRID_SNAP * pixelsPerBeat;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, contentHeight); // Use the height passed (likely visible height)
    
    // Beat division styling
    if (i % (4/GRID_SNAP) === 0) {
      ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
    } else if (i % (1/GRID_SNAP) === 0) {
      ctx.strokeStyle = '#444'; ctx.lineWidth = 0.5;
    } else {
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5;
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
  pixelsPerBeat: number,
  pixelsPerSemitone: number
): void => {
  // Draw block box
  ctx.strokeStyle = '#00FF00'; // Green color
  ctx.lineWidth = 3;
  ctx.strokeRect(blockStartBeat * pixelsPerBeat, 0, blockDuration * pixelsPerBeat, pixelsPerSemitone * KEY_COUNT);
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