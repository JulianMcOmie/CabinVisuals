// Constants for MIDI Editor
export const PIXELS_PER_BEAT = 50; // Greater detail than timeline view
export const PIXELS_PER_SEMITONE = 20; // Height of each piano key
export const BEATS_PER_MEASURE = 4;
export const GRID_SNAP = 0.25; // Snap to 16th notes
export const KEY_COUNT = 128; // 128 piano keys (C-1 to C8)
export const LOWEST_NOTE = 0; // MIDI note number for C-1
export const NOTE_COLOR = '#4a90e2'; // Color for MIDI notes
export const SELECTED_NOTE_COLOR = '#b3d9ff'; // Even brighter color for selected notes, closer to white
export const RESIZE_HANDLE_WIDTH = 6; // Width for note edge resize handles
export const BLOCK_RESIZE_HANDLE_WIDTH = 8; // Width for block resize handles
export const SELECTION_BOX_COLOR = 'rgba(100, 181, 255, 0.2)'; // Semi-transparent blue for selection box
export const SELECTION_BOX_BORDER_COLOR = 'rgba(100, 181, 255, 0.8)'; // More opaque blue for selection box border
export const PASTE_OFFSET = 0.25; // Offset for pasted notes in beats
export const MINIMUM_NOTE_DURATION = 0.1; // Minimum length of a note in beats

// Common type definitions specific to MIDI Editor
export type DragOperation = 'none' | 'select' | 'start' | 'end' | 'move';
export type CursorType = 'default' | 'move' | 'w-resize' | 'e-resize';
export type SelectionBox = { startX: number, startY: number, endX: number, endY: number } | null; 