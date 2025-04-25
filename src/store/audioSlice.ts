import { StateCreator } from 'zustand';
import { AudioManager } from '../lib/AudioManager';
import { AppState } from './store'; // Import the combined AppState

// Audio Slice
export interface AudioState {
  audioManager: AudioManager;
  isAudioLoaded: boolean;
  audioDuration: number | null;
  audioFileName: string | null;
  loadingProgress: number; // Track loading progress
}

export interface AudioActions {
  loadAudio: (audioData: ArrayBuffer, fileName?: string) => Promise<void>;
  clearAudio: () => void; // Add clearAudio action
}

export type AudioSlice = AudioState & AudioActions;

export const createAudioSlice: StateCreator<
  AppState,
  [],
  [],
  AudioSlice
> = (set, get) => {
    const audioManager = new AudioManager(); // Initialize AudioManager here
    
    // Set up the progress callback
    audioManager.setProgressCallback((progress) => {
        set({ loadingProgress: progress });
    });
    
    return {
        audioManager,
        isAudioLoaded: audioManager.isAudioLoaded,
        audioDuration: audioManager.audioDuration,
        audioFileName: null,
        loadingProgress: 0,
        loadAudio: async (audioData: ArrayBuffer, fileName: string = '') => {
            // Reset loading progress
            set({ loadingProgress: 0 });
            
            // Ensure AudioContext is resumed (required for user interaction)
            if (audioManager.context && audioManager.context.state === 'suspended') {
              await audioManager.context.resume();
            }
            
            try {
                const { duration } = await audioManager.loadAudio(audioData, fileName);
                
                set({ 
                    isAudioLoaded: true, 
                    audioDuration: duration,
                    audioFileName: fileName || audioManager.audioFileName,
                    // Progress is now handled by the callback, but we'll set it to 100 here just to be safe
                    loadingProgress: 100
                });
            } catch (error) {
                console.error("Store: Failed to load audio", error);
                set({ 
                    isAudioLoaded: false, 
                    audioDuration: null,
                    audioFileName: null,
                    loadingProgress: 0
                });
                throw error; // Re-throw so the component can catch it
            }
        },
        clearAudio: () => {
            // Stop any playback
            audioManager.stop();
            
            // Clear the audio state
            set({
                isAudioLoaded: false,
                audioDuration: null,
                audioFileName: null,
                loadingProgress: 0
            });
            console.log("Audio cleared from store.");
        }
    };
} 