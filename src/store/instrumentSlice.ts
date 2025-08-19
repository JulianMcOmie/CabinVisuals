import { StateCreator } from 'zustand';
import Synthesizer from '../lib/Synthesizer';
import { AppState } from './store'; // Import the combined AppState

// Import Synthesizer Classes
import BasicSynthesizer from '../lib/synthesizers/BasicSynthesizer';
import ApproachingCubeSynth from '../lib/synthesizers/ApproachingCubeSynth';
import SymmetricResonanceSynth from '../lib/synthesizers/SymmetricResonanceSynth';
import GlowSynth from '../lib/synthesizers/GlowSynth';
import GlowingCubeSynth from '../lib/synthesizers/glowingCubeSynth';
import ConvergingSpheresSynth from '../lib/synthesizers/ConvergingSpheresSynth';
import SpiralGalaxySynth from '../lib/synthesizers/SpiralGalaxySynth';
import PulseSynth from '../lib/synthesizers/PulseSynth';
import ColorPulseSynth from '../lib/synthesizers/ColorPulseSynth';
import VelocityRotateSynth from '../lib/synthesizers/VelocityRotateSynth';
import RadialDuplicateGlowSynth from '../lib/synthesizers/RadialDuplicateGlowSynth';
import VelocityOffsetDuplicateSynth from '../lib/synthesizers/VelocityOffsetDuplicateSynth';
import PositionPulseSynth from '../lib/synthesizers/PositionPulseSynth';
import BackgroundLightSynth from '../lib/synthesizers/BackgroundLightSynth';
import ViolinRingSynth from '../lib/synthesizers/ViolinRingSynth';
import CircleOrbsSynth from '../lib/synthesizers/CircleOrbsSynth';
import CircleHitSynth from '../lib/synthesizers/CircleHitSynth';
import GlobalColorSynth from '../lib/synthesizers/GlobalColorSynth';
import MountainRushSynth from '../lib/synthesizers/MountainRushSynth';
import BallPositionSynthesizer from '../lib/synthesizers/BallPositionSynthesizer';

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
    { id: 'BallPositionSynthesizer', name: 'Ball Position', constructor: BallPositionSynthesizer },
    { id: 'SymmetricResonanceSynth', name: 'Symmetric Resonance', constructor: SymmetricResonanceSynth },
    { id: 'GlowSynth', name: 'Glow Synth', constructor: GlowSynth },
    { id: 'GlowingCubeSynth', name: 'Glowing Cube', constructor: GlowingCubeSynth },
    { id: 'RadialDuplicateGlowSynth', name: 'Radial Glow Dup', constructor: RadialDuplicateGlowSynth },
    { id: 'ViolinRingSynth', name: 'Violin Ring', constructor: ViolinRingSynth },
    { id: 'CircleOrbsSynth', name: 'Circle Orbs', constructor: CircleOrbsSynth },
    { id: 'CircleHitSynth', name: 'Circle Hit', constructor: CircleHitSynth },
  ],
  Percussive: [
    { id: 'ConvergingSpheresSynth', name: 'Converging Spheres', constructor: ConvergingSpheresSynth },
  ],
  Background: [
    { id: 'SpiralGalaxySynth', name: 'Spiral Galaxy', constructor: SpiralGalaxySynth },
    { id: 'BackgroundLightSynth', name: 'Background Light', constructor: BackgroundLightSynth },
    { id: 'MountainRushSynth', name: 'Mountain Rush', constructor: MountainRushSynth },
  ],
  Utility: [
    { id: 'PulseSynth', name: 'Global Pulse', constructor: PulseSynth },
    { id: 'ColorPulseSynth', name: 'Color Pulse', constructor: ColorPulseSynth },
    { id: 'VelocityRotateSynth', name: 'Velocity Rotate', constructor: VelocityRotateSynth },
    { id: 'VelocityOffsetDuplicateSynth', name: 'Velocity Duplicate', constructor: VelocityOffsetDuplicateSynth },
    { id: 'PositionPulseSynth', name: 'Position Pulse', constructor: PositionPulseSynth },
    { id: 'GlobalColorSynth', name: 'Global Color', constructor: GlobalColorSynth },
  ]
};

export const createInstrumentSlice: StateCreator<
  AppState,
  [],
  [],
  InstrumentSlice
> = (set, get) => ({
  availableInstruments: availableInstrumentsData,
}); 