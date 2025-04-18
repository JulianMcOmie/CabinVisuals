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
  
  // Legacy property for simple 2D objects
  size?: number;
  
  // 3D properties
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  
  // Expandable with more properties later
}

export interface VisualObject {
  type: string;
  properties: VisualObjectProperties;
}

// Import the actual Synthesizer class
import Synthesizer from './Synthesizer';

export interface Track {
  id: string;
  name: string;
  isSoloed: boolean;
  isMuted: boolean;
  midiBlocks: MIDIBlock[];
  synthesizer: Synthesizer; // Now uses the imported class type
}