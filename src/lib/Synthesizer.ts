import { MIDIBlock, VisualObject } from './types';

abstract class Synthesizer {
  // Synthesizer settings stored within the instance
  abstract getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[];
}

export default Synthesizer; 