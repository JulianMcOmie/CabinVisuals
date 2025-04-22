import { openDatabase, CabinVisualsDBSchema } from './indexedDB';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

// Import types from the app
import { AppState } from '../store/store'; // For loadFullProject return type (or partial state)
import { Track as TrackType, MIDIBlock as ClipType, MIDINote } from '../lib/types';
import EffectInstance from '../lib/Effect';
import SynthesizerInstance from '../lib/Synthesizer';
import { InstrumentDefinition, availableInstrumentsData } from '../store/instrumentSlice';
import { EffectDefinition, availableEffectsData } from '../store/effectSlice';
import { IDBPDatabase } from 'idb';
import {
    ProjectSettingsValue,
    TrackValue,
    TrackSynthValue,
    TrackEffectValue,
    MidiBlockValue,
    MidiNoteValue
} from './indexedDB';

// --- Constructor Mappings (Moved from store.ts) --- 

const synthesizerConstructors = new Map<string, new (...args: any[]) => SynthesizerInstance>();
Object.values(availableInstrumentsData).flat().forEach((inst: InstrumentDefinition) => {
    if (inst.constructor) { 
        synthesizerConstructors.set(inst.constructor.name, inst.constructor);
    }
});

const effectConstructors = new Map<string, new (...args: any[]) => EffectInstance>();
Object.values(availableEffectsData).flat().forEach((effect: EffectDefinition) => {
    if (effect.constructor) { 
        effectConstructors.set(effect.constructor.name, effect.constructor);
    }
});

// --- Helper to apply settings (Adapted from store.ts) --- 
// TODO: Review if this is still the best way or if instances should handle this internally
const applySettings = (instance: any, settings: Record<string, any>) => {
    if (!instance || !settings) return;

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
};

// --- Serialization / Deserialization Helpers --- 

type SerializableSynthData = { type: string, settings: Record<string, any> };
type SerializableEffectData = { type: string, settings: Record<string, any> };

// Gets plain settings object from instance (Adapted from partialize logic)
const getSerializableSettings = (instance: any): Record<string, any> => {
    if (instance && typeof instance.getSettings === 'function') { 
        return instance.getSettings(); 
    }
    // Fallback for older components or those without getSettings
    else if (instance && instance.properties instanceof Map) {
        const settings: Record<string, any> = {};
        instance.properties.forEach((prop: any, key: string) => { 
            // Avoid saving functions or complex objects that aren't plain values
            if (typeof prop.value !== 'function') { 
                try { 
                     // Attempt simple clone to handle potential nested objects/arrays in settings
                     settings[key] = JSON.parse(JSON.stringify(prop.value)); 
                } catch (e) { 
                    console.warn(`Could not stringify/parse property value for key "${key}" on`, instance, e); 
                    settings[key] = prop.value; // Store as-is if clone fails, might cause issues
                }
            } 
        });
        return settings; 
    } 
    console.warn("Could not get serializable settings for", instance);
    return {};
};

export const serializeSynth = (instance: SynthesizerInstance | undefined): SerializableSynthData | undefined => {
    if (!instance) return undefined;
    return {
        type: instance.constructor.name,
        settings: getSerializableSettings(instance)
    };
}

export const deserializeSynth = (data: SerializableSynthData | undefined): SynthesizerInstance | undefined => {
    if (!data) return undefined;
    const SynthConstructor = synthesizerConstructors.get(data.type);
    if (SynthConstructor) {
        try {
            const instance = new SynthConstructor();
            applySettings(instance, data.settings);
            return instance;
        } catch (e) {
            console.error(`Failed to reconstruct synthesizer "${data.type}":`, e);
            return undefined;
        }
    } else {
        console.warn(`Synthesizer constructor not found for type "${data.type}".`);
        return undefined;
    }
};

export const serializeEffect = (instance: EffectInstance): SerializableEffectData => {
    return {
        type: instance.constructor.name,
        settings: getSerializableSettings(instance)
    };
}

export const deserializeEffect = (data: SerializableEffectData): EffectInstance | null => {
    const EffectConstructor = effectConstructors.get(data.type);
    if (EffectConstructor) {
         try {
            const instance = new EffectConstructor();
            applySettings(instance, data.settings);
            return instance;
         } catch (e) {
             console.error(`Failed to reconstruct effect "${data.type}":`, e);
             return null; 
         }
    } else {
        console.warn(`Effect constructor not found for type "${data.type}".`);
        return null; 
    }
};

// --- Persistence Service Functions (Stubs) --- 

// Helper to get DB instance
let dbPromise: Promise<IDBPDatabase<CabinVisualsDBSchema>> | null = null;
const getDb = (): Promise<IDBPDatabase<CabinVisualsDBSchema>> => {
    if (!dbPromise) {
        dbPromise = openDatabase();
    }
    return dbPromise;
};

// == App Config ==
export const getCurrentProjectId = async (): Promise<string | null> => {
    console.log("getCurrentProjectId called (stub)");
    // TODO: Implement IndexedDB read from 'appConfig' store
    const db = await getDb();
    const currentId = await db.get('appConfig', 'currentProjectId');
    return typeof currentId === 'string' ? currentId : null; // Basic check
};

export const setCurrentProjectId = async (projectId: string | null): Promise<void> => {
     console.log(`setCurrentProjectId called with ${projectId} (stub)`);
    // TODO: Implement IndexedDB write to 'appConfig' store
    const db = await getDb();
    if (projectId === null) {
        await db.delete('appConfig', 'currentProjectId');
    } else {
        await db.put('appConfig', projectId, 'currentProjectId'); // Store the string directly
    }
};

// == Project Level ==
export const getProjectMetadataList = async (): Promise<Array<{id: string, name: string}>> => {
    console.log("getProjectMetadataList called (stub)");
    // TODO: Implement IndexedDB readAll from 'projectMetadata' store
    const db = await getDb();
    const allMetadata = await db.getAll('projectMetadata');
    return allMetadata.map(meta => ({ id: meta.id, name: meta.name }));
};

export const createNewProject = async (name: string): Promise<string> => {
     console.log(`createNewProject called with name: ${name} (stub)`);
    const projectId = uuidv4();
    // TODO: 
    // 1. Add to 'projectMetadata'
    // 2. Add default entry to 'projectSettings'
    // 3. Optionally create a default track?
    const db = await getDb();
    const tx = db.transaction(['projectMetadata', 'projectSettings'], 'readwrite');
    const metadataStore = tx.objectStore('projectMetadata');
    const settingsStore = tx.objectStore('projectSettings');

    await metadataStore.add({ id: projectId, name });
    await settingsStore.add({ 
        projectId,
        // Add default settings here
        bpm: 120, 
        isPlaying: false,
        loopEnabled: false,
        loopStartBeat: null,
        loopEndBeat: null,
        numMeasures: 4, // Sensible default?
        isInstrumentSidebarVisible: true,
        selectedWindow: null
    });

    await tx.done;
    console.log(`Created project ${projectId} with name "${name}"`);
    return projectId;
};

export const deleteProject = async (projectId: string): Promise<void> => {
     console.log(`deleteProject called for ${projectId} (stub)`);
    // TODO: Implement cascading delete:
    // 1. Delete from projectMetadata
    // 2. Delete from projectSettings
    // 3. Find all tracks by projectId index
    // 4. For each track, call deleteTrack (which handles cascades)
    // 5. Check if deleted project was the current one, if so, set currentProjectId to null
};

export const renameProject = async (projectId: string, newName: string): Promise<void> => {
     console.log(`renameProject called for ${projectId} to ${newName} (stub)`);
    // TODO: Implement IndexedDB update in 'projectMetadata' store
};

// == Loading ==
// Define the expected return type structure more precisely
// This should contain the parts of AppState that are actually persisted
type LoadedProjectState = Pick<AppState,
    // TimeSlice (subset)
    'bpm' | 'isPlaying' | 'loopEnabled' | 'loopStartBeat' | 'loopEndBeat' | 'numMeasures' |
    // UISlice (subset)
    'isInstrumentSidebarVisible' | 'selectedWindow' |
    // TrackSlice (processed)
    'tracks'
    // We don't load TimeManager, AudioContext, etc. directly
>;

// Replace the existing stub for loadFullProject
export const loadFullProject = async (projectId: string): Promise<Partial<LoadedProjectState> | null> => {
    console.log(`loadFullProject called for ${projectId}`);
    const db = await getDb();
    const tx = db.transaction([
        'projectSettings',
        'tracks',
        'trackSynths',
        'trackEffects',
        'midiBlocks',
        'midiNotes'
    ], 'readonly'); // Readonly transaction

    const settingsStore = tx.objectStore('projectSettings');
    const trackStore = tx.objectStore('tracks');
    const synthStore = tx.objectStore('trackSynths');
    const effectStore = tx.objectStore('trackEffects');
    const blockStore = tx.objectStore('midiBlocks');
    const noteStore = tx.objectStore('midiNotes');

    try {
        // 1. Get projectSettings
        const projectSettings = await settingsStore.get(projectId);
        if (!projectSettings) {
            console.error(`Project settings not found for projectId: ${projectId}`);
            await tx.done; // Ensure transaction closes
            return null;
        }

        // 2. Get all tracks using 'by-projectId' index
        const trackMetadataList = await trackStore.index('by-projectId').getAll(projectId);

        // 3. For each track, assemble its full data
        const loadedTracks: TrackType[] = [];
        for (const trackMeta of trackMetadataList) {
            const trackId = trackMeta.id;

            // 3a. Get synth
            const synthData = await synthStore.get(trackId);
            const synthesizer = deserializeSynth(synthData); // Handles undefined data

            // 3b. Get effects (sorted)
            const effectDataList = await effectStore.index('by-trackId').getAll(trackId);
            effectDataList.sort((a, b) => a.order - b.order); // Ensure correct order
            const effects = effectDataList
                .map(deserializeEffect)
                .filter((effect): effect is EffectInstance => effect !== null);

            // 3c/d. Get blocks and their notes
            const blockDataList = await blockStore.index('by-trackId').getAll(trackId);
            const midiBlocks: ClipType[] = [];

            for (const blockMeta of blockDataList) {
                const blockId = blockMeta.id;
                const noteDataList = await noteStore.index('by-blockId').getAll(blockId);
                // Map MidiNoteValue to MIDINote (ensure property names match)
                 const notes: MIDINote[] = noteDataList.map(noteData => ({
                    id: noteData.id,
                    pitch: noteData.pitch,
                    velocity: noteData.velocity,
                    startBeat: noteData.startBeat,
                    duration: noteData.duration,
                    // blockId is implicit, not usually stored directly on MIDINote type
                 }));

                midiBlocks.push({
                    id: blockMeta.id,
                    trackId: blockMeta.trackId, // Make sure ClipType includes trackId if needed elsewhere
                    startBeat: blockMeta.startBeat,
                    endBeat: blockMeta.endBeat,
                    notes: notes,
                });
            }

            // Assemble the track
            loadedTracks.push({
                id: trackMeta.id,
                name: trackMeta.name,
                isMuted: trackMeta.isMuted,
                isSoloed: trackMeta.isSoloed,
                synthesizer: synthesizer,
                effects: effects,
                midiBlocks: midiBlocks,
                // Add other TrackType properties if they exist and need default values
            });
        }

        // 5. Assemble the final state object
        const loadedState: Partial<LoadedProjectState> = {
            // Project Settings -> TimeSlice/UISlice parts
            bpm: projectSettings.bpm,
            isPlaying: projectSettings.isPlaying, // Or should this always default to false?
            loopEnabled: projectSettings.loopEnabled,
            loopStartBeat: projectSettings.loopStartBeat,
            loopEndBeat: projectSettings.loopEndBeat,
            numMeasures: projectSettings.numMeasures,
            isInstrumentSidebarVisible: projectSettings.isInstrumentSidebarVisible,
            selectedWindow: projectSettings.selectedWindow,
            // Assembled tracks
            tracks: loadedTracks,
        };

        await tx.done; // Wait for transaction to complete
        console.log(`Successfully loaded data for project ${projectId}`);
        return loadedState;

    } catch (error) {
        console.error(`Error loading project ${projectId}:`, error);
        // Attempt to close transaction on error, though it might already be aborted
        if (tx.error) {
            console.error("Transaction error:", tx.error)
        } else {
             try { await tx.done; } catch {} // Silence errors on explicit abort attempt after failure
        }
        return null; // Indicate failure
    }
};

// == Saving / Updating (Triggered by Actions) ==

// Example: Save project-level settings (like BPM, loop points etc.)
export const saveProjectSettings = async (projectId: string, settings: Partial<ProjectSettingsValue>): Promise<void> => {
     console.log(`saveProjectSettings called for ${projectId} (stub)`, settings);
     // TODO: Implement IndexedDB put/update in 'projectSettings' store
};

// Example: Save a complete track's metadata (called when track added or props like name/mute/solo change)
export const saveTrackMetadata = async (trackData: TrackValue): Promise<void> => {
     console.log(`saveTrackMetadata called (stub)`, trackData);
     // TODO: Implement IndexedDB put in 'tracks' store (add or update)
};

// Save JUST the synth for a track (called when synth added or settings change)
export const saveSynth = async (trackId: string, synthInstance: SynthesizerInstance | undefined): Promise<void> => {
     console.log(`saveSynth called for track ${trackId} (stub)`);
     const serializableData = serializeSynth(synthInstance);
     // TODO: Implement IndexedDB put in 'trackSynths' store
     // If serializableData is undefined, maybe delete the entry?
};

// Save JUST an effect (called when effect added, order changed, or settings change)
export const saveEffect = async (effectData: TrackEffectValue): Promise<void> => {
     console.log(`saveEffect called (stub)`, effectData);
     // Note: effectData needs *serialized* settings. The caller (store action) should handle this.
     // TODO: Implement IndexedDB put in 'trackEffects' store
};

// Save JUST a block (called when block added or start/end beats change)
export const saveMidiBlock = async (blockData: MidiBlockValue): Promise<void> => {
     console.log(`saveMidiBlock called (stub)`, blockData);
     // TODO: Implement IndexedDB put in 'midiBlocks' store
};

// Save JUST a note (called when note added or properties change)
export const saveMidiNote = async (noteData: MidiNoteValue): Promise<void> => {
     console.log(`saveMidiNote called (stub)`, noteData);
     // TODO: Implement IndexedDB put in 'midiNotes' store
};

// == Deleting Granular Data ==

export const deleteTrack = async (trackId: string): Promise<void> => {
     console.log(`deleteTrack called for ${trackId} (stub)`);
    // TODO: Implement cascading delete:
    // 1. Delete synth from 'trackSynths'
    // 2. Find and delete all effects using 'by-trackId' index
    // 3. Find all blocks using 'by-trackId' index
    // 4. For each block, call deleteMidiBlock (which deletes notes)
    // 5. Delete track from 'tracks' store
};

export const deleteEffect = async (effectId: string): Promise<void> => {
     console.log(`deleteEffect called for ${effectId} (stub)`);
     // TODO: Implement IndexedDB delete from 'trackEffects' store
};

export const deleteMidiBlock = async (blockId: string): Promise<void> => {
     console.log(`deleteMidiBlock called for ${blockId} (stub)`);
    // TODO: Implement cascading delete:
    // 1. Find and delete all notes using 'by-blockId' index
    // 2. Delete block from 'midiBlocks' store
};

export const deleteMidiNote = async (noteId: string): Promise<void> => {
     console.log(`deleteMidiNote called for ${noteId} (stub)`);
     // TODO: Implement IndexedDB delete from 'midiNotes' store
}; 