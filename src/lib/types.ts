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
  midiBlocks: MIDIBlock[];
  synthesizer: Synthesizer; // Now uses the imported class type
}

// Remove the conflicting interface definition below
/*
// Assuming Synthesizer is defined like this or similarly:
export interface Synthesizer {
  // Define the expected properties and methods of a synthesizer
  playNote(note: MIDINote, time: number, duration?: number): void;
  releaseNote(note: MIDINote, time: number): void;
  setParameters(params: any): void;
  dispose(): void;
  // Add other common methods/properties like connect, volume, etc.
}

// Or if it's a class:
// export class Synthesizer { ... }

// Or if it's a type alias:
// export type Synthesizer = Tone.Synth | Tone.Sampler | ... ;
*/ 