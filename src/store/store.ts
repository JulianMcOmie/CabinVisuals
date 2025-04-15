import { create } from 'zustand';
import { Track, MIDIBlock, MIDINote, VisualObject } from '../lib/types';
import Synthesizer from '../lib/Synthesizer';
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
  getVisualObjectsAtTime: (time: number, bpm: number) => VisualObject[];

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

  // Helper function to find track and block by IDs using the *current* trackManager state
  // IMPORTANT: This needs to be called AFTER the new trackManager is set if we need updated info
  const findSelectedItems = (manager: TrackManager) => {
    const { selectedTrackId, selectedBlockId } = get(); // Get IDs from current state
    
    let selectedTrack: Track | null = null;
    let selectedBlock: MIDIBlock | null = null;
    
    if (selectedTrackId) {
      selectedTrack = manager.getTrack(selectedTrackId) || null; // Use the provided manager
      
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
    trackManager: new TrackManager(), // Initial empty manager
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
      set(state => {
        // Just update selection IDs, selected items will be derived if needed or updated by findSelectedItems
        const selection = { 
            selectedTrackId: trackId, 
            selectedBlockId: null, // Selecting track clears block selection
            selectedNotes: null 
        };
         const { trackManager } = state;
         const derivedItems = findSelectedItems(trackManager); // Find items based on new IDs
         return { ...selection, ...derivedItems };
      });
    },
    
    selectBlock: (blockId: string | null) => {
      set(state => {
          const { trackManager } = state;
          let newSelectedTrackId: string | null = state.selectedTrackId;
          let newSelectedTrack: Track | null = state.selectedTrack;
          let newSelectedBlock: MIDIBlock | null = null;

          if (blockId) {
              const allTracks = trackManager.getTracks();
              for (const track of allTracks) {
                  const block = track.midiBlocks.find((b: MIDIBlock) => b.id === blockId);
                  if (block) {
                      newSelectedTrackId = track.id;
                      newSelectedTrack = track;
                      newSelectedBlock = block;
                      break; 
                  }
              }
               // If block wasn't found, clear selections
              if (!newSelectedBlock) {
                  newSelectedTrackId = null;
                  newSelectedTrack = null;
              }
          } else {
              // Keep track selection if only clearing block
              newSelectedBlock = null; 
          }

          return {
              selectedTrackId: newSelectedTrackId,
              selectedBlockId: blockId,
              selectedTrack: newSelectedTrack,
              selectedBlock: newSelectedBlock,
              selectedNotes: null // Clear note selection when block changes
          };
      });
    },
    
    addTrack: (track: Track) => {
      set(state => {
        const currentTracks = state.trackManager.getTracks();
        const newTracks = [...currentTracks, track];
        const newTrackManager = new TrackManager(newTracks); 
        // Selection state remains unchanged unless logic requires selecting the new track
        // const derivedItems = findSelectedItems(newTrackManager); 
        return { 
          trackManager: newTrackManager,
          // selectedTrack: derivedItems.selectedTrack, // Keep existing selection state
          // selectedBlock: derivedItems.selectedBlock, // Keep existing selection state
        };
      });
    },
    
    removeTrack: (trackId: string) => {
       set(state => {
        const currentTracks = state.trackManager.getTracks();
        const newTracks = currentTracks.filter(t => t.id !== trackId);
        const newTrackManager = new TrackManager(newTracks);
        
        // If the removed track was selected, clear selection
        if (state.selectedTrackId === trackId) {
          return {
            trackManager: newTrackManager,
            selectedTrackId: null,
            selectedBlockId: null,
            selectedTrack: null,
            selectedBlock: null,
            selectedNotes: null
          };
        } else {
          // Otherwise, just update the manager, keep selection
          return { trackManager: newTrackManager };
        }
       });
    },
    
    addMidiBlock: (trackId: string, block: MIDIBlock) => {
       set(state => {
           const currentTracks = state.trackManager.getTracks();
           const newTracks = currentTracks.map(t => {
               if (t.id === trackId) {
                   // Immutable update of midiBlocks array for the target track
                   return { ...t, midiBlocks: [...t.midiBlocks, block] };
               }
               return t; // Return other tracks unchanged
           });
           const newTrackManager = new TrackManager(newTracks);
           // Selection state remains unchanged unless logic dictates selecting the new block
           // const derivedItems = findSelectedItems(newTrackManager);
            return { 
                trackManager: newTrackManager,
                // selectedTrack: derivedItems.selectedTrack, // Keep existing selection
                // selectedBlock: derivedItems.selectedBlock, // Keep existing selection
            };
       });
    },
    
    updateMidiBlock: (trackId: string, updatedBlock: MIDIBlock) => {
        set(state => {
            const currentTracks = state.trackManager.getTracks();
            let blockStillExists = false; // Flag to check if selected block is still valid

            const newTracks = currentTracks.map(t => {
                if (t.id === trackId) {
                    // Immutable update of the midiBlocks array
                    const updatedMidiBlocks = t.midiBlocks.map(b => {
                        if (b.id === updatedBlock.id) {
                            blockStillExists = true; // Confirm the block exists
                            return updatedBlock; // Replace with the updated block
                        }
                        return b;
                    });
                    // Check if selected block (if any) still exists after potential update
                     if (state.selectedBlockId === updatedBlock.id && !blockStillExists) {
                         // This case should technically not happen if update ID matches existing, but as safety
                         blockStillExists = true; 
                     }
                    return { ...t, midiBlocks: updatedMidiBlocks };
                }
                return t;
            });

            const newTrackManager = new TrackManager(newTracks);
            
             // If the updated block was selected, update the selectedBlock state object too
            if (state.selectedBlockId === updatedBlock.id && blockStillExists) {
                return {
                    trackManager: newTrackManager,
                    selectedBlock: updatedBlock // Update the selectedBlock object directly
                };
            } else {
                // Otherwise, just update the manager
                return { trackManager: newTrackManager };
            }
        });
    },
    
    removeMidiBlock: (trackId: string, blockId: string) => {
        set(state => {
            const currentTracks = state.trackManager.getTracks();
            let selectedBlockWasRemoved = false;

            const newTracks = currentTracks.map(t => {
                if (t.id === trackId) {
                    const originalLength = t.midiBlocks.length;
                    const updatedMidiBlocks = t.midiBlocks.filter(b => b.id !== blockId);
                    // Check if the selected block was the one removed
                    if (state.selectedBlockId === blockId && updatedMidiBlocks.length < originalLength) {
                        selectedBlockWasRemoved = true;
                    }
                    return { ...t, midiBlocks: updatedMidiBlocks };
                }
                return t;
            });

            const newTrackManager = new TrackManager(newTracks);

            // If the removed block was selected, clear the block selection
            if (selectedBlockWasRemoved) {
                 return {
                     trackManager: newTrackManager,
                     selectedBlockId: null,
                     selectedBlock: null,
                     // Keep selected track ID and object if it still exists
                 };
            } else {
                // Otherwise, just update the manager
                 return { trackManager: newTrackManager };
            }
        });
    },

    selectNotes: (notes: MIDINote[]) => {
      set({ selectedNotes: notes });
    },
    
    updateTrack: (trackId: string, updatedProperties: Partial<Track>) => {
       set(state => {
            const currentTracks = state.trackManager.getTracks();
             let selectedTrackStillExists = false;

            const newTracks = currentTracks.map(t => {
                if (t.id === trackId) {
                    selectedTrackStillExists = true;
                    // Merge updated properties immutably
                    return { ...t, ...updatedProperties };
                }
                return t;
            });

            const newTrackManager = new TrackManager(newTracks);

            // If the updated track was selected, update the selectedTrack object
            if (state.selectedTrackId === trackId && selectedTrackStillExists) {
                const updatedTrack = newTrackManager.getTrack(trackId); // Get the updated track object
                 return {
                     trackManager: newTrackManager,
                     selectedTrack: updatedTrack || null // Update selectedTrack object
                 };
            } else {
                 // Otherwise, just update the manager
                 return { trackManager: newTrackManager };
            }
       });
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

    getVisualObjectsAtTime: (time: number, bpm: number): VisualObject[] => {
        const { trackManager } = get();
        return trackManager.getObjectsAtTime(time, bpm);
    },

    // NEW: Action to toggle sidebar
    toggleInstrumentSidebar: () => set((state) => ({ 
      isInstrumentSidebarVisible: !state.isInstrumentSidebarVisible 
    })),
  };
});

export default useStore; 