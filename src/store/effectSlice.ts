import { StateCreator } from 'zustand';
import Effect from '../lib/Effect'; // Import the base Effect class
import { AppState } from './store'; // Import the combined AppState

// Import Effect implementations
import ScaleEffect from '../lib/effects/ScaleEffect';
import DelayEffect from '../lib/effects/DelayEffect';

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
const availableEffectsData: EffectCategories = {
  Transform: [
    { id: 'ScaleEffect', name: 'Scale', constructor: ScaleEffect },
  ],
  Time: [
    { id: 'DelayEffect', name: 'Delay', constructor: DelayEffect },
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