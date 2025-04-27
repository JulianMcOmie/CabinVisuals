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
import { UISlice, UIState, createUISlice, SelectedWindowType } from './uiSlice';
import { ProjectSlice, createProjectSlice, ProjectMetadata } from './projectSlice';
import { ExportSlice, createExportSlice } from './exportSlice';

// Import persistence service and utils
import * as P from '../Persistence/persistence-service';
import { deserializeSynth, deserializeEffect } from '../utils/persistenceUtils';

// --- Constructor Mappings --- 

export const synthesizerConstructors = new Map<string, new (...args: any[]) => SynthesizerInstance>();
Object.values(availableInstrumentsData).flat().forEach((inst: InstrumentDefinition) => {
    if (inst.constructor) { // Check if constructor exists
        synthesizerConstructors.set(inst.constructor.name, inst.constructor);
    }
});

export const effectConstructors = new Map<string, new (...args: any[]) => EffectInstance>();
Object.values(availableEffectsData).flat().forEach((effect: EffectDefinition) => {
    if (effect.constructor) { // Check if constructor exists
        effectConstructors.set(effect.constructor.name, effect.constructor);
    }
});

// --- Combined AppState Definition ---

// Combine all slice types into a single AppState type
// This AppState type is exported and used by slices for cross-slice access via get()
export type AppState = TimeSlice & AudioSlice & TrackSlice & InstrumentSlice & EffectSlice & UISlice & ProjectSlice & ExportSlice;

// --- Store Creator ---

const useStore = create<AppState>()((...a) => ({
    ...createTimeSlice(...a),
    ...createAudioSlice(...a),
    ...createTrackSlice(...a),
    ...createInstrumentSlice(...a),
    ...createEffectSlice(...a),
    ...createUISlice(...a),
    ...createProjectSlice(...a),
    ...createExportSlice(...a),
}));

/**
 * Initializes the Zustand store by loading the last project (if any)
 * from IndexedDB and hydrating the state.
 */
export const initializeStore = async () => {
    console.log("Initializing store...");
    let initialAppState: Partial<AppState> = {};
    let loadedProjectId: string | null = null;
    let projectList: ProjectMetadata[] = [];

    try {
        // 1. Fetch the list of all projects first
        projectList = await P.getProjectMetadataList();

        // 2. Get the ID of the last loaded project
        loadedProjectId = await P.getCurrentProjectId();

        if (loadedProjectId) {
            console.log(`Attempting to load last project: ${loadedProjectId}`);
            const persistedState = await P.loadFullProject(loadedProjectId);

            if (persistedState) {
                console.log("Project loaded successfully, hydrating state.");
                // 3a. Hydrate state from loaded project

                // Map ProjectSettings to relevant slices
                initialAppState = {
                    ...initialAppState,
                    bpm: persistedState.projectSettings.bpm,
                    isPlaying: false, // Start paused regardless of saved state
                    loopEnabled: persistedState.projectSettings.loopEnabled,
                    loopStartBeat: persistedState.projectSettings.loopStartBeat,
                    loopEndBeat: persistedState.projectSettings.loopEndBeat,
                    numMeasures: persistedState.projectSettings.numMeasures,
                    isInstrumentSidebarVisible: persistedState.projectSettings.isInstrumentSidebarVisible,
                    selectedWindow: persistedState.projectSettings.selectedWindow as SelectedWindowType,
                    // Reset selections
                    selectedTrackId: null,
                    selectedBlockId: null,
                    selectedNotes: null,
                };

                // Map and deserialize tracks
                const hydratedTracks = persistedState.tracks.map(trackData => {
                    // Deserialize Synth
                    const synthInstance = trackData.synth 
                        ? deserializeSynth(trackData.synth)
                        : null; // Or load default synth?
                    
                    // Deserialize Effects
                    const effectInstances = trackData.effects
                        .map(effectData => deserializeEffect(effectData))
                        .filter(instance => instance !== null) as EffectInstance[]; // Filter out nulls from failed deserialization

                    // Prepare blocks and notes (they are plain data)
                    const hydratedMidiBlocks = trackData.midiBlocks.map(blockData => ({
                        id: blockData.id,
                        startBeat: blockData.startBeat,
                        endBeat: blockData.endBeat,
                        notes: blockData.notes.map(noteData => ({
                             id: noteData.id,
                             pitch: noteData.pitch,
                             velocity: noteData.velocity,
                             startBeat: noteData.startBeat,
                             duration: noteData.duration,
                        })),
                        // Add any other properties required by MIDIBlock type in lib/types
                        color: 'lightblue', // Example default if not persisted
                        name: '', // Example default
                    }));

                    // Construct the final Track object for the store
                    const hydratedTrack: TrackType = {
                        id: trackData.id,
                        name: trackData.name,
                        midiBlocks: hydratedMidiBlocks,
                        synthesizer: synthInstance!,
                        effects: effectInstances,
                        isMuted: trackData.isMuted,
                        isSoloed: trackData.isSoloed,
                    };
                    return hydratedTrack;
                });

                initialAppState.tracks = hydratedTracks;

            } else {
                console.warn(`Failed to load project data for ID: ${loadedProjectId}. Loading default state.`);
                loadedProjectId = null; // Reset ID if loading failed
                // 3b. Prepare default empty state (mostly handled by create<Slice> defaults)
                initialAppState.tracks = [];
            }
        } else {
            console.log("No last project found. Loading default state.");
             // 3c. Prepare default empty state
             initialAppState.tracks = [];
        }

        // 4. Set the final initial state using default merge behavior
        useStore.setState({
            ...initialAppState, // Apply loaded/default overrides
            projectList: projectList,
            currentLoadedProjectId: loadedProjectId,
            isAudioLoaded: false, // Explicitly set
        }); // REMOVED replace: true
         console.log("Store initialized.", useStore.getState());

        // 5. Post-hydration steps (like setting BPM on TimeManager)
        const finalState = useStore.getState();
        if (finalState.timeManager && finalState.bpm) {
            finalState.timeManager.setBPM(finalState.bpm); // Sync TimeManager BPM
        }

    } catch (error) {
        console.error("Error during store initialization:", error);
        // Set minimal default state on error using default merge behavior
        useStore.setState({ 
             projectList: [], 
             currentLoadedProjectId: null, 
             tracks: [],
             isAudioLoaded: false, 
             // Reset potentially problematic settings
             bpm: 120,
             numMeasures: 8,
             loopEnabled: false,
             isPlaying: false, 
             // etc.
         }); // REMOVED replace: true
    }
};

export default useStore;