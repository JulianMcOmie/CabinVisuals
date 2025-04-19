import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Import Slice types and creators
import { TimeSlice, TimeState, createTimeSlice } from './timeSlice';
import { AudioSlice, createAudioSlice } from './audioSlice';
// Import types from trackSlice's dependencies
import { Track as TrackType, MIDIBlock as ClipType, MIDINote } from '../lib/types';
import EffectInstance from '../lib/Effect';
import SynthesizerInstance from '../lib/Synthesizer';

import { TrackSlice, TrackState, createTrackSlice } from './trackSlice';
import { InstrumentSlice, createInstrumentSlice } from './instrumentSlice';
import { EffectSlice, createEffectSlice } from './effectSlice';
import { UISlice, UIState, createUISlice } from './uiSlice';

// --- Combined AppState Definition ---

// Combine all slice types into a single AppState type
// This AppState type is exported and used by slices for cross-slice access via get()
export type AppState = TimeSlice & AudioSlice & TrackSlice & InstrumentSlice & EffectSlice & UISlice;

// --- Persistence Types --- 
// Define the structure of the data *as it will be saved*

type SerializableSynth = {
    type: string; // The constructor name of the specific Synthesizer subclass
    settings: Record<string, any>; // Store parameters as a plain object
} | undefined;

type SerializableEffect = {
    type: string; // The constructor name of the specific Effect subclass
    settings: Record<string, any>; // Store parameters as a plain object
};

type SerializableClip = {
    id: string;
    startBeat: number; // Assuming MIDIBlock has startBeat
    endBeat: number;   // Assuming MIDIBlock has endBeat
    notes: MIDINote[]; // Assuming notes are serializable
    // Add other relevant serializable clip properties from MIDIBlock if needed
};

type SerializableTrack = {
    id: string;
    name: string;
    isMuted: boolean;
    isSoloed: boolean;
    synth: SerializableSynth;
    effects: SerializableEffect[];
    midiBlocks: SerializableClip[]; // Use midiBlocks based on TrackState
    // Add other serializable track properties from TrackType if needed
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

// --- Store Creator ---

const useStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createTimeSlice(...a),
      ...createAudioSlice(...a),
      ...createTrackSlice(...a),
      ...createInstrumentSlice(...a),
      ...createEffectSlice(...a),
      ...createUISlice(...a),
    }),
    {
      name: 'cabin-visuals-storage',
      // storage: createJSONStorage(() => sessionStorage), // Optional: Use sessionStorage

      // Define which parts of the state to save
      partialize: (state): PersistentState => {
        const persistentState: PersistentState = {};

        // 1. Select TimeState properties
        const timeStateKeys: (keyof TimeState)[] = [
            'bpm', 'isPlaying', 'loopEnabled', 'loopStartBeat', 'loopEndBeat', 'numMeasures'
        ];
        timeStateKeys.forEach(key => {
            if (key in state) {
                persistentState[key as keyof PersistentState] = state[key] as any;
            }
        });

        // 2. Select UIState properties
        const uiStateKeys: (keyof UIState)[] = [
            'isInstrumentSidebarVisible', 'selectedWindow'
        ];
        uiStateKeys.forEach(key => {
            if (key in state) {
                persistentState[key as keyof PersistentState] = state[key] as any;
            }
        });

        // 3. Select and process TrackState properties
        if (state.tracks && Array.isArray(state.tracks)) {
            persistentState.tracks = state.tracks.map((track: TrackType): SerializableTrack => {

                // Helper to get settings
                const getSerializableSettings = (instance: any): Record<string, any> => {
                    if (instance && typeof instance.getSettings === 'function') {
                        return instance.getSettings();
                    } else if (instance && instance.properties instanceof Map) {
                        // If settings are stored in the 'properties' Map
                        const settings: Record<string, any> = {};
                        instance.properties.forEach((prop: any, key: string) => {
                            // Ensure the value itself is serializable, handle complex objects if necessary
                            if (typeof prop.value !== 'function') { // Avoid trying to save functions
                                settings[key] = prop.value;
                            }
                        });
                        // Basic clone to be safe, although primitives are fine
                        try {
                           return JSON.parse(JSON.stringify(settings));
                        } catch (e) {
                            console.warn("Could not stringify/parse properties map for", instance, e);
                            return {};
                        }
                    }
                     return {}; // Default empty settings
                };

                // Process Synth (using constructor.name for type)
                const synthInstance = track.synthesizer as SynthesizerInstance;
                const serializableSynth: SerializableSynth = synthInstance ? {
                    type: synthInstance.constructor.name, // Use constructor name as type identifier
                    settings: getSerializableSettings(synthInstance),
                } : undefined;

                // Process Effects (using constructor.name for type)
                const serializableEffects: SerializableEffect[] = Array.isArray(track.effects) ?
                    track.effects.map((effect: EffectInstance): SerializableEffect => ({
                        type: effect.constructor.name, // Use constructor name as type identifier
                        settings: getSerializableSettings(effect),
                    })) : [];

                // Process MIDIBlocks (Clips)
                const serializableClips: SerializableClip[] = Array.isArray(track.midiBlocks) ?
                    track.midiBlocks.map((clip: ClipType): SerializableClip => ({
                        id: clip.id,
                        startBeat: clip.startBeat,
                        endBeat: clip.endBeat,
                        notes: clip.notes || [],
                    })) : [];

                // Construct the serializable track object (without volume/pan)
                return {
                    id: track.id,
                    name: track.name,
                    isMuted: track.isMuted,
                    isSoloed: track.isSoloed,
                    synth: serializableSynth,
                    effects: serializableEffects,
                    midiBlocks: serializableClips,
                };
            });
        }

        // Excluded state slices (Audio, Instrument, Effect definitions) are omitted automatically
        // by only including the keys processed above.

        return persistentState;
      },
    }
  )
);

export default useStore; 