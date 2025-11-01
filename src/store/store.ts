import { create } from 'zustand';

// Import Slice types and creators
import { TimeSlice, TimeState, createTimeSlice } from './timeSlice';
import { AudioSlice, createAudioSlice } from './audioSlice';
// Import types from trackSlice's dependencies
import { Track as TrackType, MIDIBlock as ClipType, MIDINote } from '@/lib/types';
import EffectInstance from '@/lib/Effect';
import SynthesizerInstance from '@/lib/Synthesizer';

import { TrackSlice, TrackState, createTrackSlice } from './trackSlice';
import { InstrumentSlice, InstrumentDefinition, InstrumentCategories, availableInstrumentsData, createInstrumentSlice } from './instrumentSlice';
import { EffectSlice, EffectDefinition, EffectCategories, availableEffectsData, createEffectSlice } from './effectSlice';
import { UISlice, UIState, createUISlice, SelectedWindowType } from './uiSlice';
import { ProjectSlice, createProjectSlice, ProjectMetadata } from './projectSlice';

// --- Constructor Mappings --- 

type SynthConstructor = new (...args: any[]) => SynthesizerInstance;
type EffectConstructor = new (...args: any[]) => EffectInstance;

export const synthesizerConstructors = new Map<string, SynthConstructor>();
export const synthIdByConstructor = new Map<SynthConstructor, string>();
Object.values(availableInstrumentsData).flat().forEach((inst: InstrumentDefinition) => {
    if (inst.constructor) {
        // Primary: register by stable id for persistence
        synthesizerConstructors.set(inst.id, inst.constructor);
        // Back-compat: also allow constructor.name
    if (inst.constructor) {
        // Primary: register by stable id for persistence
        synthesizerConstructors.set(inst.id, inst.constructor);
        // Back-compat: also allow constructor.name
        synthesizerConstructors.set(inst.constructor.name, inst.constructor);
        // Reverse lookup for serialization
        synthIdByConstructor.set(inst.constructor as SynthConstructor, inst.id);
    }
});
try {
    console.log('[DEBUG] synthesizerConstructors keys:', Array.from(synthesizerConstructors.keys()));
} catch {}

export const effectConstructors = new Map<string, EffectConstructor>();
export const effectIdByConstructor = new Map<EffectConstructor, string>();
Object.values(availableEffectsData).flat().forEach((effect: EffectDefinition) => {
    if (effect.constructor) {
        // Primary: register by stable id for persistence
        effectConstructors.set(effect.id, effect.constructor);
        // Back-compat: also allow constructor.name
    if (effect.constructor) {
        // Primary: register by stable id for persistence
        effectConstructors.set(effect.id, effect.constructor);
        // Back-compat: also allow constructor.name
        effectConstructors.set(effect.constructor.name, effect.constructor);
        // Reverse lookup for serialization
        effectIdByConstructor.set(effect.constructor as EffectConstructor, effect.id);
    }
});
try {
    console.log('[DEBUG] effectConstructors keys:', Array.from(effectConstructors.keys()));
} catch {}

// --- Combined AppState Definition ---

// Combine all slice types into a single AppState type
// This AppState type is exported and used by slices for cross-slice access via get()
export type AppState = TimeSlice & AudioSlice & TrackSlice & InstrumentSlice & EffectSlice & UISlice & ProjectSlice;

// --- Store Creator ---

const useStore = create<AppState>()((...a) => ({
    ...createTimeSlice(...a),
    ...createAudioSlice(...a),
    ...createTrackSlice(...a),
    ...createInstrumentSlice(...a),
    ...createEffectSlice(...a),
    ...createUISlice(...a),
    ...createProjectSlice(...a),
}));

/**
 * Initializes the Zustand store with default values.
 * Projects are now loaded via URL-based routing (see app/editor/page.tsx).
 * No longer loads from IndexedDB - all data comes from Supabase.
 */
export const initializeStore = async () => {
    console.log("Initializing store with default state...");
    
    try {
        // Initialize with clean default state
        // Project loading happens via loadProject() action from URL
        useStore.setState({
            projectList: [],
            currentLoadedProjectId: null,
            tracks: [],
            isAudioLoaded: false,
            bpm: 120,
            numMeasures: 8,
            loopEnabled: false,
            isPlaying: false,
            loopStartBeat: null,
            loopEndBeat: null,
            isInstrumentSidebarVisible: true,
            selectedWindow: null,
            selectedTrackId: null,
            selectedBlockId: null,
            selectedNotes: null,
            clipboardBlock: null,
            detailViewMode: "instrument",
        });
        
        console.log("Store initialized with default state.");
        
        // Post-hydration: sync TimeManager BPM
        const finalState = useStore.getState();
        if (finalState.timeManager && finalState.bpm) {
            finalState.timeManager.setBPM(finalState.bpm);
        }
        
    } catch (error) {
        console.error("Error during store initialization:", error);
        // Even on error, set minimal default state
        useStore.setState({ 
            projectList: [], 
            currentLoadedProjectId: null, 
            tracks: [],
            isAudioLoaded: false,
            bpm: 120,
            numMeasures: 8,
            loopEnabled: false,
            isPlaying: false,
        });
    }
};

export default useStore;