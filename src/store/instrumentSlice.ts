import { StateCreator } from 'zustand';
import Synthesizer from '../lib/Synthesizer';
import { AppState } from './store'; // Import the combined AppState

// Import Synthesizer Classes
import BasicSynthesizer from '../lib/synthesizers/BasicSynthesizer';
import ApproachingCubeSynth from '../lib/synthesizers/ApproachingCubeSynth';
import SymmetricResonanceSynth from '../lib/synthesizers/SymmetricResonanceSynth';
import GlowSynth from '../lib/synthesizers/GlowSynth';
import GlowingCubeSynth from '../lib/synthesizers/glowingCubeSynth';

// Define Instrument structures (moved here as they are specific to this slice)
export interface InstrumentDefinition {
  id: string;
  name: string;
  constructor: new (...args: any[]) => Synthesizer;
}

export interface InstrumentCategories {
  [categoryName: string]: InstrumentDefinition[];
}

// Instrument Slice
export interface InstrumentState {
  availableInstruments: InstrumentCategories;
}

// No actions specific to instruments in this slice for now
export interface InstrumentActions {}

export type InstrumentSlice = InstrumentState & InstrumentActions;

// Define the actual instrument data (UPDATE TO REFLECT DELETIONS)
export const availableInstrumentsData: InstrumentCategories = {
  Melodic: [
    { id: 'ApproachingCubeSynth', name: 'Approaching Cube Synth', constructor: ApproachingCubeSynth },
    { id: 'BasicSynthesizer', name: 'Basic Synth', constructor: BasicSynthesizer },
    { id: 'SymmetricResonanceSynth', name: 'Symmetric Resonance', constructor: SymmetricResonanceSynth },
    { id: 'GlowSynth', name: 'Glow Synth', constructor: GlowSynth },
    { id: 'GlowingCubeSynth', name: 'Glowing Cube', constructor: GlowingCubeSynth },
  ],
  Percussive: [

  ],
};

export const createInstrumentSlice: StateCreator<
  AppState,
  [],
  [],
  InstrumentSlice
> = (set, get) => ({
  availableInstruments: availableInstrumentsData,
}); 