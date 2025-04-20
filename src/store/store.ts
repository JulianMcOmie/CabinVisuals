import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';

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

// --- Debounce Utility --- 
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    };
}

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

// --- Persistence Types --- 
// Define the structure of the data *as it will be saved*

type SerializableSynth = {
    type: string; // Constructor name
    settings: Record<string, any>;
} | undefined;

type SerializableEffect = {
    type: string; // Constructor name
    settings: Record<string, any>;
};

type SerializableClip = {
    id: string;
    startBeat: number;
    endBeat: number;
    notes: MIDINote[];
};

type SerializableTrack = {
    id: string;
    name: string;
    isMuted: boolean;
    isSoloed: boolean;
    synth: SerializableSynth;
    effects: SerializableEffect[];
    midiBlocks: SerializableClip[];
};

// Define the overall structure of the persisted state
interface PersistentState {
    // TimeSlice state keys (subset of TimeState)
    bpm?: number;
    isPlaying?: boolean;
    loopEnabled?: boolean;
    loopStartBeat?: number | null;
    loopEndBeat?: number | null;
    numMeasures?: number;
    // Excluded: timeManager, currentBeat

    // UISlice state keys (subset of UIState)
    isInstrumentSidebarVisible?: boolean;
    selectedWindow?: string | null; // Assuming SelectedWindowType is compatible with string | null
    // Excluded: actions

    // TrackSlice state key (processed)
    tracks?: SerializableTrack[];
    // Excluded: selectedTrackId, selectedBlockId, selectedTrack, selectedBlock, selectedNotes, actions
}

// --- Helper to apply settings --- 
const applySettings = (instance: any, settings: Record<string, any>) => {
    if (!instance || !settings) return;

    // Prefer setPropertyValue if available (as defined in base classes)
    if (typeof instance.setPropertyValue === 'function') {
        for (const key in settings) {
            if (Object.prototype.hasOwnProperty.call(settings, key)) {
                try {
                    instance.setPropertyValue(key, settings[key]);
                } catch (e) {
                    console.warn(`Failed to set property "${key}" on`, instance, e);
                }
            }
        }
    } else if (instance.properties instanceof Map) {
         // Fallback: Directly manipulate properties Map if setPropertyValue doesn't exist
         console.warn('Attempting to set properties directly on Map for', instance.constructor.name, '. Consider implementing setPropertyValue.');
         for (const key in settings) {
            if (Object.prototype.hasOwnProperty.call(settings, key)) {
                if (instance.properties.has(key)) {
                    try {
                        instance.properties.get(key).value = settings[key];
                    } catch (e) {
                         console.warn(`Failed to set property map value "${key}" on`, instance, e);
                    }
                } else {
                    console.warn(`Property "${key}" not found in properties Map for`, instance.constructor.name);
                }
            }
         }
    }
    // TODO: Add other setting application methods if needed
};

// --- Debounced Storage Adapter --- 
const DEBOUNCE_WAIT_MS = 1000; // Save 1 second after the last change

const debouncedStorage: StateStorage = {
  getItem: (name) => {
    // console.log('getItem', name); // For debugging
    return localStorage.getItem(name);
  },
  setItem: debounce((name: string, value: string) => {
    console.log(`Persisting state (${(value.length / 1024).toFixed(2)} KB) after debounce...`);
    localStorage.setItem(name, value);
  }, DEBOUNCE_WAIT_MS),
  removeItem: (name) => {
    // console.log('removeItem', name); // For debugging
    localStorage.removeItem(name);
  },
};

// --- Store Creator ---

const useStore = create<AppState>()(
  // persist( // Temporarily commented out for performance testing
    (...a) => ({
      ...createTimeSlice(...a),
      ...createAudioSlice(...a),
      ...createTrackSlice(...a),
      ...createInstrumentSlice(...a),
      ...createEffectSlice(...a),
      ...createUISlice(...a),
    })
    /* // Temporarily commented out for performance testing
    ,
    {
      name: 'cabin-visuals-storage',
      // Use the debounced storage adapter via createJSONStorage
      storage: createJSONStorage(() => debouncedStorage),

      // Define which parts of the state to save
      partialize: (state): Partial<AppState> => {
        const persistentState: PersistentState = {};
        const timeStateKeys: (keyof TimeState)[] = [ 'bpm', 'isPlaying', 'loopEnabled', 'loopStartBeat', 'loopEndBeat', 'numMeasures' ];
        timeStateKeys.forEach(key => { if (key in state) { persistentState[key as keyof PersistentState] = state[key] as any; } });
        const uiStateKeys: (keyof UIState)[] = [ 'isInstrumentSidebarVisible', 'selectedWindow' ];
        uiStateKeys.forEach(key => { if (key in state) { persistentState[key as keyof PersistentState] = state[key] as any; } });
        if (state.tracks && Array.isArray(state.tracks)) {
            persistentState.tracks = state.tracks.map((track: TrackType): SerializableTrack => {
                const getSerializableSettings = (instance: any): Record<string, any> => {
                   if (instance && typeof instance.getSettings === 'function') { return instance.getSettings(); }
                   else if (instance && instance.properties instanceof Map) {
                       const settings: Record<string, any> = {};
                       instance.properties.forEach((prop: any, key: string) => { if (typeof prop.value !== 'function') { settings[key] = prop.value; } });
                       try { return JSON.parse(JSON.stringify(settings)); } catch (e) { console.warn("Could not stringify/parse properties map for", instance, e); return {}; }
                   } return {};
                };
                const synthInstance = track.synthesizer as SynthesizerInstance;
                const serializableSynth: SerializableSynth = synthInstance ? { type: synthInstance.constructor.name, settings: getSerializableSettings(synthInstance) } : undefined;
                const serializableEffects: SerializableEffect[] = Array.isArray(track.effects) ? track.effects.map((effect: EffectInstance): SerializableEffect => ({ type: effect.constructor.name, settings: getSerializableSettings(effect) })) : [];
                const serializableClips: SerializableClip[] = Array.isArray(track.midiBlocks) ? track.midiBlocks.map((clip: ClipType): SerializableClip => ({ id: clip.id, startBeat: clip.startBeat, endBeat: clip.endBeat, notes: clip.notes || [] })) : [];
                return {
                    id: track.id, name: track.name, isMuted: track.isMuted, isSoloed: track.isSoloed,
                    synth: serializableSynth, effects: serializableEffects, midiBlocks: serializableClips,
                };
            });
        }
        // Cast the specific PersistentState to the expected Partial<AppState>
        return persistentState as Partial<AppState>;
      },

      // Merge function to reconstruct instances during hydration
      merge: (persistedStateUnknown: unknown, currentState: AppState): AppState => {
        const persistedState = persistedStateUnknown as PersistentState;
        console.log("Merging persisted state...", persistedState);

        const newState = { ...currentState } as any;

        if (typeof persistedState !== 'object' || persistedState === null) {
             console.warn("Persisted state is not an object, returning current state.");
             return currentState;
        }

        let bpmNeedsUpdate: number | undefined = undefined;

        // Iterate over the keys in the persisted state
        for (const key in persistedState) {
            if (!Object.prototype.hasOwnProperty.call(persistedState, key)) continue;

            const typedKey = key as keyof PersistentState;
            const persistedValue = persistedState[typedKey];

            if (typedKey === 'tracks' && Array.isArray(persistedValue)) {
                // --- Track Reconstruction ---
                newState.tracks = persistedValue.map((trackData: SerializableTrack): TrackType | null => {
                    let reconstructedSynth: SynthesizerInstance | undefined = undefined;
                    if (trackData.synth) {
                        const SynthConstructor = synthesizerConstructors.get(trackData.synth.type);
                        if (SynthConstructor) {
                            try {
                                reconstructedSynth = new SynthConstructor();
                                applySettings(reconstructedSynth, trackData.synth.settings);
                            } catch (e) {
                                console.error(`Failed to reconstruct synthesizer "${trackData.synth.type}":`, e);
                            }
                        } else {
                            console.warn(`Synthesizer constructor not found for type "${trackData.synth.type}".`);
                        }
                    }

                    const reconstructedEffects: EffectInstance[] = (trackData.effects || []).map((effectData: SerializableEffect): EffectInstance | null => {
                        const EffectConstructor = effectConstructors.get(effectData.type);
                        if (EffectConstructor) {
                             try {
                                const newEffect = new EffectConstructor();
                                applySettings(newEffect, effectData.settings);
                                return newEffect;
                             } catch (e) {
                                 console.error(`Failed to reconstruct effect "${effectData.type}":`, e);
                                 return null;
                             }
                        } else {
                            console.warn(`Effect constructor not found for type "${effectData.type}".`);
                            return null;
                        }
                    }).filter((effect): effect is EffectInstance => effect !== null);

                    return {
                        id: trackData.id,
                        name: trackData.name,
                        isMuted: trackData.isMuted,
                        isSoloed: trackData.isSoloed,
                        midiBlocks: trackData.midiBlocks,
                        synthesizer: reconstructedSynth,
                        effects: reconstructedEffects,
                    } as TrackType;

                }).filter((track): track is TrackType => track !== null);

            } else if (typedKey in newState) {
                // Assign simple persisted value
                newState[typedKey] = persistedValue as any;
                // Check if BPM is being updated
                if (typedKey === 'bpm' && typeof persistedValue === 'number') {
                     bpmNeedsUpdate = persistedValue;
                }
            } else {
                 console.warn(`Persisted key "${typedKey}" not found in current state, skipping merge.`);
            }
        }

        // --- Post-Merge Adjustments ---
        // Update TimeManager BPM if it was loaded from persisted state
        if (bpmNeedsUpdate !== undefined && newState.timeManager && typeof newState.timeManager.setBPM === 'function') {
             console.log(`Applying persisted BPM (${bpmNeedsUpdate}) to TimeManager.`);
             try {
                newState.timeManager.setBPM(bpmNeedsUpdate);
             } catch (e) {
                console.error("Failed to apply persisted BPM to TimeManager:", e);
             }
        } else if (bpmNeedsUpdate !== undefined) {
             console.warn("Persisted BPM found, but TimeManager or setBPM method is missing in the merged state.");
        }

        console.log("Final merged state:", newState);
        return newState as AppState;
      },
    }
    */
  // ) // Temporarily commented out for performance testing
);

export default useStore; 