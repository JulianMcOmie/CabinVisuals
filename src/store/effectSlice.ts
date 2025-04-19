import { StateCreator } from 'zustand';
import Effect from '../lib/Effect'; // Import the base Effect class
import { AppState } from './store'; // Import the combined AppState

// Import Effect implementations
import ScaleEffect from '../lib/effects/ScaleEffect';
import DelayEffect from '../lib/effects/DelayEffect';
import RadialDuplicateEffect from '../lib/effects/RadialDuplicateEffect';
import GravityEffect from '../lib/effects/GravityEffect';
import PositionOffsetEffect from '../lib/effects/PositionOffsetEffect';
import RescalePositionEffect from '../lib/effects/RescalePositionEffect';
import Rotate3DEffect from '../lib/effects/Rotate3DEffect';
import PanEffect from '../lib/effects/PanEffect';
import ColorEffect from '../lib/effects/ColorEffect';
import GlobalRotateEffect from '../lib/effects/GlobalRotateEffect'; // Import the new effect

// Define Effect structures
export interface EffectDefinition {
  id: string;
  name: string;
  constructor: new (...args: any[]) => Effect; // Constructor for the Effect subclass
}

export interface EffectCategories {
  [categoryName: string]: EffectDefinition[]; // Effects grouped by category
}

// Effect Slice State
export interface EffectState {
  availableEffects: EffectCategories; // All available effects, organized by category
  // Potentially add state for active effects per track/globally later
}

// Effect Slice Actions (initially empty, add actions as needed)
export interface EffectActions {}

// Combined Effect Slice Type
export type EffectSlice = EffectState & EffectActions;

// Define the actual effect data
export const availableEffectsData: EffectCategories = {
  Transform: [
    { id: 'ScaleEffect', name: 'Scale', constructor: ScaleEffect },
    { id: 'PositionOffsetEffect', name: 'Position Offset', constructor: PositionOffsetEffect },
    { id: 'RescalePositionEffect', name: 'Rescale Position', constructor: RescalePositionEffect },
    { id: 'Rotate3DEffect', name: '3D Rotate (Local)', constructor: Rotate3DEffect }, // Renamed slightly for clarity
    { id: 'GlobalRotateEffect', name: 'Global Rotate', constructor: GlobalRotateEffect }, // Add the new effect
  ],
  Time: [
    { id: 'DelayEffect', name: 'Delay', constructor: DelayEffect },
  ],
  Spatial: [
    { id: 'RadialDuplicateEffect', name: 'Radial Duplicate', constructor: RadialDuplicateEffect },
    { id: 'GravityEffect', name: 'Gravity', constructor: GravityEffect },
    { id: 'PanEffect', name: 'Pan', constructor: PanEffect },
  ],
  Color: [
    { id: 'ColorEffect', name: 'Override Color', constructor: ColorEffect },
  ]
};

// Creator function for the Effect Slice
export const createEffectSlice: StateCreator<
  AppState,
  [], // No middleware for this slice
  [], // No devtools options specific to this slice
  EffectSlice
> = (set, get) => ({
  // Initial state
  availableEffects: availableEffectsData,

  // Actions will be added here later, e.g.:
  // addEffectToTrack: (trackId, effectId) => { ... },
  // removeEffectFromTrack: (trackId, effectInstanceId) => { ... },
  // updateEffectProperty: (effectInstanceId, propertyName, value) => { ... },
}); 