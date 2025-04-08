export interface MIDINote {
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
  size: number;
  color: string;
  // Expandable with more properties later
}

export interface VisualObject {
  type: string;
  properties: VisualObjectProperties;
}

export interface Synthesizer {
  // This will be used when we implement the abstract class
  getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[];
}

export interface Track {
  id: string;
  name: string;
  midiBlocks: MIDIBlock[];
  synthesizer: Synthesizer;
} 