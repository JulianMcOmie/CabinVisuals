import { v4 as uuidv4 } from 'uuid';


// --- Define Interfaces ---

export interface ProjectMetadata {
    id: string;
    name: string;
}

export interface ProjectSettings {
    projectId: string;
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
    isSoloed: boolean;
    order: number;
}

export interface SynthData {
    trackId: string;
    type: string;
    settings: Record<string, any>;
}

export interface EffectData {
    id: string;
    trackId: string;
    type: string;
    settings: Record<string, any>;
    order: number;
}

export interface MidiBlockData {
    id: string;
    trackId: string;
    startBeat: number;
    endBeat: number;
}

export interface MidiNoteData {
    id: string;
    blockId: string;
    startBeat: number;
    duration: number;
    velocity: number;
    pitch: number;
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
                db.createObjectStore(STORE_APP_CONFIG);
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
     
     await saveProjectSettings({
        projectId: projectId,
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
     const allStores = [
         STORE_PROJECT_METADATA,
         STORE_PROJECT_SETTINGS,
         STORE_TRACKS,
         STORE_TRACK_SYNTHS,
         STORE_TRACK_EFFECTS,
         STORE_MIDI_BLOCKS,
         STORE_MIDI_NOTES,
         STORE_APP_CONFIG // Include app config to check current project ID
     ];

     await performMultiStoreDbOperation(allStores, 'readwrite', async (transaction) => {
         const metaStore = transaction.objectStore(STORE_PROJECT_METADATA);
         const settingsStore = transaction.objectStore(STORE_PROJECT_SETTINGS);
         const tracksStore = transaction.objectStore(STORE_TRACKS);
         const synthsStore = transaction.objectStore(STORE_TRACK_SYNTHS);
         const effectsStore = transaction.objectStore(STORE_TRACK_EFFECTS);
         const blocksStore = transaction.objectStore(STORE_MIDI_BLOCKS);
         const notesStore = transaction.objectStore(STORE_MIDI_NOTES);
         const appConfigStore = transaction.objectStore(STORE_APP_CONFIG);

         const tracksIndex = tracksStore.index(IDX_PROJECT_ID);
         const blocksIndex = blocksStore.index(IDX_TRACK_ID);
         const effectsIndex = effectsStore.index(IDX_TRACK_ID);
         const notesIndex = notesStore.index(IDX_BLOCK_ID);

         const deletePromises: Promise<any>[] = [];

         // 1. Find all tracks for the project
         const trackIds = await promisifyRequest(tracksIndex.getAllKeys(projectId));

         // 2. For each track, cascade delete its related data
         for (const trackId of trackIds) {
             // Delete notes within blocks
             const blockIds = await promisifyRequest(blocksIndex.getAllKeys(trackId));
             for (const blockId of blockIds) {
                 const noteIds = await promisifyRequest(notesIndex.getAllKeys(blockId));
                 noteIds.forEach(noteId => {
                     deletePromises.push(promisifyRequestSimple(notesStore.delete(noteId)));
                 });
                 // Delete the block
                 deletePromises.push(promisifyRequestSimple(blocksStore.delete(blockId)));
             }

             // Delete effects
             const effectIds = await promisifyRequest(effectsIndex.getAllKeys(trackId));
             effectIds.forEach(effectId => {
                 deletePromises.push(promisifyRequestSimple(effectsStore.delete(effectId)));
             });
             // Delete synths
             deletePromises.push(promisifyRequestSimple(synthsStore.delete(trackId)));

             // Finally, delete tracks
             deletePromises.push(promisifyRequestSimple(tracksStore.delete(trackId)));
         }

         // Delete project settings
         deletePromises.push(promisifyRequestSimple(settingsStore.delete(projectId)));

         // Delete project metadata
         deletePromises.push(promisifyRequestSimple(metaStore.delete(projectId)));

         // 5. Check and clear current project ID if it matches the deleted project
         const currentProjectId = await promisifyRequest(appConfigStore.get('currentProjectId'));
         if (currentProjectId === projectId) {
             deletePromises.push(promisifyRequestSimple(appConfigStore.put(null, 'currentProjectId')));
         }

         await Promise.all(deletePromises);
     });

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

export async function saveProjectSettings(projectSettingsData: ProjectSettings): Promise<void> {
     await performDbOperation(STORE_PROJECT_SETTINGS, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.put(projectSettingsData);
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}


export async function saveTrack(trackData: TrackData): Promise<void> {
     await performDbOperation(STORE_TRACKS, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.put(trackData);
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}

export async function saveSynth(synthData: SynthData): Promise<void> {
     await performDbOperation(STORE_TRACK_SYNTHS, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.put(synthData);
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}

export async function saveEffect(effectData: EffectData): Promise<void> {
     await performDbOperation(STORE_TRACK_EFFECTS, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.put(effectData);
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}

export async function saveMidiBlock(blockData: MidiBlockData): Promise<void> {
     await performDbOperation(STORE_MIDI_BLOCKS, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.put(blockData);
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}

export async function saveMidiNote(noteData: MidiNoteData): Promise<void> {
     await performDbOperation(STORE_MIDI_NOTES, 'readwrite', store => {
         return new Promise((resolve, reject) => {
             const request = store.put(noteData);
             request.onsuccess = () => resolve(request.result);
             request.onerror = () => reject(request.error);
         });
     });
}


// --- Deleting Granular Data ---

export async function deleteTrack(trackId: string): Promise<void> {
    const storesToModify = [
        STORE_TRACKS,
        STORE_TRACK_SYNTHS,
        STORE_TRACK_EFFECTS,
        STORE_MIDI_BLOCKS,
        STORE_MIDI_NOTES
    ];

    await performMultiStoreDbOperation(storesToModify, 'readwrite', async (transaction) => {
        const tracksStore = transaction.objectStore(STORE_TRACKS);
        const synthsStore = transaction.objectStore(STORE_TRACK_SYNTHS);
        const effectsStore = transaction.objectStore(STORE_TRACK_EFFECTS);
        const blocksStore = transaction.objectStore(STORE_MIDI_BLOCKS);
        const notesStore = transaction.objectStore(STORE_MIDI_NOTES);

        const blocksIndex = blocksStore.index(IDX_TRACK_ID);
        const effectsIndex = effectsStore.index(IDX_TRACK_ID);
        const notesIndex = notesStore.index(IDX_BLOCK_ID);

        const deletePromises: Promise<any>[] = [];

        // 1. Find and delete notes within blocks of this track
        const blockIds = await promisifyRequest(blocksIndex.getAllKeys(trackId));
        for (const blockId of blockIds) {
            const noteIds = await promisifyRequest(notesIndex.getAllKeys(blockId));
            noteIds.forEach(noteId => {
                deletePromises.push(promisifyRequestSimple(notesStore.delete(noteId)));
            });
            // 2. Delete the block itself
            deletePromises.push(promisifyRequestSimple(blocksStore.delete(blockId)));
        }

        // 3. Find and delete effects associated with this track
        const effectIds = await promisifyRequest(effectsIndex.getAllKeys(trackId));
        effectIds.forEach(effectId => {
            deletePromises.push(promisifyRequestSimple(effectsStore.delete(effectId)));
        });

        // 4. Delete the synth associated with this track
        deletePromises.push(promisifyRequestSimple(synthsStore.delete(trackId)));

        // 5. Delete the track metadata itself
        deletePromises.push(promisifyRequestSimple(tracksStore.delete(trackId)));

        // Wait for all delete operations in this transaction to complete
        await Promise.all(deletePromises);
    });
    console.log(`Cascading delete complete for track: ${trackId}`);
}

export async function deleteEffect(effectId: string): Promise<void> {
     await performDbOperation(STORE_TRACK_EFFECTS, 'readwrite', store => {
         return promisifyRequestSimple(store.delete(effectId));
     });
}

export async function deleteMidiBlock(blockId: string): Promise<void> {
    const storesToModify = [STORE_MIDI_BLOCKS, STORE_MIDI_NOTES];
    await performMultiStoreDbOperation(storesToModify, 'readwrite', async (transaction) => {
        const blocksStore = transaction.objectStore(STORE_MIDI_BLOCKS);
        const notesStore = transaction.objectStore(STORE_MIDI_NOTES);
        const notesIndex = notesStore.index(IDX_BLOCK_ID);

        const deletePromises: Promise<any>[] = [];

        // 1. Find and delete notes within this block
        const noteIds = await promisifyRequest(notesIndex.getAllKeys(blockId));
        noteIds.forEach(noteId => {
            deletePromises.push(promisifyRequestSimple(notesStore.delete(noteId)));
        });

        // 2. Delete the block itself
        deletePromises.push(promisifyRequestSimple(blocksStore.delete(blockId)));

        // Wait for all delete operations in this transaction to complete
        await Promise.all(deletePromises);
    });
}

export async function deleteMidiNote(noteId: string): Promise<void> {
     await performDbOperation(STORE_MIDI_NOTES, 'readwrite', store => {
         return promisifyRequestSimple(store.delete(noteId));
     });
}

// --- Helper Functions ---

// Helper to promisify IDBRequest returning a value
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Helper to promisify IDBRequest for operations that don't return a value
function promisifyRequestSimple(request: IDBRequest): Promise<void> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}