import { AppState } from '../../store';
import * as supabaseService from '@/Persistence/supabase-service';

const logError = (action: string, error: any) => {
    console.error(`Supabase Persistence Error [${action}]:`, error);
};

/**
 * Creates a new project in Supabase.
 * @param get Function to access the current Zustand state (AppState).
 * @param name The name for the new project.
 * @returns The ID of the newly created project, or null if creation failed.
 */
export const persistCreateNewProject = async (get: () => AppState, name: string): Promise<string | null> => {
    try {
        const newProjectId = await supabaseService.createSupabaseProject(name);
        return newProjectId;
    } catch (error) {
        logError('persistCreateNewProject', error);
        return null;
    }
};

/**
 * Deletes a project and all its associated data from Supabase.
 * @param get Function to access the current Zustand state (AppState).
 * @param projectId The ID of the project to delete.
 */
export const persistDeleteProject = async (get: () => AppState, projectId: string) => {
    try {
        await supabaseService.deleteSupabaseProject(projectId);
    } catch (error) {
        logError('persistDeleteProject', error);
    }
};

/**
 * Loads the project list from Supabase.
 * @returns Array of project metadata or empty array on error.
 */
export const persistLoadProjectList = async (): Promise<Array<{ id: string; name: string }>> => {
    try {
        return await supabaseService.getSupabaseProjectList();
    } catch (error) {
        logError('persistLoadProjectList', error);
        return [];
    }
};

/**
 * Loads a full project from Supabase.
 * @param projectId The ID of the project to load.
 * @returns The project data or null on error.
 */
export const persistLoadProject = async (projectId: string) => {
    try {
        return await supabaseService.loadFullProjectFromSupabase(projectId);
    } catch (error) {
        logError('persistLoadProject', error);
        return null;
    }
};

