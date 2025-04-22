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
        try {
            const currentProjectId = await persistenceService.getCurrentProjectId();
            let initialState: Partial<AppState> = {}; // Start with empty initial state

            if (currentProjectId) {
                console.log(`Attempting to load project: ${currentProjectId}`);
                const loadedProjectData = await persistenceService.loadFullProject(currentProjectId);
                if (loadedProjectData) {
                    initialState = loadedProjectData;
                     // Set the loaded project ID in the initial state for the project slice
                     initialState.currentLoadedProjectId = currentProjectId;
                     console.log("Project loaded successfully.");
                } else {
                    console.warn(`Failed to load project data for ${currentProjectId}. Starting fresh.`);
                    // Couldn't load, ensure currentProjectId is cleared
                    await persistenceService.setCurrentProjectId(null);
                }
            } else {
                console.log("No current project ID found. Starting fresh.");
            }
            
            // Set initial state including project list and initialized flag
            initialState.isStoreInitialized = true; // Mark as initialized *before* creating store? Or after? Let's do it after hydration.
            initialState.projectList = await persistenceService.getProjectMetadataList(); // Load project list initially

            // Get the store instance *after* potentially loading initial data
            const store = useStore; // Reference to the create function's return
            
            // Apply the initial state (this overwrites defaults set by slice creators)
            // Note: Zustand doesn't have a built-in hydrate function without middleware.
            // We might need to set the state *after* creation.
            // Or pass initial state directly if `create` supports it (it doesn't directly for combined slices like this).
            
            // --> Let's modify the approach: Create store first, then set initial state.

            // Initialize the store with default values from slices
            const storeInstance = useStore; // This gets the hook function

            // Manually set the loaded/initial state
            storeInstance.setState({
                ...initialState, // Apply loaded data (if any)
                currentLoadedProjectId: initialState.currentLoadedProjectId ?? null, // Ensure it's set
                projectList: initialState.projectList ?? [], // Ensure it's set
                isStoreInitialized: true, // NOW mark as initialized
             });
            
            console.log("Store initialized.");

            // TODO: Handle post-load adjustments if needed (like setting TimeManager BPM)
            // The old `merge` function did this. We need to replicate it here or in loadFullProject.
            // Example:
            // const state = storeInstance.getState();
            // if (state.bpm && state.timeManager) {
            //     state.timeManager.setBPM(state.bpm);
            // }

            return storeInstance; // Return the hook

        } catch (error) {
            console.error("Failed to initialize store:", error);
            // Fallback: return the uninitialized store? Or throw?
            // Let's return the store hook anyway, but it won't be marked 'initialized'
             useStore.setState({ isStoreInitialized: false }); // Ensure it's marked as not initialized on error
            return useStore;
        }
    })();

    return storeReadyPromise;
};


export default useStore; 