import { StateCreator } from 'zustand';
import { AudioManager } from '../lib/AudioManager';
import { AppState } from './store'; // Import the combined AppState

// Audio Slice
export interface AudioState {
  audioManager: AudioManager;
  isAudioLoaded: boolean;
  audioDuration: number | null;
}

export interface AudioActions {
  loadAudio: (audioData: ArrayBuffer) => Promise<void>;
}

export type AudioSlice = AudioState & AudioActions;

export const createAudioSlice: StateCreator<
  AppState,
  [],
  [],
  AudioSlice
> = (set, get) => {
    const audioManager = new AudioManager(); // Initialize AudioManager here
    return {
        audioManager,
        isAudioLoaded: audioManager.isAudioLoaded,
        audioDuration: audioManager.audioDuration,
        loadAudio: async (audioData: ArrayBuffer) => {
            // Ensure AudioContext is resumed (required for user interaction)
            if (audioManager.context && audioManager.context.state === 'suspended') {
              await audioManager.context.resume();
            }
            try {
                const { duration } = await audioManager.loadAudio(audioData);
                set({ isAudioLoaded: true, audioDuration: duration });
            } catch (error) {
                console.error("Store: Failed to load audio", error);
                set({ isAudioLoaded: false, audioDuration: null });
                throw error; // Re-throw so the component can catch it
            }
        },
    };
} 