import { create } from 'zustand';
import { Track, MIDIBlock, MIDINote, Synthesizer } from '../lib/types';
import TimeManager from '../lib/TimeManager';
import TrackManager from '../lib/TrackManager';
import { AudioManager } from '../lib/AudioManager';

// Import Synthesizer Classes
import SineWaveSynth from '../lib/synthesizers/SineWaveSynth';
import MelodicOrbitSynth from '../lib/synthesizers/MelodicOrbitSynth';
import ApproachingCubeSynth from '../lib/synthesizers/ApproachingCubeSynth';
import BackgroundPlaneSynth from '../lib/synthesizers/BackgroundPlaneSynth';
import BasicSynthesizer from '../lib/synthesizers/BasicSynthesizer';
import KickDrumSynth from '../lib/synthesizers/KickDrumSynth';
import SnareDrumSynth from '../lib/synthesizers/SnareDrumSynth';
import HiHatSynth from '../lib/synthesizers/HiHatSynth';
import ShakerSynth from '../lib/synthesizers/ShakerSynth';

// Define Instrument structures
export interface InstrumentDefinition {
  id: string; // Unique identifier, matches class name or similar
  name: string; // User-friendly name
  constructor: new (...args: any[]) => Synthesizer; // Store the class constructor
}

export interface InstrumentCategories {
  [categoryName: string]: InstrumentDefinition[];
}

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

  // Audio-related state
  audioManager: AudioManager;
  isAudioLoaded: boolean;
  audioDuration: number | null;
  
  // Add instrument definitions
  availableInstruments: InstrumentCategories;

  // NEW: Sidebar visibility state
  isInstrumentSidebarVisible: boolean;

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
  loadAudio: (audioData: ArrayBuffer) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setBPM: (bpm: number) => void;
  seekTo: (beat: number) => void;

  // NEW: Action to toggle sidebar
  toggleInstrumentSidebar: () => void;
}

// Define the actual instrument data with constructors
const availableInstrumentsData: InstrumentCategories = {
  Melodic: [
    { id: 'SineWaveSynth', name: 'Sine Wave Synth', constructor: SineWaveSynth },
    { id: 'MelodicOrbitSynth', name: 'Melodic Orbit Synth', constructor: MelodicOrbitSynth },
    { id: 'ApproachingCubeSynth', name: 'Approaching Cube Synth', constructor: ApproachingCubeSynth },
    { id: 'BackgroundPlaneSynth', name: 'Background Plane Synth', constructor: BackgroundPlaneSynth },
    { id: 'BasicSynthesizer', name: 'Basic Synth', constructor: BasicSynthesizer }, 
  ],
  Percussive: [
    { id: 'KickDrumSynth', name: 'Kick Drum', constructor: KickDrumSynth },
    { id: 'SnareDrumSynth', name: 'Snare Drum', constructor: SnareDrumSynth },
    { id: 'HiHatSynth', name: 'Hi-Hat', constructor: HiHatSynth },
    { id: 'ShakerSynth', name: 'Shaker', constructor: ShakerSynth },
  ],
};

const useStore = create<AppState>((set, get) => {
  const timeManager = new TimeManager(120);
  const audioManager = new AudioManager();

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
    audioManager,
    isAudioLoaded: audioManager.isAudioLoaded,
    audioDuration: audioManager.audioDuration,
    
    // Add instruments to initial state
    availableInstruments: availableInstrumentsData,
    
    // Initialize sidebar as visible
    isInstrumentSidebarVisible: true,
    
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
        // Find and update the block in the array
        const blockIndex = track.midiBlocks.findIndex(b => b.id === updatedBlock.id);
        if (blockIndex !== -1) {
            track.midiBlocks[blockIndex] = updatedBlock;
        }
        
        // If the updated block is currently selected, update the selectedBlock state
        if (selectedBlockId === updatedBlock.id) {
          set({ 
            trackManager,
            selectedBlock: updatedBlock
          });
        } else {
          // If the updated block wasn't the selected one, potentially update selected items if IDs match
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
          // If the removed block wasn't the selected one, potentially update selected items if IDs match
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
      const { trackManager } = get();
      trackManager.updateTrack(trackId, updatedProperties);
      // Re-fetch tracks to ensure the state reflects the update
      const updatedTrack = trackManager.getTrack(trackId);
      set(state => ({
        trackManager: state.trackManager, // Keep the manager instance
        // Update selectedTrack only if it's the one being modified
        selectedTrack: state.selectedTrackId === trackId ? updatedTrack : state.selectedTrack,
        // No need to update other selected items here unless updateTrack changes IDs
      }));
    },
    
    updateCurrentBeat: (beat: number) => set({ currentBeat: beat }),
    
    loadAudio: async (audioData: ArrayBuffer) => {
        const { audioManager } = get();
        try {
            // Ensure AudioContext is resumed (required for user interaction)
            if (audioManager.context && audioManager.context.state === 'suspended') {
              await audioManager.context.resume();
            }
            const { duration } = await audioManager.loadAudio(audioData);
            set({ isAudioLoaded: true, audioDuration: duration });
        } catch (error) {
            console.error("Store: Failed to load audio", error);
            set({ isAudioLoaded: false, audioDuration: null });
            throw error; // Re-throw so the component can catch it
        }
    },

    play: () => {
      const { timeManager, audioManager, isAudioLoaded, currentBeat } = get();
      // Ensure AudioContext is running before trying to play
      if (audioManager.context && audioManager.context.state === 'suspended') {
           console.warn("AudioContext is suspended. Attempting to resume...");
           // Attempt to resume - user interaction might be required
           audioManager.context.resume().then(() => {
               console.log("AudioContext resumed successfully.");
               // Now try playing audio if loaded
                if (isAudioLoaded) {
                    const offset = timeManager.beatToTime(currentBeat);
                    const startTime = audioManager.context!.currentTime + 0.05; // Schedule slightly ahead
                    audioManager.play(startTime, offset);
                }
           }).catch(err => console.error("Failed to resume AudioContext:", err));
      } else if (isAudioLoaded && audioManager.context) {
          // Context running and audio loaded, play normally
          const offset = timeManager.beatToTime(currentBeat);
          const startTime = audioManager.context.currentTime + 0.05; // Schedule slightly ahead
          audioManager.play(startTime, offset);
      } else if (!isAudioLoaded) {
          console.warn("Play called but no audio loaded.");
      } else {
           console.warn("Play called but AudioContext not available or in unexpected state.");
      }

      // Always start the TimeManager
      timeManager.play();
      set({ isPlaying: true });
    },
    
    pause: () => {
      const { timeManager, audioManager } = get();
      timeManager.pause(); // Pause TimeManager first
      const pausedAudioTime = audioManager.pause(); // Pause audio
      set({ isPlaying: false });
      // We don't sync currentBeat to pausedAudioTime here; TimeManager owns the beat time.
    },
    
    stop: () => {
      const { timeManager, audioManager } = get();
      timeManager.stop(); // Stop TimeManager first
      audioManager.stop(); // Stop audio
      set({ isPlaying: false, currentBeat: 0 });
    },
    
    setBPM: (bpm: number) => {
      const { timeManager, audioManager, isPlaying, isAudioLoaded, currentBeat } = get();
      const wasPlaying = isPlaying;

      // Pause everything temporarily if it was playing
      if (wasPlaying) {
        timeManager.pause();
        if (isAudioLoaded) audioManager.pause();
      }
      
      // Update BPM in TimeManager
      timeManager.setBPM(bpm);
      set({ bpm }); // Update state

      // Resume if it was playing, recalculating audio start time
      if (wasPlaying) {
          timeManager.play(); // Resume TimeManager immediately
          // Resume audio slightly delayed and synced to current beat
          if (isAudioLoaded && audioManager.context) {
              const offset = timeManager.beatToTime(currentBeat); // Get offset for the *current* beat at the *new* BPM
              const startTime = audioManager.context.currentTime + 0.05; // Schedule slightly ahead
              audioManager.play(startTime, offset);
          }
      }
    },
    
    seekTo: (beat: number) => {
      const { timeManager, audioManager, isPlaying, isAudioLoaded } = get();
      const targetTime = timeManager.beatToTime(beat); // Calculate target time based on beat
      
      timeManager.seekTo(beat); // Update TimeManager first
      set({ currentBeat: beat }); // Update beat state immediately

      if (isAudioLoaded && audioManager.context) {
          if (isPlaying) {
              // If playing: stop audio, then restart it at the new offset immediately
              audioManager.stop(); 
              const startTime = audioManager.context.currentTime + 0.05; // Schedule slightly ahead
              audioManager.play(startTime, targetTime); 
          } else {
              // If paused or stopped: just tell AudioManager the new seek position for the next play
              audioManager.seek(targetTime);
          }
      }
    },

    // NEW: Action to toggle sidebar
    toggleInstrumentSidebar: () => set((state) => ({ 
      isInstrumentSidebarVisible: !state.isInstrumentSidebarVisible 
    })),
  };
});

export default useStore; 