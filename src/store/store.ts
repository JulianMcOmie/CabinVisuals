import { create, StateCreator } from 'zustand';

// Import Slice types and creators
import { TimeSlice, TimeState, createTimeSlice } from './timeSlice';
import { AudioSlice, createAudioSlice } from './audioSlice';
// Import types from trackSlice's dependencies
import { Track as TrackType, MIDIBlock as ClipType, MIDINote } from '../lib/types';
// REMOVED: Imports for EffectInstance, SynthesizerInstance as they are handled by persistence service
// import EffectInstance from '../lib/Effect'; 
// import SynthesizerInstance from '../lib/Synthesizer';

import { TrackSlice, TrackState, createTrackSlice } from './trackSlice';
// REMOVED: Imports related to constructor maps
// import { InstrumentSlice, InstrumentDefinition, InstrumentCategories, availableInstrumentsData, createInstrumentSlice } from './instrumentSlice';
// import { EffectSlice, EffectDefinition, EffectCategories, availableEffectsData, createEffectSlice } from './effectSlice';
import { InstrumentSlice, InstrumentCategories, createInstrumentSlice } from './instrumentSlice'; // Keep InstrumentSlice etc.
import { EffectSlice, EffectCategories, createEffectSlice } from './effectSlice'; // Keep EffectSlice etc.
import { UISlice, UIState, createUISlice } from './uiSlice';
import * as persistenceService from '../Persistence/persistence-service'; // Import the service

// --- Project Slice Definition ---

// Define the type for project metadata used in the store
export type ProjectMetadata = {
    id: string;
    name: string;
};

// Define the state structure for the ProjectSlice
export interface ProjectSliceState {
    projectList: ProjectMetadata[];
    currentLoadedProjectId: string | null;
    isStoreInitialized: boolean; // Flag to indicate if initial loading is complete
    isLoadingProject: boolean; // Flag for UI feedback during project switching/creation
}

// Define the actions available in the ProjectSlice
export interface ProjectSliceActions {
    _setStoreInitialized: (isInitialized: boolean) => void;
    _setCurrentLoadedProjectId: (projectId: string | null) => void; // Internal setter
    loadProjectList: () => Promise<void>;
    createNewProjectAndUpdate: (name: string) => Promise<void>;
    switchProjectAndUpdate: (newProjectId: string) => Promise<void>;
    renameProjectAndUpdate: (projectId: string, newName: string) => Promise<void>;
    deleteProjectAndUpdate: (projectId: string) => Promise<void>;
}

// Combine state and actions into the full slice type
export type ProjectSlice = ProjectSliceState & ProjectSliceActions;

// Initial state for the project slice
const initialProjectState: ProjectSliceState = {
    projectList: [],
    currentLoadedProjectId: null,
    isStoreInitialized: false,
    isLoadingProject: false, // Initially not loading
};

// Creator function for the ProjectSlice
export const createProjectSlice: StateCreator<
    AppState, // Full AppState type including other slices
    [], // Middleware (currently none)
    [], // Middleware (currently none)
    ProjectSlice // Return type of this creator
> = (set, get) => ({
    ...initialProjectState,

    _setStoreInitialized: (isInitialized) => set({ isStoreInitialized: isInitialized }),

    _setCurrentLoadedProjectId: (projectId) => set({ currentLoadedProjectId: projectId }),

    loadProjectList: async () => {
        try {
            const projects = await persistenceService.getProjectMetadataList();
            set({ projectList: projects });
        } catch (error) {
            console.error("Failed to load project list:", error);
            // Handle error appropriately in UI?
        }
    },

    createNewProjectAndUpdate: async (name) => {
        if (!name.trim()) {
            console.warn("Project name cannot be empty.");
            return; // Or throw an error / provide UI feedback
        }
        set({ isLoadingProject: true }); // Set loading flag
        try {
            const newProjectId = await persistenceService.createNewProject(name);
            await persistenceService.setCurrentProjectId(newProjectId);
            // Reload the page to apply the new project state cleanly
            window.location.reload();
            // isLoadingProject will reset on reload
        } catch (error) {
            console.error("Failed to create new project:", error);
            set({ isLoadingProject: false }); // Reset loading flag on error
            // Handle error appropriately
        }
    },

    switchProjectAndUpdate: async (newProjectId) => {
        set({ isLoadingProject: true }); // Set loading flag
        try {
            // Check if project exists? Optional, loadFullProject handles null
            await persistenceService.setCurrentProjectId(newProjectId);
            // Reload the page to load the selected project
            window.location.reload();
             // isLoadingProject will reset on reload
        } catch (error) {
            console.error(`Failed to switch to project ${newProjectId}:`, error);
            set({ isLoadingProject: false }); // Reset loading flag on error
            // Handle error appropriately
        }
    },

    renameProjectAndUpdate: async (projectId, newName) => {
         if (!newName.trim()) {
            console.warn("New project name cannot be empty.");
            return;
        }
         try {
            // Note: renameProject needs implementation in persistence-service.ts
            await persistenceService.renameProject(projectId, newName);
            // Refresh the list after renaming
            await get().loadProjectList();
         } catch (error) {
             console.error(`Failed to rename project ${projectId}:`, error);
             // Handle error
         }
    },

    deleteProjectAndUpdate: async (projectId) => {
        try {
             // Note: deleteProject needs implementation in persistence-service.ts
             await persistenceService.deleteProject(projectId);
             // If the deleted project was the current one, nullify it in service
             if (get().currentLoadedProjectId === projectId) {
                 await persistenceService.setCurrentProjectId(null);
                 set({ currentLoadedProjectId: null}); // Also update local state
             }
             // Refresh the list
             await get().loadProjectList();
        } catch (error) {
             console.error(`Failed to delete project ${projectId}:`, error);
             // Handle error
        }
    },
});


// REMOVED: Constructor Mappings

// --- Combined AppState Definition ---

// Combine all slice types into a single AppState type
// This AppState type is exported and used by slices for cross-slice access via get()
export type AppState = TimeSlice & AudioSlice & TrackSlice & InstrumentSlice & EffectSlice & UISlice & ProjectSlice; // Added ProjectSlice

// --- Store Creator ---

const useStore = create<AppState>()((...a) => ({
    ...createTimeSlice(...a),
    ...createAudioSlice(...a),
    ...createTrackSlice(...a),
    ...createInstrumentSlice(...a),
    ...createEffectSlice(...a),
    ...createUISlice(...a),
    ...createProjectSlice(...a), // Added ProjectSlice creator
}));

// --- Store Initialization ---
// We need a way to initialize the store asynchronously
// Option 1: Export a function that creates/returns the store after loading
// Option 2: Create the store immediately, but gate UI access until initialized

// Let's try Option 1 - Export an initializer function
let storeReadyPromise: Promise<typeof useStore> | null = null;

export const initializeStore = (): Promise<typeof useStore> => {
    if (storeReadyPromise) {
        return storeReadyPromise;
    }

    storeReadyPromise = (async () => {
        console.log("Initializing store...");
        const storeInstance = useStore; // Get the hook function
        let loadedState: Partial<AppState> = {}; // Define loadedState here

        try {
            const currentProjectId = await persistenceService.getCurrentProjectId();
            // let initialState: Partial<AppState> = {}; // Moved declaration up

            if (currentProjectId) {
                console.log(`Attempting to load project: ${currentProjectId}`);
                const loadedProjectData = await persistenceService.loadFullProject(currentProjectId);
                if (loadedProjectData) {
                    loadedState = loadedProjectData; // Assign loaded data
                    // Set the loaded project ID for the project slice
                    loadedState.currentLoadedProjectId = currentProjectId;
                     console.log("Project loaded successfully.");
                } else {
                    console.warn(`Failed to load project data for ${currentProjectId}. Starting fresh.`);
                    await persistenceService.setCurrentProjectId(null);
                    loadedState.currentLoadedProjectId = null; // Ensure it's null in the state to set
                }
            } else {
                console.log("No current project ID found. Starting fresh.");
                 loadedState.currentLoadedProjectId = null; // Ensure it's null
            }
            
            // Fetch project list regardless of whether a project was loaded
            const projectList = await persistenceService.getProjectMetadataList(); 
            loadedState.projectList = projectList;

            // Manually set the loaded/initial state
            storeInstance.setState({
                ...loadedState, // Apply loaded data (if any) or defaults
                isStoreInitialized: true, // Mark as initialized AFTER setting state
             });
            
            console.log("Store initialized and hydrated.");

            // --- Post-Load Adjustments --- 
            const finalState = storeInstance.getState(); // Get the state *after* hydration
            if (finalState.bpm && finalState.timeManager && typeof finalState.timeManager.setBPM === 'function') {
                console.log(`Applying loaded BPM (${finalState.bpm}) to TimeManager.`);
                 try {
                    finalState.timeManager.setBPM(finalState.bpm);
                 } catch (e) {
                    console.error("Failed to apply loaded BPM to TimeManager:", e);
                 }
            } else if (finalState.bpm) {
                 console.warn("Loaded BPM found, but TimeManager or setBPM method is missing.");
            }
            // Add any other necessary post-load adjustments here

            return storeInstance; // Return the hook

        } catch (error) {
            console.error("Failed to initialize store:", error);
            // Set defaults even on error, but mark as not initialized
            const projectListOnError = await persistenceService.getProjectMetadataList().catch(() => []); // Attempt to get list even on error
            storeInstance.setState({
                 ...initialProjectState, // Use initial defaults from slice
                 projectList: projectListOnError,
                 isStoreInitialized: false, // Mark as not initialized
            });
            return storeInstance; // Return hook, but state indicates failure
        }
    })();

    return storeReadyPromise;
};


export default useStore; 