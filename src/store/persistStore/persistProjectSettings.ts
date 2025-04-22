import { AppState } from '../store';
import * as P from '../../Persistence/persistence-service';

const logError = (action: string, error: any) => {
    console.error(`Persistence Error [${action}]:`, error);
};

/**
 * Persists the current project's settings (combining state from timeSlice and uiSlice).
 * Fetches necessary state using get() and saves it via persistence service.
 * @param get Function to access the current Zustand state (AppState).
 */
export const persistProjectSettings = async (get: () => AppState) => {
    try {
        const projectId = get().currentLoadedProjectId;
        if (!projectId) {
            // Don't throw an error, just warn. Maybe settings changed before project loaded.
            console.warn("Cannot persist project settings: No project loaded.");
            return;
        }

        // Gather all settings from relevant slices
        const settingsToSave: P.ProjectSettings = {
            projectId: projectId,
            // From timeSlice
            bpm: get().bpm,
            isPlaying: get().isPlaying, // Persisting playback state - may or may not be desired
            loopEnabled: get().loopEnabled,
            loopStartBeat: get().loopStartBeat,
            loopEndBeat: get().loopEndBeat,
            numMeasures: get().numMeasures,
            // From uiSlice
            isInstrumentSidebarVisible: get().isInstrumentSidebarVisible,
            selectedWindow: get().selectedWindow,
        };

        await P.saveProjectSettings(settingsToSave);

    } catch (error) {
        logError('persistProjectSettings', error);
    }
}; 