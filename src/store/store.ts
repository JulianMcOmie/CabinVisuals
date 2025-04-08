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
  selectedTrack: Track | null;
  selectedBlock: MIDIBlock | null;
  
  // Actions
  selectTrack: (trackId: string | null) => void;
  selectBlock: (blockId: string | null) => void;
  addTrack: (track: Track) => void;
  removeTrack: (trackId: string) => void;
  addMidiBlock: (trackId: string, block: MIDIBlock) => void;
  updateMidiBlock: (trackId: string, block: MIDIBlock) => void;
  removeMidiBlock: (trackId: string, blockId: string) => void;
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

  // Helper function to find track and block by IDs
  const findSelectedItems = () => {
    const { trackManager, selectedTrackId, selectedBlockId } = get();
    
    let selectedTrack: Track | null = null;
    let selectedBlock: MIDIBlock | null = null;
    
    if (selectedTrackId) {
      selectedTrack = trackManager.getTrack(selectedTrackId) || null;
      
      if (selectedTrack && selectedBlockId) {
        selectedBlock = selectedTrack.midiBlocks.find(block => block.id === selectedBlockId) || null;
      }
    }
    
    return { selectedTrack, selectedBlock };
  };

  return {
    // Initial state
    timeManager,
    currentBeat: 0,
    isPlaying: false,
    bpm: 120,
    trackManager: new TrackManager(),
    selectedTrackId: null,
    selectedBlockId: null,
    selectedTrack: null,
    selectedBlock: null,
    
    // Actions
    selectTrack: (trackId: string | null) => {
      set({ selectedTrackId: trackId, selectedBlockId: null });
      
      // Update selected track object
      if (trackId) {
        const { trackManager } = get();
        const track = trackManager.getTrack(trackId);
        set({ selectedTrack: track || null, selectedBlock: null });
      } else {
        set({ selectedTrack: null, selectedBlock: null });
      }
    },
    
    selectBlock: (blockId: string | null) => {
      set({ selectedBlockId: blockId });
      
      // Update selected block object
      if (blockId) {
        const { trackManager, selectedTrackId } = get();
        if (selectedTrackId) {
          const track = trackManager.getTrack(selectedTrackId);
          if (track) {
            const block = track.midiBlocks.find(b => b.id === blockId);
            set({ selectedBlock: block || null });
          }
        }
      } else {
        set({ selectedBlock: null });
      }
    },
    
    addTrack: (track: Track) => {
      const { trackManager } = get();
      trackManager.addTrack(track);
      set({ 
        trackManager,
        ...findSelectedItems() // Update selected items
      });
    },
    
    removeTrack: (trackId: string) => {
      const { trackManager, selectedTrackId } = get();
      trackManager.removeTrack(trackId);
      
      // Reset selection if the selected track was removed
      if (selectedTrackId === trackId) {
        set({ 
          trackManager,
          selectedTrackId: null,
          selectedBlockId: null,
          selectedTrack: null,
          selectedBlock: null
        });
      } else {
        set({ 
          trackManager,
          ...findSelectedItems() // Update selected items
        });
      }
    },
    
    addMidiBlock: (trackId: string, block: MIDIBlock) => {
      const { trackManager } = get();
      const track = trackManager.getTrack(trackId);
      
      if (track) {
        track.midiBlocks = [...track.midiBlocks, block];
        set({ 
          trackManager,
          ...findSelectedItems() // Update selected items
        });
      }
    },
    
    updateMidiBlock: (trackId: string, updatedBlock: MIDIBlock) => {
      const { trackManager, selectedBlockId } = get();
      const track = trackManager.getTrack(trackId);
      
      if (track) {
        track.midiBlocks = track.midiBlocks.map(block => 
          block.id === updatedBlock.id ? updatedBlock : block
        );
        
        // If the updated block is currently selected, update the selectedBlock
        if (selectedBlockId === updatedBlock.id) {
          set({ 
            trackManager,
            selectedBlock: updatedBlock
          });
        } else {
          set({ 
            trackManager,
            ...findSelectedItems() // Update selected items
          });
        }
      }
    },
    
    removeMidiBlock: (trackId: string, blockId: string) => {
      const { trackManager, selectedBlockId } = get();
      const track = trackManager.getTrack(trackId);
      
      if (track) {
        track.midiBlocks = track.midiBlocks.filter(block => block.id !== blockId);
        
        // If the removed block was selected, clear the selection
        if (selectedBlockId === blockId) {
          set({ 
            trackManager,
            selectedBlockId: null,
            selectedBlock: null
          });
        } else {
          set({ 
            trackManager,
            ...findSelectedItems() // Update selected items
          });
        }
      }
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