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

// --- Helper to check if a horizontal range is visible ---
function isRangeVisibleX(startX: number, endX: number, scrollX: number, canvasWidth: number): boolean {
  const screenStartX = startX - scrollX;
  const screenEndX = endX - scrollX;
  return screenEndX >= 0 && screenStartX <= canvasWidth;
}

// --- Helper to check if a vertical range is visible ---
function isRangeVisibleY(startY: number, endY: number, scrollY: number, canvasHeight: number): boolean {
  const screenStartY = startY - scrollY;
  const screenEndY = endY - scrollY;
  return screenEndY >= 0 && screenStartY <= canvasHeight;
}

// --- Helper to get Y coordinate for a MIDI note value ---
function getNoteY(noteValue: number, pixelsPerSemitone: number): number {
    // Ensure LOWEST_NOTE is defined or use a default like 21 (A0)
    const effectiveLowestNote = LOWEST_NOTE ?? 21;
    // Ensure KEY_COUNT is defined or use a default like 88 or 128
    const effectiveKeyCount = KEY_COUNT ?? 128;
    // Use noteValue directly as it's passed in
    return (effectiveKeyCount - (noteValue - effectiveLowestNote) - 1) * pixelsPerSemitone;
}

/**
 * Renders the visible portion of the MIDI editor canvas.
 * Assumes context is NOT translated by scrollX/scrollY.
 * All coordinates are calculated relative to the canvas (0,0) top-left.
 */
export const drawMidiEditor = (
  ctx: CanvasRenderingContext2D,
  notes: MIDINote[],
  selectedNoteIds: string[],
  canvasWidth: number,      // Visible canvas width
  canvasHeight: number,     // Visible canvas height
  numMeasures: number,      // Total number of measures for grid calculation
  selectionBox: SelectionBox | null, // Allow null
  isDragging: boolean,        // Keep for selection box visibility
  pixelsPerBeat: number,
  pixelsPerSemitone: number,
  blockStartBeat: number,
  blockDuration: number,
  scrollX: number,            // Current horizontal scroll offset
  scrollY: number,            // Current vertical scroll offset
  currentBeat: number         // Playhead position in beats
): void => {
  // 0. Clear canvas (important!)
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 1. Calculate Visible Beat Range
  const startBeatVisible = scrollX / pixelsPerBeat;
  const endBeatVisible = (scrollX + canvasWidth) / pixelsPerBeat;

  // 2. Calculate Visible Pitch Range (Note Numbers)
  const startNoteYVisible = scrollY;
  const endNoteYVisible = scrollY + canvasHeight;
  // Optional: Convert Y range to note value range if needed for grid line optimization
  // const highestNoteVisible = ... calculation based on startNoteYVisible ...
  // const lowestNoteVisible = ... calculation based on endNoteYVisible ..


  drawGrid(ctx, canvasWidth, canvasHeight, numMeasures, pixelsPerBeat, pixelsPerSemitone, scrollX, scrollY);

  drawMidiBlock(ctx, blockStartBeat, blockDuration, pixelsPerBeat, pixelsPerSemitone, scrollX, scrollY, canvasWidth, canvasHeight);

  drawNotes(ctx, notes, selectedNoteIds, pixelsPerBeat, pixelsPerSemitone, scrollX, scrollY, blockStartBeat, canvasWidth, canvasHeight);

  drawPlayhead(ctx, currentBeat, pixelsPerBeat, canvasHeight, scrollX, canvasWidth);

  if (selectionBox && isDragging) {
    drawSelectionBox(ctx, selectionBox, scrollX, scrollY, canvasWidth, canvasHeight);
  }
};

/**
 * Draws only the visible horizontal and vertical grid lines.
 */
const drawGrid = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  numMeasures: number,
  pixelsPerBeat: number,
  pixelsPerSemitone: number,
  scrollX: number,
  scrollY: number
): void => {
  // console.log('scrollX', scrollX);
  // console.log('scrollY', scrollY);
  const totalBeats = numMeasures * BEATS_PER_MEASURE;
  const totalHeight = (KEY_COUNT ?? 128) * pixelsPerSemitone; // Use effective key count

  // --- Draw Horizontal Lines (Pitch) ---
  const startKey = Math.max(0, Math.floor(scrollY / pixelsPerSemitone));
  const endKey = Math.min(KEY_COUNT ?? 128, Math.ceil((scrollY + canvasHeight) / pixelsPerSemitone));

  for (let keyIndex = startKey; keyIndex <= endKey; keyIndex++) {
    const y = keyIndex * pixelsPerSemitone - scrollY; // Calculate screen Y

    // Basic check if line is within canvas height bounds
    if (y >= 0 && y <= canvasHeight) {
        ctx.beginPath();
        ctx.moveTo(0, y); // Draw across the visible canvas width
        ctx.lineTo(canvasWidth, y);

        // Style octave lines (assuming MIDI note numbers where C is multiple of 12, e.g., C4=60)
        // Adjust logic based on how LOWEST_NOTE relates to actual MIDI notes
        const effectiveLowestNote = LOWEST_NOTE ?? 21;
        const midiNote = (KEY_COUNT ?? 128) - 1 - keyIndex + effectiveLowestNote;
        if (midiNote % 12 === 0) { // Assuming C is 0, C# is 1 etc. Adjust if LOWEST_NOTE isn't C
          ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5;
        }
        ctx.stroke();
    }
  }

  // --- Draw Vertical Lines (Beats) ---
  const startBeat = Math.max(0, Math.floor(scrollX / (GRID_SNAP * pixelsPerBeat)));
  const endBeat = Math.min(totalBeats / GRID_SNAP, Math.ceil((scrollX + canvasWidth) / (GRID_SNAP * pixelsPerBeat)));

  for (let i = startBeat; i <= endBeat; i++) {
    const beat = i * GRID_SNAP;
    const x = beat * pixelsPerBeat - scrollX; // Calculate screen X

    // Basic check if line is within canvas width bounds
    if (x >= 0 && x <= canvasWidth) {
        ctx.beginPath();
        ctx.moveTo(x, 0); // Draw down the visible canvas height
        ctx.lineTo(x, canvasHeight);

        // Style beat/measure lines
        // `beat` is the actual beat number (e.g., 0, 0.25, 0.5, ...)
        if (beat % BEATS_PER_MEASURE === 0) { // Measure line
          ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
        } else if (beat % 1 === 0) { // Beat line
          ctx.strokeStyle = '#444'; ctx.lineWidth = 0.5;
        } else { // Subdivision line
          ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5;
        }
        ctx.stroke();
    }
  }
};


/**
 * Draws the MIDI block on the canvas.
 */
const drawMidiBlock = (
  ctx: CanvasRenderingContext2D,
  blockStartBeat: number,
  blockDuration: number,
  pixelsPerBeat: number,
  pixelsPerSemitone: number,
  scrollX: number,
  scrollY: number,
  canvasWidth: number,
  canvasHeight: number
): void => {
  // Draw the block
  // Draw a semi-transparent grey fill with light green borders
  ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
  ctx.fillRect(blockStartBeat * pixelsPerBeat - scrollX, 0, blockDuration * pixelsPerBeat, canvasHeight);
  
  // Add soft light green border
  ctx.strokeStyle = 'rgba(144, 238, 144, 0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(blockStartBeat * pixelsPerBeat - scrollX, 0, blockDuration * pixelsPerBeat, canvasHeight);
  
  // Add thicker transparent soft green rectangle at the top
  ctx.fillStyle = 'rgba(144, 238, 144, 0.8)';
  ctx.fillRect(
    blockStartBeat * pixelsPerBeat - scrollX, 
    0, 
    blockDuration * pixelsPerBeat, 
    6
  );
};
/**
 * Draws only the visible MIDI notes on the canvas.
 */
const drawNotes = (
  ctx: CanvasRenderingContext2D,
  notes: MIDINote[],
  selectedNoteIds: string[],
  pixelsPerBeat: number,
  pixelsPerSemitone: number,
  scrollX: number,
  scrollY: number,
  blockStartBeat: number,
  canvasWidth: number,
  canvasHeight: number
): void => {
  notes.forEach(note => {
    // Calculate note's theoretical full coordinates and dimensions
    const noteX = blockStartBeat * pixelsPerBeat + note.startBeat * pixelsPerBeat;
    const noteY = getNoteY(note.pitch, pixelsPerSemitone); // Use note.pitch here
    const noteWidth = note.duration * pixelsPerBeat;
    const noteHeight = pixelsPerSemitone;

    // Check visibility before drawing
    if (isRangeVisibleX(noteX, noteX + noteWidth, scrollX, canvasWidth) &&
        isRangeVisibleY(noteY, noteY + noteHeight, scrollY, canvasHeight))
    {
      drawNote(ctx, note, blockStartBeat, selectedNoteIds, pixelsPerBeat, pixelsPerSemitone, scrollX, scrollY);
    }
  });
};

/**
 * Draws a single MIDI note at its scrolled position.
 * Assumes visibility check has already been done.
 */
const drawNote = (
  ctx: CanvasRenderingContext2D,
  note: MIDINote,
  blockStartBeat: number,
  selectedNoteIds: string[],
  pixelsPerBeat: number,
  pixelsPerSemitone: number,
  scrollX: number,
  scrollY: number
) => {
  // Calculate screen coordinates
  const screenX = (note.startBeat + blockStartBeat) * pixelsPerBeat - scrollX;
  const screenY = getNoteY(note.pitch, pixelsPerSemitone) - scrollY; // Use note.pitch here
  const noteWidth = note.duration * pixelsPerBeat;
  const noteHeight = pixelsPerSemitone;

  // Set color based on selection state
  const isSelected = selectedNoteIds.includes(note.id);
  ctx.fillStyle = isSelected ? SELECTED_NOTE_COLOR : NOTE_COLOR;

  // --- Draw the note rectangle (simple version first, add rounding if needed) ---
  // ctx.fillRect(screenX, screenY, noteWidth, noteHeight);

  // --- Draw rounded rectangle ---
  const radius = Math.min(3, noteWidth / 2, noteHeight / 2); // Prevent radius > half size
  ctx.beginPath();
  // Handle cases where width/height are too small for radius gracefully
  if (noteWidth < 2 * radius || noteHeight < 2 * radius) {
      // Fallback to sharp corners if too small for radius
      ctx.rect(screenX, screenY, noteWidth, noteHeight);
  } else {
      ctx.moveTo(screenX + radius, screenY);
      ctx.lineTo(screenX + noteWidth - radius, screenY);
      ctx.quadraticCurveTo(screenX + noteWidth, screenY, screenX + noteWidth, screenY + radius);
      ctx.lineTo(screenX + noteWidth, screenY + noteHeight - radius);
      ctx.quadraticCurveTo(screenX + noteWidth, screenY + noteHeight, screenX + noteWidth - radius, screenY + noteHeight);
      ctx.lineTo(screenX + radius, screenY + noteHeight);
      ctx.quadraticCurveTo(screenX, screenY + noteHeight, screenX, screenY + noteHeight - radius);
      ctx.lineTo(screenX, screenY + radius);
      ctx.quadraticCurveTo(screenX, screenY, screenX + radius, screenY);
  }
  ctx.closePath();
  ctx.fill();

  //Optional: Add subtle border
  // ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  // ctx.lineWidth = 0.5;
  // ctx.stroke();

  // Consider adding text (note name) inside the note if space permits and desired
};

/**
 * Draws the selection box, adjusted for scroll and clipped to canvas bounds.
 */
const drawSelectionBox = (
  ctx: CanvasRenderingContext2D,
  selectionBox: { startX: number, startY: number, endX: number, endY: number },
  scrollX: number,
  scrollY: number,
  canvasWidth: number,
  canvasHeight: number
): void => {
  // Calculate box dimensions in theoretical coordinates (relative to grid)
  const leftTheoretical = Math.min(selectionBox.startX, selectionBox.endX);
  const topTheoretical = Math.min(selectionBox.startY, selectionBox.endY);
  const widthTheoretical = Math.abs(selectionBox.endX - selectionBox.startX);
  const heightTheoretical = Math.abs(selectionBox.endY - selectionBox.startY);

  // Calculate screen coordinates
  const screenLeft = leftTheoretical - scrollX;
  const screenTop = topTheoretical - scrollY;
  const screenWidth = widthTheoretical;
  const screenHeight = heightTheoretical;

  // Clip the drawing coordinates to the canvas bounds
  const drawX = Math.max(0, screenLeft);
  const drawY = Math.max(0, screenTop);
  const drawWidth = Math.min(canvasWidth - drawX, screenLeft + screenWidth - drawX);
  const drawHeight = Math.min(canvasHeight - drawY, screenTop + screenHeight - drawY);

  // Only draw if the clipped dimensions are valid
  if (drawWidth > 0 && drawHeight > 0) {
    // Draw semi-transparent selection box
    ctx.fillStyle = SELECTION_BOX_COLOR;
    ctx.fillRect(drawX, drawY, drawWidth, drawHeight);

    // Draw border
    ctx.strokeStyle = SELECTION_BOX_BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
  }
};

/**
 * Draws the playhead if it's visible on the canvas.
 */
const drawPlayhead = (
  ctx: CanvasRenderingContext2D,
  currentBeat: number,
  pixelsPerBeat: number,
  canvasHeight: number, // Use canvas height
  scrollX: number,
  canvasWidth: number   // Use canvas width for visibility check
): void => {
  const playheadXTheoretical = currentBeat * pixelsPerBeat;
  const playheadXScreen = playheadXTheoretical - scrollX;

  // Check if the playhead is within the visible canvas width
  if (playheadXScreen >= 0 && playheadXScreen <= canvasWidth) {
    ctx.strokeStyle = '#FF0000'; // Red color for playhead
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadXScreen, 0);
    ctx.lineTo(playheadXScreen, canvasHeight); // Draw full height of the canvas
    ctx.stroke();
  }
};

// Removed drawMidiBlockBox as the block concept might be handled differently
// If needed, it can be re-added following the same principles (calculate screen coords, check visibility)
