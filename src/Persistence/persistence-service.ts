import { v4 as uuidv4 } from 'uuid';
import Synthesizer from '../lib/Synthesizer';
import Effect from '../lib/Effect';
import { applySettings } from './persistenceUtils';

import { synthesizerConstructors, effectConstructors } from '../store/store';

// --- Define Interfaces ---

export interface ProjectMetadata {
    id: string;
    name: string;
}

export interface ProjectSettings {
    bpm: number;
    isPlaying: boolean;
    loopEnabled: boolean;
    loopStartBeat: number | null;
    loopEndBeat: number | null;
    numMeasures: number;
    isInstrumentSidebarVisible: boolean;
    selectedWindow: string | null;
}

export interface TrackData {
    id: string;
    projectId: string;
    name: string;
    isMuted: boolean;
    isSolo: boolean;
}


// --- IndexedDB Configuration ---

const DB_NAME = 'CabinVisualsDB';
const DB_VERSION = 1;

const STORE_APP_CONFIG = 'appConfig';
const STORE_PROJECT_METADATA = 'projectMetadata';
const STORE_PROJECT_SETTINGS = 'projectSettings';
const STORE_TRACKS = 'tracks';
const STORE_TRACK_SYNTHS = 'trackSynths';
const STORE_TRACK_EFFECTS = 'trackEffects';
const STORE_MIDI_BLOCKS = 'midiBlocks';
const STORE_MIDI_NOTES = 'midiNotes';

const IDX_PROJECT_ID = 'projectId';
const IDX_TRACK_ID = 'trackId';
const IDX_BLOCK_ID = 'blockId';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
    if (dbPromise) {
        return dbPromise;
    }
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", request.error);
            reject("Error opening database");
        };

        request.onsuccess = (event) => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = request.result;
            console.log(`Upgrading database from version ${event.oldVersion} to ${event.newVersion}`);

            if (!db.objectStoreNames.contains(STORE_APP_CONFIG)) {
                db.createObjectStore(STORE_APP_CONFIG); // Key is config key string
            }
            if (!db.objectStoreNames.contains(STORE_PROJECT_METADATA)) {
                db.createObjectStore(STORE_PROJECT_METADATA, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_PROJECT_SETTINGS)) {
                db.createObjectStore(STORE_PROJECT_SETTINGS, { keyPath: 'projectId' });
            }
            if (!db.objectStoreNames.contains(STORE_TRACKS)) {
                const trackStore = db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
                trackStore.createIndex(IDX_PROJECT_ID, 'projectId', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_TRACK_SYNTHS)) {
                db.createObjectStore(STORE_TRACK_SYNTHS, { keyPath: 'trackId' });
            }
            if (!db.objectStoreNames.contains(STORE_TRACK_EFFECTS)) {
                const effectStore = db.createObjectStore(STORE_TRACK_EFFECTS, { keyPath: 'id' });
                effectStore.createIndex(IDX_TRACK_ID, 'trackId', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_MIDI_BLOCKS)) {
                const blockStore = db.createObjectStore(STORE_MIDI_BLOCKS, { keyPath: 'id' });
                blockStore.createIndex(IDX_TRACK_ID, 'trackId', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_MIDI_NOTES)) {
                const noteStore = db.createObjectStore(STORE_MIDI_NOTES, { keyPath: 'id' });
                noteStore.createIndex(IDX_BLOCK_ID, 'blockId', { unique: false });
            }
        };
    });
    return dbPromise;
}

// Helper to perform DB operations
async function performDbOperation<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
    const db = await getDb();
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        operation(store)
            .then(resolve)
            .catch(reject);

        transaction.oncomplete = () => {
            console.log(`Transaction complete on ${storeName}`);
        };
        transaction.onerror = () => {
            console.error(`Transaction error on ${storeName}:`, transaction.error);
            reject(transaction.error);
        };
    });
}

// Helper for operations involving multiple stores
async function performMultiStoreDbOperation<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    operation: (transaction: IDBTransaction) => Promise<T>
): Promise<T> {
    const db = await getDb();
    const transaction = db.transaction(storeNames, mode);
    return new Promise((resolve, reject) => {
        operation(transaction)
            .then(resolve)
            .catch(reject);

        transaction.oncomplete = () => {
            console.log(`Multi-store transaction complete on ${storeNames.join(', ')}`);
        };
        transaction.onerror = () => {
            console.error(`Multi-store transaction error on ${storeNames.join(', ')}:`, transaction.error);
            reject(transaction.error);
        };
    });
}


// --- Persistence Service API ---

// --- Project Level ---

export async function getProjectMetadataList(): Promise<Array<{ id: string; name: string }>> {
    return performDbOperation(STORE_PROJECT_METADATA, 'readonly', store => {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

export async function createNewProject(name: string): Promise<string> {
    const projectId = uuidv4();
    const metadata = { id: projectId, name: name || "Untitled Project" };

    await performDbOperation(STORE_PROJECT_METADATA, 'readwrite', store => {
        return new Promise((resolve, reject) => {
             const request = store.add(metadata);
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
        });
    });
     
     await saveProjectSettings(projectId, {
        bpm: 120,
        isPlaying: false,
        loopEnabled: false,
        loopStartBeat: null,
        loopEndBeat: null,
        numMeasures: 16,
        isInstrumentSidebarVisible: true,
        selectedWindow: null,
     });
    return projectId;
}

export async function deleteProject(projectId: string): Promise<void> {
    console.warn("deleteProject not fully implemented - cascading deletes needed");
     // TODO: Implement cascading deletes:
     // 1. Get all tracks for the project
     // 2. For each track, call deleteTrack (which cascades further)
     // 3. Delete project settings
     // 4. Delete project metadata
     // 5. If it was the current project, clear current project ID in appConfig
     await performMultiStoreDbOperation(
        [STORE_PROJECT_METADATA, STORE_PROJECT_SETTINGS /*, add other stores */],
        'readwrite',
        async (transaction) => {
            const metaStore = transaction.objectStore(STORE_PROJECT_METADATA);
            const settingsStore = transaction.objectStore(STORE_PROJECT_SETTINGS);
            // ... get other stores ...

            // Example delete - needs cascading logic added
             await new Promise<void>((resolve, reject) => {
                 const req1 = metaStore.delete(projectId);
                 req1.onsuccess = () => resolve();
                 req1.onerror = () => reject(req1.error);
             });
             await new Promise<void>((resolve, reject) => {
                 const req2 = settingsStore.delete(projectId);
                 req2.onsuccess = () => resolve(req2.result);
                 req2.onerror = () => reject(req2.error);
             });
        }
     );
}


export async function renameProject(projectId: string, newName: string): Promise<void> {
     await performDbOperation(STORE_PROJECT_METADATA, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const getRequest = store.get(projectId);
             getRequest.onsuccess = () => {
                 const data = getRequest.result;
                 if (data) {
                     data.name = newName;
                     const putRequest = store.put(data);
                     putRequest.onsuccess = () => resolve(putRequest.result);
                     putRequest.onerror = () => reject(putRequest.error);
                 } else {
                     reject("Project not found");
                 }
             };
             getRequest.onerror = () => reject(getRequest.error);
         });
     });
}

export async function getCurrentProjectId(): Promise<string | null> {
    return performDbOperation(STORE_APP_CONFIG, 'readonly', store => {
        return new Promise((resolve, reject) => {
            const request = store.get('currentProjectId');
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    });
}

export async function setCurrentProjectId(projectId: string | null): Promise<void> {
    await performDbOperation(STORE_APP_CONFIG, 'readwrite', store => {
        return new Promise((resolve, reject) => {
            const request = store.put(projectId, 'currentProjectId');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

// --- Loading ---

export async function loadFullProject(projectId: string): Promise<any | null> {
    // This needs to load data from:
    // projectSettings, tracks (filtered by projectId), trackSynths,
    // trackEffects (filtered by trackId), midiBlocks (filtered by trackId),
    // midiNotes (filtered by blockId)
    // Then assemble into an object suitable for hydrating Zustand state
    console.warn("loadFullProject not implemented");
    // Placeholder:
    return null;
}

// --- Saving/Updating ---

export async function saveProjectSettings(projectId: string, settings: ProjectSettings): Promise<void> {
     await performDbOperation(STORE_PROJECT_SETTINGS, 'readwrite', store => {
         return new Promise((resolve, reject) => {
            const dataToSave = { ...settings, projectId };
             const request = store.put(dataToSave);
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}


export async function saveTrack(trackData: TrackData): Promise<void> {
     await performDbOperation(STORE_TRACKS, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.put(trackData); // Assumes trackData has 'id' property
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}

export async function saveSynth(trackId: string, synthData: { type: string; settings: Record<string, any> }): Promise<void> {
     const dataToSave = { ...synthData, trackId };
     await performDbOperation(STORE_TRACK_SYNTHS, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.put(dataToSave);
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}

export async function saveEffect(effectData: any): Promise<void> {
    console.warn("saveEffect not fully implemented");
    // effectData should match the structure in STORE_TRACK_EFFECTS, including id, trackId, etc.
     await performDbOperation(STORE_TRACK_EFFECTS, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.put(effectData); // Assumes effectData has 'id' property
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}

export async function saveMidiBlock(blockData: any): Promise<void> {
    console.warn("saveMidiBlock not fully implemented");
    // blockData should match the structure in STORE_MIDI_BLOCKS, including id, trackId, etc.
     await performDbOperation(STORE_MIDI_BLOCKS, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.put(blockData); // Assumes blockData has 'id' property
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}

export async function saveMidiNote(noteData: any): Promise<void> {
    console.warn("saveMidiNote not fully implemented");
    // noteData should match the structure in STORE_MIDI_NOTES, including id, blockId, etc.
     await performDbOperation(STORE_MIDI_NOTES, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.put(noteData); // Assumes noteData has 'id' property
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}


// --- Deleting Granular Data ---

export async function deleteTrack(trackId: string): Promise<void> {
    console.warn("deleteTrack not fully implemented - cascading deletes needed");
    // TODO: Cascade delete: synth, effects, blocks (which cascades to notes)
    await performMultiStoreDbOperation(
        [STORE_TRACKS, STORE_TRACK_SYNTHS /*, add others */],
        'readwrite',
        async (transaction) => {
            // Example delete - needs cascading logic
            await new Promise<void>((resolve, reject) => {
                const req = transaction.objectStore(STORE_TRACKS).delete(trackId);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
            await new Promise<void>((resolve, reject) => {
                 const req = transaction.objectStore(STORE_TRACK_SYNTHS).delete(trackId);
                 req.onsuccess = () => resolve();
                 req.onerror = () => reject(req.error);
             });
        }
    );
}

export async function deleteEffect(effectId: string): Promise<void> {
    console.warn("deleteEffect not fully implemented");
     await performDbOperation(STORE_TRACK_EFFECTS, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.delete(effectId);
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}

export async function deleteMidiBlock(blockId: string): Promise<void> {
    console.warn("deleteMidiBlock not fully implemented - cascading deletes needed");
    // TODO: Cascade delete notes within the block first
     await performMultiStoreDbOperation(
        [STORE_MIDI_BLOCKS /*, STORE_MIDI_NOTES */],
        'readwrite',
        async (transaction) => {
            // Example delete - needs cascading logic
            await new Promise<void>((resolve, reject) => {
                 const req = transaction.objectStore(STORE_MIDI_BLOCKS).delete(blockId);
                 req.onsuccess = () => resolve(req.result);
                 req.onerror = () => reject(req.error);
             });
        }
     );
}

export async function deleteMidiNote(noteId: string): Promise<void> {
     await performDbOperation(STORE_MIDI_NOTES, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.delete(noteId);
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}