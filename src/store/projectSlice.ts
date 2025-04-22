import { StateCreator } from 'zustand';
import { AppState } from './store';

export interface ProjectMetadata {
  id: string;
  name: string;
}

export interface ProjectSlice {
    projectList: ProjectMetadata[];
    currentLoadedProjectId: string | null;
    loadProjectList: () => Promise<void>;
    switchProjectAndUpdate: (projectId: string) => Promise<void>;
    createNewProjectAndUpdate: (name: string) => Promise<void>;
}

// --- Project Slice Creator ---

export const createProjectSlice: StateCreator<
    AppState, 
    [],
    [],
    ProjectSlice
> = (set, get) => ({
    projectList: [],
    currentLoadedProjectId: null,
    loadProjectList: async () => {
        console.warn("loadProjectList not implemented");
        // TODO: Call persistence service to fetch list and update state via set()
    },
    switchProjectAndUpdate: async (projectId: string) => {
        console.warn("switchProjectAndUpdate not implemented");
        // TODO: Call persistence service to set current project ID, then reload
        // set({ currentLoadedProjectId: projectId }); // Example state update
    },
    createNewProjectAndUpdate: async (name: string) => {
        console.warn("createNewProjectAndUpdate not implemented");
        // TODO: Call persistence service to create project, then maybe switch and reload
        // const newProject = { id: 'new-uuid', name }; // Example
        // set(state => ({ projectList: [...state.projectList, newProject] })); // Example state update
    },
}); 