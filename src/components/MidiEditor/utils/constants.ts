// Constants for MIDI Editor
export const PIXELS_PER_BEAT = 50; // Greater detail than timeline view
export const PIXELS_PER_SEMITONE = 16; // Height of each piano key
export const GRID_SNAP = 0.25; // Snap to 1/4 beat
export const KEY_COUNT = 88; // 88 piano keys (A0 to C8)
export const LOWEST_NOTE = 21; // A0 MIDI note number
export const NOTE_COLOR = '#4a90e2'; // Color for MIDI notes
export const SELECTED_NOTE_COLOR = '#b3d9ff'; // Even brighter color for selected notes, closer to white
export const RESIZE_HANDLE_WIDTH = 5; // Width of resize handles in pixels
export const SELECTION_BOX_COLOR = 'rgba(100, 181, 255, 0.2)'; // Semi-transparent blue for selection box
export const SELECTION_BOX_BORDER_COLOR = 'rgba(100, 181, 255, 0.8)'; // More opaque blue for selection box border
export const PASTE_OFFSET = 1.5; // Offset in beats when pasting notes
export const MINIMUM_NOTE_DURATION = 0.25; // Minimum note duration in beats

// Common type definitions specific to MIDI Editor
export type DragOperation = 'none' | 'select' | 'start' | 'end' | 'move';
export type CursorType = 'default' | 'move' | 'w-resize' | 'e-resize';
export type SelectionBox = { startX: number, startY: number, endX: number, endY: number } | null; 