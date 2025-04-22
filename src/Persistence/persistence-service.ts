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

export const renameProject = async (projectId: string, newName: string): Promise<void> => {
     console.log(`renameProject called for ${projectId} to ${newName}`);
     const db = await getDb();
     const tx = db.transaction('projectMetadata', 'readwrite');
     const store = tx.objectStore('projectMetadata');
     try {
         const metadata = await store.get(projectId);
         if (!metadata) {
             throw new Error(`Project metadata not found for ID: ${projectId}`);
         }
         const updatedMetadata = { ...metadata, name: newName };
         await store.put(updatedMetadata);
         await tx.done;
         console.log(`Renamed project ${projectId} to "${newName}"`);
     } catch (error) {
         console.error(`Failed to rename project ${projectId}:`, error);
         if (!tx.done) { try { await tx.done; } catch {} }
         throw error;
     }
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

// Save project-level settings (like BPM, loop points etc.)
export const saveProjectSettings = async (projectId: string, settings: Partial<ProjectSettingsValue>): Promise<void> => {
     console.log(`saveProjectSettings called for ${projectId}`, settings);
     const db = await getDb();
     const tx = db.transaction('projectSettings', 'readwrite');
     const store = tx.objectStore('projectSettings');
     try {
        const existingSettings = await store.get(projectId);
        if (!existingSettings) {
             console.error(`Cannot save settings for non-existent project: ${projectId}`);
             // Optionally create default settings if needed? For now, just error.
             throw new Error(`Project settings not found for ID: ${projectId}`);
        }
        // Merge partial settings onto existing settings
        const updatedSettings = { ...existingSettings, ...settings, projectId }; // Ensure projectId is preserved
        await store.put(updatedSettings);
        await tx.done;
        console.log(`Saved project settings for ${projectId}`);
     } catch (error) {
         console.error(`Failed to save project settings for ${projectId}:`, error);
         if (!tx.done) { try { await tx.done; } catch {} } // Ensure transaction closes on error
         throw error; // Re-throw to allow action to handle it
     }
};

// Save a complete track's metadata (called when track added or props like name/mute/solo change)
export const saveTrackMetadata = async (trackData: TrackValue): Promise<void> => {
     console.log(`saveTrackMetadata called`, trackData);
     const db = await getDb();
     try {
        await db.put('tracks', trackData);
        console.log(`Saved track metadata for ${trackData.id}`);
     } catch (error) {
          console.error(`Failed to save track metadata for ${trackData.id}:`, error);
          throw error;
     }
};

// Save JUST the synth for a track (called when synth added or settings change)
export const saveSynth = async (trackId: string, synthInstance: SynthesizerInstance | undefined): Promise<void> => {
     console.log(`saveSynth called for track ${trackId}`);
     const serializableData = serializeSynth(synthInstance);
     const db = await getDb();
     try {
        if (serializableData) {
            // Map SerializableSynthData to TrackSynthValue
            const synthValue: TrackSynthValue = { trackId, ...serializableData };
            await db.put('trackSynths', synthValue);
             console.log(`Saved synth for track ${trackId}`);
        } else {
            // If synthInstance is undefined, delete the entry
            await db.delete('trackSynths', trackId);
            console.log(`Deleted synth for track ${trackId}`);
        }
     } catch (error) {
          console.error(`Failed to save/delete synth for track ${trackId}:`, error);
          throw error;
     }
};

// Save JUST an effect (called when effect added, order changed, or settings change)
// Note: Caller must provide the *full* TrackEffectValue including serialized settings and order
export const saveEffect = async (effectData: TrackEffectValue): Promise<void> => {
     console.log(`saveEffect called for effect ${effectData.id}`, effectData);
     const db = await getDb();
     try {
         // The effectData should already contain the serialized settings
         // as built by the calling action (using serializeEffect if needed)
        await db.put('trackEffects', effectData);
        console.log(`Saved effect ${effectData.id} for track ${effectData.trackId}`);
     } catch (error) {
         console.error(`Failed to save effect ${effectData.id}:`, error);
         throw error;
     }
};

// Save JUST a block (called when block added or start/end beats change)
export const saveMidiBlock = async (blockData: MidiBlockValue): Promise<void> => {
     console.log(`saveMidiBlock called for block ${blockData.id}`, blockData);
     const db = await getDb();
     try {
        await db.put('midiBlocks', blockData);
        console.log(`Saved MIDI block ${blockData.id} for track ${blockData.trackId}`);
     } catch (error) {
         console.error(`Failed to save MIDI block ${blockData.id}:`, error);
         throw error;
     }
};

// Save JUST a note (called when note added or properties change)
export const saveMidiNote = async (noteData: MidiNoteValue): Promise<void> => {
     console.log(`saveMidiNote called for note ${noteData.id}`, noteData);
     const db = await getDb();
     try {
        await db.put('midiNotes', noteData);
        console.log(`Saved MIDI note ${noteData.id} for block ${noteData.blockId}`);
     } catch (error) {
          console.error(`Failed to save MIDI note ${noteData.id}:`, error);
          throw error;
     }
};

// == Deleting Granular Data ==

export const deleteMidiNote = async (noteId: string): Promise<void> => {
     console.log(`deleteMidiNote called for ${noteId}`);
     const db = await getDb();
     try {
        await db.delete('midiNotes', noteId);
        console.log(`Deleted MIDI note ${noteId}`);
     } catch (error) {
          console.error(`Failed to delete MIDI note ${noteId}:`, error);
          throw error;
     }
};

export const deleteMidiBlock = async (blockId: string): Promise<void> => {
     console.log(`deleteMidiBlock called for ${blockId}`);
     const db = await getDb();
     const tx = db.transaction(['midiBlocks', 'midiNotes'], 'readwrite');
     const blockStore = tx.objectStore('midiBlocks');
     const noteStore = tx.objectStore('midiNotes');
     const noteIndex = noteStore.index('by-blockId');

     try {
         // 1. Find and delete all associated notes
         let noteCursor = await noteIndex.openKeyCursor(blockId);
         while (noteCursor) {
             await noteStore.delete(noteCursor.primaryKey);
             console.log(`  > Deleted note ${noteCursor.primaryKey} for block ${blockId}`);
             noteCursor = await noteCursor.continue();
         }

         // 2. Delete the block itself
         await blockStore.delete(blockId);

         await tx.done;
         console.log(`Deleted MIDI block ${blockId} and its notes`);
     } catch (error) {
         console.error(`Failed to delete MIDI block ${blockId}:`, error);
         if (!tx.done) { try { await tx.done; } catch {} }
         throw error;
     }
};

export const deleteEffect = async (effectId: string): Promise<void> => {
     console.log(`deleteEffect called for ${effectId}`);
     const db = await getDb();
     try {
        await db.delete('trackEffects', effectId);
        console.log(`Deleted effect ${effectId}`);
     } catch (error) {
         console.error(`Failed to delete effect ${effectId}:`, error);
         throw error;
     }
};

export const deleteTrack = async (trackId: string): Promise<void> => {
     console.log(`deleteTrack called for ${trackId}`);
     const db = await getDb();
     // Need to transact over all stores involved in the cascade
     const tx = db.transaction([
         'tracks',
         'trackSynths',
         'trackEffects',
         'midiBlocks',
         'midiNotes' // Include midiNotes for block deletion cascade
        ], 'readwrite');

     const trackStore = tx.objectStore('tracks');
     const synthStore = tx.objectStore('trackSynths');
     const effectStore = tx.objectStore('trackEffects');
     const blockStore = tx.objectStore('midiBlocks');
     // Note store access is handled within deleteMidiBlock implicitly via transaction

     const effectIndex = effectStore.index('by-trackId');
     const blockIndex = blockStore.index('by-trackId');

     try {
         // 1. Delete synth
         // Use delete, ignore error if not found (idempotent)
         await synthStore.delete(trackId).catch(() => {}); 
         console.log(`  > Deleted synth for track ${trackId}`);

         // 2. Find and delete all effects
         let effectCursor = await effectIndex.openKeyCursor(trackId);
         while(effectCursor) {
             await effectStore.delete(effectCursor.primaryKey);
             console.log(`  > Deleted effect ${effectCursor.primaryKey} for track ${trackId}`);
             effectCursor = await effectCursor.continue();
         }

         // 3. Find all blocks
         const blockKeys = await blockIndex.getAllKeys(trackId);
         
         // 4. For each block, call deleteMidiBlock (within the same transaction)
         // Note: deleteMidiBlock needs to be adapted to accept the transaction stores
         // Let's re-implement block/note deletion inline here for simplicity within one transaction
         const noteStoreForBlock = tx.objectStore('midiNotes');
         const noteIndexForBlock = noteStoreForBlock.index('by-blockId');
         for (const blockId of blockKeys) {
             console.log(`  > Deleting block ${blockId} and its notes...`);
             let noteCursor = await noteIndexForBlock.openKeyCursor(blockId);
             while (noteCursor) {
                 await noteStoreForBlock.delete(noteCursor.primaryKey);
                 console.log(`    >> Deleted note ${noteCursor.primaryKey}`);
                 noteCursor = await noteCursor.continue();
             }
             await blockStore.delete(blockId);
             console.log(`  > Deleted block ${blockId}`);
         }

         // 5. Delete track metadata itself
         await trackStore.delete(trackId);

         await tx.done;
         console.log(`Deleted track ${trackId} and all associated data`);
     } catch (error) {
         console.error(`Failed to delete track ${trackId}:`, error);
         if (!tx.done) { try { await tx.done; } catch {} }
         throw error;
     }
};

export const deleteProject = async (projectId: string): Promise<void> => {
     console.log(`deleteProject called for ${projectId}`);
     const db = await getDb();
     // Transaction needs to cover all potentially affected stores
      const tx = db.transaction([
         'projectMetadata',
         'projectSettings',
         'tracks', // Needed for track index query
         // Include stores needed by deleteTrack cascade:
         'trackSynths',
         'trackEffects',
         'midiBlocks',
         'midiNotes'
        ], 'readwrite');

     const metadataStore = tx.objectStore('projectMetadata');
     const settingsStore = tx.objectStore('projectSettings');
     const trackStore = tx.objectStore('tracks'); // Only need index access here
     // References to other stores are implicitly handled by deleteTrack within the transaction

     try {
         // 3. Find all tracks by projectId index
         const trackIndex = trackStore.index('by-projectId');
         const trackKeys = await trackIndex.getAllKeys(projectId);

         // 4. For each track key, call deleteTrack (adapted to run within current tx)
         // Re-implement deleteTrack logic inline here to stay within one transaction
         const synthStoreDel = tx.objectStore('trackSynths');
         const effectStoreDel = tx.objectStore('trackEffects');
         const blockStoreDel = tx.objectStore('midiBlocks');
         const noteStoreDel = tx.objectStore('midiNotes');
         const trackStoreDel = tx.objectStore('tracks'); // Actual track store for delete
         const effectIndexDel = effectStoreDel.index('by-trackId');
         const blockIndexDel = blockStoreDel.index('by-trackId');
         const noteIndexDel = noteStoreDel.index('by-blockId');

         for (const trackId of trackKeys) {
            console.log(`  Deleting track ${trackId} as part of project delete...`);
            // Delete synth
            await synthStoreDel.delete(trackId).catch(() => {});
            // Delete effects
            let effectCursor = await effectIndexDel.openKeyCursor(trackId);
            while(effectCursor) {
                await effectStoreDel.delete(effectCursor.primaryKey);
                effectCursor = await effectCursor.continue();
            }
            // Delete blocks and notes
            const blockKeysForTrack = await blockIndexDel.getAllKeys(trackId);
            for (const blockId of blockKeysForTrack) {
                 let noteCursor = await noteIndexDel.openKeyCursor(blockId);
                 while (noteCursor) {
                     await noteStoreDel.delete(noteCursor.primaryKey);
                     noteCursor = await noteCursor.continue();
                 }
                 await blockStoreDel.delete(blockId);
            }
            // Delete track metadata
            await trackStoreDel.delete(trackId);
            console.log(`  Deleted track ${trackId} data.`);
         }

         // 1. Delete from projectSettings
         await settingsStore.delete(projectId).catch(() => {}); // Ignore if not found

         // 2. Delete from projectMetadata
         await metadataStore.delete(projectId);
         
         // 5. Check if deleted project was the current one (handled in ProjectSlice action)

         await tx.done;
         console.log(`Deleted project ${projectId} and all associated data`);

     } catch (error) {
          console.error(`Failed to delete project ${projectId}:`, error);
         if (!tx.done) { try { await tx.done; } catch {} }
         throw error;
     }
}; 