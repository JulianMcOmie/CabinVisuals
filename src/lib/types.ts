export interface MIDINote {
  id: string;
  startBeat: number;
  duration: number;
  velocity: number;
  pitch: number;
}

export interface MIDIBlock {
  id: string;
  startBeat: number;
  endBeat: number;
  notes: MIDINote[];
}

export interface VisualObjectProperties {
  // Basic properties
  color: string;
  opacity?: number;
  emissive?: string;         // <-- Add emissive color
  emissiveIntensity?: number; // <-- Add emissive intensity
  
  // Legacy property for simple 2D objects
  size?: number;
  
  // 3D properties
  position?: [number, number, number];      // Base position from synthesizer
  positionOffset?: [number, number, number]; // Offset accumulated by effects
  rotation?: [number, number, number];
  scale?: [number, number, number];
  velocity?: [number, number, number];
  
  // Expandable with more properties later
}

export interface VisualObject {
  type: string;
  properties: VisualObjectProperties;
  sourceNoteId?: string;
}

// Import the actual Synthesizer class
import Synthesizer from './Synthesizer';
import Effect from './Effect';

export interface Track {
  id: string;
  name: string;
  isSoloed: boolean;
  isMuted: boolean;
  midiBlocks: MIDIBlock[];
  synthesizer: Synthesizer; // Now uses the imported class type
  effects: Effect[];
}

// Interface for the Color Range property type
export interface ColorRange {
  startHue: number; // 0-360
  endHue: number;   // 0-360
}