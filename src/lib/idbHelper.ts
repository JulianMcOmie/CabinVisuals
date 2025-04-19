import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'cabin-visuals-db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_files';
const AUDIO_KEY = 'user_audio_file';

interface AudioDB extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: Blob | File;
  };
}

let dbPromise: Promise<IDBPDatabase<AudioDB>> | null = null;

function getDb(): Promise<IDBPDatabase<AudioDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AudioDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
          console.log(`IndexedDB: Object store "${STORE_NAME}" created.`);
        }
      },
    });
    dbPromise.then(() => console.log(`IndexedDB: Database "${DB_NAME}" opened.`))
             .catch(err => console.error("IndexedDB: Failed to open database:", err));
  }
  return dbPromise;
}

/**
 * Saves the user's audio file to IndexedDB.
 * Overwrites any existing file with the same key.
 * @param file The audio file (Blob or File) to save.
 */
export async function saveAudioFile(file: Blob | File): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, file, AUDIO_KEY);
    console.log(`IndexedDB: Audio file saved successfully with key "${AUDIO_KEY}".`);
  } catch (error) {
    console.error("IndexedDB: Error saving audio file:", error);
    // Decide if re-throwing is needed based on future error handling requirements
    // throw error;
  }
}

/**
 * Loads the user's audio file from IndexedDB.
 * @returns The loaded file (Blob or File), or null if not found.
 */
export async function loadAudioFile(): Promise<Blob | File | null> {
  try {
    const db = await getDb();
    const file = await db.get(STORE_NAME, AUDIO_KEY);
    if (file) {
      console.log(`IndexedDB: Audio file loaded successfully for key "${AUDIO_KEY}".`);
      return file;
    } else {
      console.log(`IndexedDB: No audio file found for key "${AUDIO_KEY}".`);
      return null;
    }
  } catch (error) {
    console.error("IndexedDB: Error loading audio file:", error);
    return null; // Return null on error to avoid breaking app load
  }
}

/**
 * Deletes the user's audio file from IndexedDB.
 */
export async function deleteAudioFile(): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE_NAME, AUDIO_KEY);
    console.log(`IndexedDB: Audio file deleted successfully for key "${AUDIO_KEY}".`);
  } catch (error) {
    console.error("IndexedDB: Error deleting audio file:", error);
    // Decide if re-throwing is needed
  }
} 