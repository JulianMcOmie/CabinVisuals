import { StateCreator } from 'zustand';
import TimeManager from '../lib/TimeManager';
import { AppState } from './store'; // Import the combined AppState
import { AudioManager } from '../lib/AudioManager'; // Need AudioManager for cross-slice access

// Time Slice
export interface TimeState {
  timeManager: TimeManager;
  currentBeat: number;
  numMeasures: number;
  isPlaying: boolean;
  bpm: number;
}

export interface TimeActions {
  updateCurrentBeat: (beat: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setBPM: (bpm: number) => void;
  seekTo: (beat: number) => void;
}

export type TimeSlice = TimeState & TimeActions;

export const createTimeSlice: StateCreator<
  AppState,
  [],
  [],
  TimeSlice
> = (set, get) => {
  const timeManager = new TimeManager(120); // Initialize TimeManager here

  // Set up beat update subscription
  timeManager.onUpdate((beat) => {
    set({ currentBeat: beat });
  });

  return {
    timeManager,
    currentBeat: 0,
    numMeasures: timeManager.getNumMeasures(),
    isPlaying: false,
    bpm: 120,
    updateCurrentBeat: (beat: number) => set({ currentBeat: beat }),
    play: () => {
      // Access state/methods from other slices via get()
      const { audioManager, isAudioLoaded, currentBeat } = get();
      // Ensure AudioContext is running before trying to play
      if (audioManager.context && audioManager.context.state === 'suspended') {
           console.warn("AudioContext is suspended. Attempting to resume...");
           audioManager.context.resume().then(() => {
               console.log("AudioContext resumed successfully.");
                if (isAudioLoaded) {
                    const offset = timeManager.beatToTime(currentBeat);
                    const startTime = audioManager.context!.currentTime + 0.05;
                    audioManager.play(startTime, offset);
                }
           }).catch(err => console.error("Failed to resume AudioContext:", err));
      } else if (isAudioLoaded && audioManager.context) {
          const offset = timeManager.beatToTime(currentBeat);
          const startTime = audioManager.context.currentTime + 0.05;
          audioManager.play(startTime, offset);
      } else if (!isAudioLoaded) {
          console.warn("Play called but no audio loaded.");
      } else {
           console.warn("Play called but AudioContext not available or in unexpected state.");
      }

      timeManager.play();
      set({ isPlaying: true });
    },
    pause: () => {
      const { audioManager } = get();
      timeManager.pause();
      audioManager.pause();
      set({ isPlaying: false });
    },
    stop: () => {
      const { audioManager } = get();
      timeManager.stop();
      audioManager.stop();
      set({ isPlaying: false, currentBeat: 0 });
    },
    setBPM: (bpm: number) => {
      const { audioManager, isPlaying, isAudioLoaded, currentBeat } = get();
      const wasPlaying = isPlaying;

      if (wasPlaying) {
        timeManager.pause();
        if (isAudioLoaded) audioManager.pause();
      }
      
      timeManager.setBPM(bpm);
      set({ bpm });

      if (wasPlaying) {
          timeManager.play();
          if (isAudioLoaded && audioManager.context) {
              const offset = timeManager.beatToTime(currentBeat);
              const startTime = audioManager.context.currentTime + 0.05;
              audioManager.play(startTime, offset);
          }
      }
    },
    seekTo: (beat: number) => {
      const { audioManager, isPlaying, isAudioLoaded } = get();
      const targetTime = timeManager.beatToTime(beat);
      
      timeManager.seekTo(beat);
      set({ currentBeat: beat });

      if (isAudioLoaded && audioManager.context) {
          if (isPlaying) {
              audioManager.stop(); 
              const startTime = audioManager.context.currentTime + 0.05;
              audioManager.play(startTime, targetTime); 
          } else {
              audioManager.seek(targetTime);
          }
      }
    },
  }
} 