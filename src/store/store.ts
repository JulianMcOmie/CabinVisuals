import { create } from 'zustand';
import { Track, MIDIBlock, MIDINote } from '../lib/types';
import TimeManager from '../lib/TimeManager';
import TrackManager from '../lib/TrackManager';

interface AppState {
  // Time-related state
  timeManager: TimeManager;
  currentBeat: number;
  numMeasures: number;
  isPlaying: boolean;
  bpm: number;
  
  // Track-related state
  trackManager: TrackManager;
  selectedTrackId: string | null;
  selectedBlockId: string | null;
  selectedTrack: Track | null;
  selectedBlock: MIDIBlock | null;
  selectedNotes: MIDINote[] | null;
  
  // Actions
  selectTrack: (trackId: string | null) => void;
  selectBlock: (blockId: string | null) => void;
  addTrack: (track: Track) => void;
  removeTrack: (trackId: string) => void;
  addMidiBlock: (trackId: string, block: MIDIBlock) => void;
  updateMidiBlock: (trackId: string, block: MIDIBlock) => void;
  removeMidiBlock: (trackId: string, blockId: string) => void;
  updateTrack: (trackId: string, updatedProperties: Partial<Track>) => void;
  selectNotes: (notes: MIDINote[]) => void;
  updateCurrentBeat: (beat: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setBPM: (bpm: number) => void;
  seekTo: (beat: number) => void;
}

const useStore = create<AppState>((set, get) => {
  const timeManager = new TimeManager(120);

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
    numMeasures: timeManager.getNumMeasures(),
    isPlaying: false,
    bpm: 120,
    trackManager: new TrackManager(),
    selectedTrackId: null,
    selectedBlockId: null,
    selectedTrack: null,
    selectedBlock: null,
    selectedNotes: null,
    
    // Actions
    selectTrack: (trackId: string | null) => {
      set({ selectedTrackId: trackId, selectedBlockId: null, selectedNotes: null });
      
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
      set({ selectedBlockId: blockId, selectedNotes: null });

      if (blockId) {
        const { trackManager } = get();
        const allTracks = trackManager.getTracks();
        let foundTrack: Track | null = null;
        let foundBlock: MIDIBlock | null = null;

        for (const track of allTracks) {
          const block = track.midiBlocks.find((b: MIDIBlock) => b.id === blockId);
          if (block) {
            foundTrack = track;
            foundBlock = block;
            break; // Stop searching once found
          }
        }

        if (foundTrack && foundBlock) {
          // Set both the selected track and block
          set({
            selectedTrackId: foundTrack.id,
            selectedTrack: foundTrack,
            selectedBlock: foundBlock
          });
        } else {
          // If block not found in any track, clear selection (including track)
          set({
            selectedTrackId: null,
            selectedTrack: null,
            selectedBlock: null
          });
        }
      } else {
        // If blockId is null, just clear the block selection
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
          selectedBlock: null,
          selectedNotes: null
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
        for (let i = 0; i < track.midiBlocks.length; i++) {
          if (track.midiBlocks[i].id === updatedBlock.id) {
            track.midiBlocks[i] = updatedBlock;
          }
        }
        
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

    selectNotes: (notes: MIDINote[]) => {
      set({ selectedNotes: notes });
    },
    
    updateTrack: (trackId: string, updatedProperties: Partial<Track>) => {
      const { trackManager, selectedTrackId } = get();
      trackManager.updateTrack(trackId, updatedProperties);
      set({ 
        trackManager: trackManager,
        ...findSelectedItems() // Update selected items
      });
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