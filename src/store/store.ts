import { create } from 'zustand';

// Import Slice types and creators
import { TimeSlice, TimeState, createTimeSlice } from './timeSlice';
import { AudioSlice, createAudioSlice } from './audioSlice';
// Import types from trackSlice's dependencies
import { Track as TrackType, MIDIBlock as ClipType, MIDINote } from '../lib/types';
import EffectInstance from '../lib/Effect';
import SynthesizerInstance from '../lib/Synthesizer';

import { TrackSlice, TrackState, createTrackSlice } from './trackSlice';
import { InstrumentSlice, InstrumentDefinition, InstrumentCategories, availableInstrumentsData, createInstrumentSlice } from './instrumentSlice';
import { EffectSlice, EffectDefinition, EffectCategories, availableEffectsData, createEffectSlice } from './effectSlice';
import { UISlice, UIState, createUISlice } from './uiSlice';

// --- Constructor Mappings --- 

const synthesizerConstructors = new Map<string, new (...args: any[]) => SynthesizerInstance>();
Object.values(availableInstrumentsData).flat().forEach((inst: InstrumentDefinition) => {
    if (inst.constructor) { // Check if constructor exists
        synthesizerConstructors.set(inst.constructor.name, inst.constructor);
    }
});

const effectConstructors = new Map<string, new (...args: any[]) => EffectInstance>();
Object.values(availableEffectsData).flat().forEach((effect: EffectDefinition) => {
    if (effect.constructor) { // Check if constructor exists
        effectConstructors.set(effect.constructor.name, effect.constructor);
    }
});

// --- Combined AppState Definition ---

// Combine all slice types into a single AppState type
// This AppState type is exported and used by slices for cross-slice access via get()
export type AppState = TimeSlice & AudioSlice & TrackSlice & InstrumentSlice & EffectSlice & UISlice;

// --- Store Creator ---

const useStore = create<AppState>()((...a) => ({
    ...createTimeSlice(...a),
    ...createAudioSlice(...a),
    ...createTrackSlice(...a),
    ...createInstrumentSlice(...a),
    ...createEffectSlice(...a),
    ...createUISlice(...a),
}));

export default useStore; 