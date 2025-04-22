import { StateCreator } from 'zustand';
import { AppState } from './store';
import * as P from '../Persistence/persistence-service'; // Need getProjectMetadataList
import * as PersistProjectFns from './persistStore/persistProjectSlice'; // Import project persistence functions

export interface ProjectMetadata {
  id: string;
  name: string;
}

export interface ProjectSlice {
    projectList: ProjectMetadata[];
    currentLoadedProjectId: string | null;
    // Actions that involve persistence:
    loadProjectList: () => Promise<void>;
    switchProject: (projectId: string) => Promise<void>; // Renamed for clarity
    createNewProject: (name: string) => Promise<string | null>; // Renamed for clarity, returns ID
    renameProject: (projectId: string, newName: string) => Promise<void>; // Added
    deleteProject: (projectId: string) => Promise<void>; // Added
}

// --- Project Slice Creator ---

export const createProjectSlice: StateCreator<
    AppState, 
    [],
    [],
    ProjectSlice
> = (set, get) => ({
    projectList: [],
    currentLoadedProjectId: null, // This will be set during initialization
    loadProjectList: async () => {
        try {
            const list = await P.getProjectMetadataList();
            set({ projectList: list });
        } catch (error) {
             console.error("Failed to load project list:", error);
             set({ projectList: [] }); // Set to empty on error
        }
    },
    switchProject: async (projectId: string) => {
        // Persist the change first (as this triggers reload)
        await PersistProjectFns.persistSwitchProject(get, projectId);
        window.location.reload(); 
        // State update (currentLoadedProjectId) happens on reload/init
    },
    createNewProject: async (name: string): Promise<string | null> => {
        // Create in DB first to get the ID
        const newProjectId = await PersistProjectFns.persistCreateNewProject(get, name);
        
        if (newProjectId) {
            // Update state *after* successful persistence
            const newProjectMeta = { id: newProjectId, name: name || "Untitled Project" };
            set(state => ({ projectList: [...state.projectList, newProjectMeta] }));
             return newProjectId;
        } else {
             // Error already logged by persist function
             return null;
        }
    },
    renameProject: async (projectId: string, newName: string) => {
         // Update state first
         set(state => ({
             projectList: state.projectList.map(p => 
                 p.id === projectId ? { ...p, name: newName } : p
             )
         }));
         // Persist change *after* state update
         await PersistProjectFns.persistRenameProject(get, projectId, newName);
    },
    deleteProject: async (projectId: string) => {
        // Get current ID before state update
        const currentId = get().currentLoadedProjectId;
        
        // Update state first
        set(state => ({ 
            projectList: state.projectList.filter(p => p.id !== projectId)
        }));

        // Persist change *after* state update
        await PersistProjectFns.persistDeleteProject(get, projectId);
        
        // Handle reload if the active project was deleted
        if (currentId === projectId) {
            console.log(`Deleted the currently active project (${projectId}). Reloading...`);
            window.location.reload(); 
        }
    },
}); 