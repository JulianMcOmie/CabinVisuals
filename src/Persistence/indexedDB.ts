import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { MIDINote } from '../lib/types'; // Assuming MIDINote type is needed

const DB_NAME = 'CabinVisualsDB';
const DB_VERSION = 1;

// Define interfaces for the data stored in each object store
interface AppConfigValue {
    currentProjectId?: string | null;
    // Add other global settings here if needed
}

interface ProjectMetadataValue {
    id: string; // Corresponds to the key
    name: string;
    // createdAt?: number;
    // lastModified?: number;
}

interface ProjectSettingsValue {
    projectId: string; // Corresponds to the key
    bpm?: number;
    isPlaying?: boolean;
    loopEnabled?: boolean;
    loopStartBeat?: number | null;
    loopEndBeat?: number | null;
    numMeasures?: number;
    isInstrumentSidebarVisible?: boolean;
    selectedWindow?: string | null;
}

interface TrackValue {
    id: string; // Corresponds to the key
    projectId: string;
    name: string;
    isMuted: boolean;
    isSoloed: boolean;
}

interface TrackSynthValue {
    trackId: string; // Corresponds to the key
    type: string;
    settings: Record<string, any>;
}

interface TrackEffectValue {
    id: string; // Corresponds to the key
    trackId: string;
    order: number;
    type: string;
    settings: Record<string, any>;
}

interface MidiBlockValue {
    id: string; // Corresponds to the key
    trackId: string;
    startBeat: number;
    endBeat: number;
}

interface MidiNoteValue {
    id: string; // Corresponds to the key
    blockId: string;
    pitch: number;
    velocity: number;
    startBeat: number;
    duration: number;
}


// Define the database schema using DBSchema
interface CabinVisualsDBSchema extends DBSchema {
    appConfig: {
        key: string; // e.g., 'currentProjectId'
        value: AppConfigValue | string | null; // Allow storing simple values too
    };
    projectMetadata: {
        key: string; // projectId (UUID)
        value: ProjectMetadataValue;
    };
    projectSettings: {
        key: string; // projectId
        value: ProjectSettingsValue;
    };
    tracks: {
        key: string; // trackId (UUID)
        value: TrackValue;
        indexes: { 'by-projectId': string }; // Index to query tracks by project
    };
    trackSynths: {
        key: string; // trackId
        value: TrackSynthValue;
        // No index needed if always accessed by trackId (key)
    };
    trackEffects: {
        key: string; // effectId (UUID)
        value: TrackEffectValue;
        indexes: { 'by-trackId': string }; // Index to query effects by track
    };
    midiBlocks: {
        key: string; // blockId (UUID)
        value: MidiBlockValue;
        indexes: { 'by-trackId': string }; // Index to query blocks by track
    };
    midiNotes: {
        key: string; // noteId (UUID)
        value: MidiNoteValue;
        indexes: { 'by-blockId': string }; // Index to query notes by block
    };
}

// Function to open the database
export const openDatabase = async (): Promise<IDBPDatabase<CabinVisualsDBSchema>> => {
    return openDB<CabinVisualsDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            console.log(`Upgrading database from version ${oldVersion} to ${newVersion}...`);

            // Create object stores based on the schema
            if (oldVersion < 1) {
                 if (!db.objectStoreNames.contains('appConfig')) {
                    db.createObjectStore('appConfig');
                    console.log("Created store: appConfig");
                 }
                 if (!db.objectStoreNames.contains('projectMetadata')) {
                    db.createObjectStore('projectMetadata', { keyPath: 'id' });
                    console.log("Created store: projectMetadata");
                 }
                 if (!db.objectStoreNames.contains('projectSettings')) {
                    db.createObjectStore('projectSettings', { keyPath: 'projectId' });
                     console.log("Created store: projectSettings");
                 }
                 if (!db.objectStoreNames.contains('tracks')) {
                    const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
                    trackStore.createIndex('by-projectId', 'projectId');
                    console.log("Created store: tracks, Index: by-projectId");
                 }
                 if (!db.objectStoreNames.contains('trackSynths')) {
                    db.createObjectStore('trackSynths', { keyPath: 'trackId' });
                    console.log("Created store: trackSynths");
                 }
                 if (!db.objectStoreNames.contains('trackEffects')) {
                    const effectStore = db.createObjectStore('trackEffects', { keyPath: 'id' });
                    effectStore.createIndex('by-trackId', 'trackId');
                    console.log("Created store: trackEffects, Index: by-trackId");
                 }
                 if (!db.objectStoreNames.contains('midiBlocks')) {
                    const blockStore = db.createObjectStore('midiBlocks', { keyPath: 'id' });
                    blockStore.createIndex('by-trackId', 'trackId');
                    console.log("Created store: midiBlocks, Index: by-trackId");
                 }
                 if (!db.objectStoreNames.contains('midiNotes')) {
                    const noteStore = db.createObjectStore('midiNotes', { keyPath: 'id' });
                    noteStore.createIndex('by-blockId', 'blockId');
                    console.log("Created store: midiNotes, Index: by-blockId");
                 }
            }

            // Example for future upgrades:
            // if (oldVersion < 2) {
            //     // Make changes for version 2
            //     const store = transaction.objectStore('someStore');
            //     store.createIndex('newIndex', 'propertyName');
            // }

            console.log("Database upgrade complete.");
        },
        blocked() {
            console.error("IndexedDB opening blocked; close other tabs/windows with the app open?");
            // Potentially show a notification to the user
        },
        blocking() {
            console.warn("IndexedDB is blocking a newer version; closing connection.");
            // db.close(); // Close the connection to allow the new version to open
        },
        terminated() {
            console.error("IndexedDB connection terminated unexpectedly.");
        },
    });
};

// Optional: Export types if needed elsewhere
export type {
    CabinVisualsDBSchema,
    AppConfigValue,
    ProjectMetadataValue,
    ProjectSettingsValue,
    TrackValue,
    TrackSynthValue,
    TrackEffectValue,
    MidiBlockValue,
    MidiNoteValue,
}; 