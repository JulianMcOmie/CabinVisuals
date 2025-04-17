import { StateCreator } from 'zustand';
import Synthesizer from '../lib/Synthesizer';
import { AppState } from './store'; // Import the combined AppState

// Import Synthesizer Classes
import SineWaveSynth from '../lib/synthesizers/SineWaveSynth';
import MelodicOrbitSynth from '../lib/synthesizers/MelodicOrbitSynth';
import ApproachingCubeSynth from '../lib/synthesizers/ApproachingCubeSynth';
import BackgroundPlaneSynth from '../lib/synthesizers/BackgroundPlaneSynth';
import BasicSynthesizer from '../lib/synthesizers/BasicSynthesizer';
import KickDrumSynth from '../lib/synthesizers/KickDrumSynth';
import SnareDrumSynth from '../lib/synthesizers/SnareDrumSynth';
import HiHatSynth from '../lib/synthesizers/HiHatSynth';
import ShakerSynth from '../lib/synthesizers/ShakerSynth';

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

// Define the actual instrument data (moved here)
const availableInstrumentsData: InstrumentCategories = {
  Melodic: [
    { id: 'SineWaveSynth', name: 'Sine Wave Synth', constructor: SineWaveSynth },
    { id: 'MelodicOrbitSynth', name: 'Melodic Orbit Synth', constructor: MelodicOrbitSynth },
    { id: 'ApproachingCubeSynth', name: 'Approaching Cube Synth', constructor: ApproachingCubeSynth },
    { id: 'BackgroundPlaneSynth', name: 'Background Plane Synth', constructor: BackgroundPlaneSynth },
    { id: 'BasicSynthesizer', name: 'Basic Synth', constructor: BasicSynthesizer }, 
  ],
  Percussive: [
    { id: 'KickDrumSynth', name: 'Kick Drum', constructor: KickDrumSynth },
    { id: 'SnareDrumSynth', name: 'Snare Drum', constructor: SnareDrumSynth },
    { id: 'HiHatSynth', name: 'Hi-Hat', constructor: HiHatSynth },
    { id: 'ShakerSynth', name: 'Shaker', constructor: ShakerSynth },
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