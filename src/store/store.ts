import { create } from 'zustand';
import { Track, MIDIBlock } from '../lib/types';
import TimeManager from '../lib/TimeManager';
import TrackManager from '../lib/TrackManager';

interface AppState {
  // Time-related state
  timeManager: TimeManager;
  currentBeat: number;
  
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
}

const useStore = create<AppState>((set, get) => ({
  // Initial state
  timeManager: new TimeManager(),
  currentBeat: 0,
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
    // TODO: Implement actual playback logic
  },
  
  pause: () => {
    const { timeManager } = get();
    timeManager.pause();
    // TODO: Implement actual pause logic
  },
  
  stop: () => {
    const { timeManager } = get();
    timeManager.stop();
    // TODO: Implement actual stop logic
  },
}));

export default useStore; 