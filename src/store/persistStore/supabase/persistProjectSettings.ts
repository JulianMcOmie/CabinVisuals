import { AppState } from '../../store';
import * as supabaseService from '@/Persistence/supabase-service';
import type { ProjectSettings } from '@/Persistence/supabase-service';

const logError = (action: string, error: any) => {
    console.error(`Supabase Persistence Error [${action}]:`, error);
};

/**
 * Persists the current project's settings to Supabase.
 * Fetches necessary state using get() and saves it via supabase service.
 * @param get Function to access the current Zustand state (AppState).
 */
export const persistProjectSettings = async (get: () => AppState) => {
    try {
        const projectId = get().currentLoadedProjectId;
        if (!projectId) {
            console.warn("Cannot persist project settings: No project loaded.");
            return;
        }

        const settings: ProjectSettings = {
            projectId,
            bpm: get().bpm,
            isPlaying: get().isPlaying,
            loopEnabled: get().loopEnabled,
            loopStartBeat: get().loopStartBeat,
            loopEndBeat: get().loopEndBeat,
            numMeasures: get().numMeasures,
            isInstrumentSidebarVisible: get().isInstrumentSidebarVisible,
            selectedWindow: get().selectedWindow,
        };

        await supabaseService.saveProjectSettings(settings);
    } catch (error) {
        logError('persistProjectSettings', error);
    }
};

