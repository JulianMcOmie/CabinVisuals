import { StateCreator } from 'zustand';
import { AudioManager } from '../lib/AudioManager';
import { AppState } from './store'; // Import the combined AppState

// Audio Slice
export interface AudioState {
  audioManager: AudioManager;
  isAudioLoaded: boolean;
  audioDuration: number | null;
  audioFileName: string | null;
}

export interface AudioActions {
  loadAudio: (audioData: ArrayBuffer, fileName?: string) => Promise<void>;
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
        audioFileName: null,
        loadAudio: async (audioData: ArrayBuffer, fileName: string = '') => {
            // Ensure AudioContext is resumed (required for user interaction)
            if (audioManager.context && audioManager.context.state === 'suspended') {
              await audioManager.context.resume();
            }
            try {
                const { duration } = await audioManager.loadAudio(audioData, fileName);
                set({ 
                    isAudioLoaded: true, 
                    audioDuration: duration,
                    audioFileName: fileName || audioManager.audioFileName
                });
            } catch (error) {
                console.error("Store: Failed to load audio", error);
                set({ 
                    isAudioLoaded: false, 
                    audioDuration: null,
                    audioFileName: null
                });
                throw error; // Re-throw so the component can catch it
            }
        },
    };
} 