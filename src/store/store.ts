import { create } from 'zustand';
import { Track, MIDIBlock } from '../lib/types';
import TimeManager from '../lib/TimeManager';
import TrackManager from '../lib/TrackManager';

interface AppState {
  // Time-related state
  timeManager: TimeManager;
  currentBeat: number;
  isPlaying: boolean;
  bpm: number;
  
  // Track-related state
  trackManager: TrackManager;
  selectedTrackId: string | null;
  selectedBlockId: string | null;
  
  // Actions
  selectTrack: (trackId: string | null) => void;
  selectBlock: (blockId: string | null) => void;
  addTrack: (track: Track) => void;
  removeTrack: (trackId: string) => void;
  updateCurrentBeat: (beat: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setBPM: (bpm: number) => void;
  seekTo: (beat: number) => void;
}

// Create a single instance of TimeManager to be used throughout the app
const timeManager = new TimeManager(120);

const useStore = create<AppState>((set, get) => {
  // Set up beat update subscription
  timeManager.onUpdate((beat) => {
    set({ currentBeat: beat });
  });

  return {
    // Initial state
    timeManager,
    currentBeat: 0,
    isPlaying: false,
    bpm: 120,
    trackManager: new TrackManager(),
    selectedTrackId: null,
    selectedBlockId: null,
    
    // Actions
    selectTrack: (trackId: string | null) => set({ selectedTrackId: trackId }),
    
    selectBlock: (blockId: string | null) => set({ selectedBlockId: blockId }),
    
    addTrack: (track: Track) => {
      const { trackManager } = get();
      trackManager.addTrack(track);
      set({ trackManager });
    },
    
    removeTrack: (trackId: string) => {
      const { trackManager } = get();
      trackManager.removeTrack(trackId);
      set({ trackManager });
    },
    
    updateCurrentBeat: (beat: number) => set({ currentBeat: beat }),
    
    play: () => {
      const { timeManager } = get();
      timeManager.play();
      set({ isPlaying: true });
    },
    
    pause: () => {
      const { timeManager } = get();
      timeManager.pause();
      set({ isPlaying: false });
    },
    
    stop: () => {
      const { timeManager } = get();
      timeManager.stop();
      set({ isPlaying: false, currentBeat: 0 });
    },
    
    setBPM: (bpm: number) => {
      const { timeManager } = get();
      timeManager.setBPM(bpm);
      set({ bpm });
    },
    
    seekTo: (beat: number) => {
      const { timeManager } = get();
      timeManager.seekTo(beat);
      set({ currentBeat: beat });
    }
  };
});

export default useStore; 