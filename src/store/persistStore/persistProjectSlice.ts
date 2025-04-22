import { AppState } from '../store'; // Assuming AppState is in store.ts
import * as P from '../../Persistence/persistence-service';

const logError = (action: string, error: any) => {
    console.error(`Persistence Error [${action}]:`, error);
};

/**
 * Persists the currently selected project ID.
 * @param get Function to access the current Zustand state (AppState).
 * @param projectId The ID of the project to set as current, or null.
 */
export const persistSwitchProject = async (get: () => AppState, projectId: string | null) => {
     try {
         await P.setCurrentProjectId(projectId);
     } catch (error) {
         logError('persistSwitchProject', error);
         // Potentially re-throw or handle UI feedback here
     }
};

/**
 * Creates a new project in the persistence layer.
 * Does NOT set it as the current project.
 * @param get Function to access the current Zustand state (AppState).
 * @param name The name for the new project.
 * @returns The ID of the newly created project, or null if creation failed.
 */
export const persistCreateNewProject = async (get: () => AppState, name: string): Promise<string | null> => {
     try {
         const newProjectId = await P.createNewProject(name);
         return newProjectId;
     } catch (error) {
         logError('persistCreateNewProject', error);
         return null;
         // Potentially re-throw or handle UI feedback here
     }
};

/**
 * Persists renaming an existing project.
 * @param get Function to access the current Zustand state (AppState).
 * @param projectId The ID of the project to rename.
 * @param newName The new name for the project.
 */
export const persistRenameProject = async (get: () => AppState, projectId: string, newName: string) => {
     try {
          await P.renameProject(projectId, newName);
     } catch (error) {
          logError('persistRenameProject', error);
     }
};

/**
 * Deletes a project and all its associated data from the persistence layer.
 * @param get Function to access the current Zustand state (AppState).
 * @param projectId The ID of the project to delete.
 */
export const persistDeleteProject = async (get: () => AppState, projectId: string) => {
     try {
         await P.deleteProject(projectId);
     } catch (error) {
         logError('persistDeleteProject', error);
     }
}; 