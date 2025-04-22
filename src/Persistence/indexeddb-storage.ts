import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'CabinVisualsDB';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const METADATA_STORE = 'metadata';
const APP_STATE_STORE = 'appState';
const CURRENT_PROJECT_ID_KEY = 'currentProjectId';

// Define the database schema using the DBSchema interface
interface CabinVisualsDBSchema extends DBSchema {
  [PROJECTS_STORE]: {
    key: string; // projectId
    value: any; // Persisted project state object (output of partialize)
  };
  [METADATA_STORE]: {
    key: string; // projectId
    value: { name: string };
  };
  [APP_STATE_STORE]: {
    key: string; // e.g., 'currentProjectId'
    value: string | null;
  };
}

// Function to open the database
async function openCabinDB(): Promise<IDBPDatabase<CabinVisualsDBSchema>> {
  return openDB<CabinVisualsDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`Upgrading DB from version ${oldVersion} to ${newVersion}`);
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE);
        console.log(`Created object store: ${PROJECTS_STORE}`);
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE);
        console.log(`Created object store: ${METADATA_STORE}`);
      }
      if (!db.objectStoreNames.contains(APP_STATE_STORE)) {
        db.createObjectStore(APP_STATE_STORE);
        // Initialize current project ID if needed during first creation
        transaction.objectStore(APP_STATE_STORE).put(null, CURRENT_PROJECT_ID_KEY)
          .catch(err => console.error("Failed to initialize currentProjectId", err));
        console.log(`Created object store: ${APP_STATE_STORE}`);
      }
    },
    blocked() {
      console.error('IndexedDB blocked. Please close other tabs using this app.');
      // Handle blocked state, maybe alert the user
    },
    blocking() {
      console.warn('IndexedDB blocking. A newer version is trying to open.');
      // Handle blocking state, maybe close the DB connection
    },
    terminated() {
      console.error('IndexedDB connection terminated unexpectedly.');
      // Handle termination, maybe try to reconnect or alert the user
    },
  });
}

// --- Helper Functions --- 

async function getCurrentProjectId(): Promise<string | null> {
    let db: IDBPDatabase<CabinVisualsDBSchema> | null = null;
    try {
        db = await openCabinDB();
        const currentId = await db.get(APP_STATE_STORE, CURRENT_PROJECT_ID_KEY);
        return currentId ?? null;
    } catch (error) {
        console.error("Failed to get current project ID", error);
        return null; // Indicate failure or absence
    } finally {
        db?.close();
    }
}

async function setCurrentProjectId(projectId: string | null): Promise<void> {
    let db: IDBPDatabase<CabinVisualsDBSchema> | null = null;
    try {
        db = await openCabinDB();
        await db.put(APP_STATE_STORE, projectId, CURRENT_PROJECT_ID_KEY);
    } catch (error) {
        console.error("Failed to set current project ID", error);
    } finally {
        db?.close();
    }
}

// --- Zustand Storage Adapter Implementation --- 

const indexedDBStorage = {
  // Get the state for the current project
  getItem: async (name: string): Promise<any | null> => {
    console.log(`indexedDBStorage getItem called (name: ${name}) - name is ignored`);
    let db: IDBPDatabase<CabinVisualsDBSchema> | null = null;
    try {
      db = await openCabinDB();
      // 1. Find out which project is active
      const currentId = await db.get(APP_STATE_STORE, CURRENT_PROJECT_ID_KEY);
      if (!currentId) {
        console.warn("No current project ID found in DB.");
        return null; // No project selected or available
      }

      // 2. Get the state for that project
      const projectState = await db.get(PROJECTS_STORE, currentId);
      console.log(`Retrieved state for project ID: ${currentId}`);
      return projectState ?? null; // Return the state or null if not found
    } catch (error) {
      console.error("indexedDBStorage getItem failed:", error);
      return null;
    } finally {
       db?.close();
    }
  },

  // Set the state for the current project
  setItem: async (name: string, value: any): Promise<void> => {
    console.log(`indexedDBStorage setItem called (name: ${name}) - name is ignored`);
    let db: IDBPDatabase<CabinVisualsDBSchema> | null = null;
    try {
      db = await openCabinDB();
      // 1. Find out which project is active
      const currentId = await db.get(APP_STATE_STORE, CURRENT_PROJECT_ID_KEY);
      if (!currentId) {
        console.error("Cannot set item: No current project ID found.");
        return; // Cannot save state if no project is selected
      }

      // 2. Save the state for that project
      await db.put(PROJECTS_STORE, value, currentId);
      console.log(`Saved state for project ID: ${currentId}`);

    } catch (error) {
      console.error("indexedDBStorage setItem failed:", error);
    } finally {
        db?.close();
    }
  },

  // Remove the state for the current project (optional, maybe use later for delete project)
  removeItem: async (name: string): Promise<void> => {
    console.log(`indexedDBStorage removeItem called (name: ${name}) - name is ignored`);
    let db: IDBPDatabase<CabinVisualsDBSchema> | null = null;
    try {
      db = await openCabinDB();
      // 1. Find out which project is active
      const currentId = await db.get(APP_STATE_STORE, CURRENT_PROJECT_ID_KEY);
      if (!currentId) {
        console.warn("Cannot remove item: No current project ID found.");
        return; 
      }

      // 2. Remove the state for that project
      await db.delete(PROJECTS_STORE, currentId);
      console.log(`Removed state for project ID: ${currentId}`);
      // Note: This only removes the project *data*. Metadata and the current ID 
      // would need separate handling if implementing full project deletion.
    } catch (error) {
      console.error("indexedDBStorage removeItem failed:", error);
    } finally {
        db?.close();
    }
  },
};

// --- Project Management Functions ---

const DEFAULT_PROJECT_NAME = "Default Project";

/**
 * Gets the list of project metadata.
 */
async function getProjectList(): Promise<Array<{ id: string; name: string }>> {
    let db: IDBPDatabase<CabinVisualsDBSchema> | null = null;
    try {
        db = await openCabinDB();
        const allMetadata = await db.getAll(METADATA_STORE);
        const keys = await db.getAllKeys(METADATA_STORE); // Fetch keys separately
        // Combine keys (IDs) with metadata values
        return keys.map((key, index) => ({ id: key, name: allMetadata[index]?.name || `Project ${key}` })); 
    } catch (error) {
        console.error("Failed to get project list", error);
        return [];
    } finally {
        db?.close();
    }
}

/**
 * Creates a new project entry in metadata and sets it as current.
 * Does not create initial project data - that happens on first save.
 * Returns the ID of the new project.
 */
async function createNewProject(name: string): Promise<string | null> {
    let db: IDBPDatabase<CabinVisualsDBSchema> | null = null;
    const newId = crypto.randomUUID();
    try {
        db = await openCabinDB();
        const tx = db.transaction([METADATA_STORE, APP_STATE_STORE], 'readwrite');
        await tx.objectStore(METADATA_STORE).put({ name }, newId);
        await tx.objectStore(APP_STATE_STORE).put(newId, CURRENT_PROJECT_ID_KEY);
        await tx.done;
        console.log(`Created new project: ${name} (${newId}) and set as current.`);
        return newId;
    } catch (error) {
        console.error("Failed to create new project", error);
        return null;
    } finally {
        db?.close();
    }
}

/**
 * Checks if projects exist, creates a default one if not,
 * and ensures a current project ID is set.
 * Returns the current project ID.
 */
async function initializeProjects(): Promise<string | null> {
    let db: IDBPDatabase<CabinVisualsDBSchema> | null = null;
    try {
        db = await openCabinDB();
        let currentId = await db.get(APP_STATE_STORE, CURRENT_PROJECT_ID_KEY);

        if (currentId) {
            // Verify the current project still exists in metadata
            const metadata = await db.get(METADATA_STORE, currentId);
            if (metadata) {
                console.log(`Initialized. Current project: ${metadata.name} (${currentId})`);
                return currentId;
            } else {
                console.warn(`Current project ID ${currentId} not found in metadata. Resetting.`);
                currentId = null; // Reset if invalid
            }
        }

        // If no valid current ID, check if any projects exist
        const projectKeys = await db.getAllKeys(METADATA_STORE);
        if (projectKeys.length > 0) {
            // If projects exist but none is set as current, set the first one
            currentId = projectKeys[0];
            console.log(`No current project set. Setting to first available: ${currentId}`);
            await db.put(APP_STATE_STORE, currentId, CURRENT_PROJECT_ID_KEY);
            return currentId;
        } else {
            // No projects exist, create the default one
            console.log("No projects found. Creating default project.");
            const defaultId = await createNewProject(DEFAULT_PROJECT_NAME);
            // createNewProject already sets the current ID
            return defaultId;
        }
    } catch (error) {
        console.error("Failed during project initialization", error);
        return null;
    } finally {
        db?.close(); 
    }
}

/**
 * Switches the current project ID.
 * Assumes the calling code will handle reloading the app state.
 */
async function switchProject(projectId: string): Promise<boolean> {
     let db: IDBPDatabase<CabinVisualsDBSchema> | null = null;
    try {
        db = await openCabinDB();
        // Verify the project exists before switching
        const metadata = await db.get(METADATA_STORE, projectId);
        if (!metadata) {
            console.error(`Cannot switch: Project ID ${projectId} not found.`);
            return false;
        }
        await db.put(APP_STATE_STORE, projectId, CURRENT_PROJECT_ID_KEY);
        console.log(`Switched current project ID to: ${projectId}`);
        return true;
    } catch (error) {
        console.error(`Failed to switch project to ${projectId}`, error);
        return false;
    } finally {
        db?.close();
    }
}

export {
  openCabinDB,
  getCurrentProjectId,
  setCurrentProjectId,
  indexedDBStorage,
  initializeProjects,
  createNewProject,
  getProjectList,
  switchProject,
  PROJECTS_STORE,
  METADATA_STORE,
  APP_STATE_STORE,
  CURRENT_PROJECT_ID_KEY
}; 