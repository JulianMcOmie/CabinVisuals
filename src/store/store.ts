import { create } from 'zustand';
import { Track, MIDIBlock, MIDINote, VisualObject } from '../lib/types';
import Synthesizer from '../lib/Synthesizer';
import TimeManager from '../lib/TimeManager';
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
  
  // Track-related state - Replaced TrackManager with Track[]
  tracks: Track[];
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

  // Helper function to derive selected track/block objects from IDs and tracks array
  const getUpdatedSelections = (tracks: Track[], selectedTrackId: string | null, selectedBlockId: string | null)
    : { selectedTrack: Track | null, selectedBlock: MIDIBlock | null } => {
    
    let selectedTrack: Track | null = null;
    let selectedBlock: MIDIBlock | null = null;

    if (selectedTrackId) {
      selectedTrack = tracks.find(t => t.id === selectedTrackId) || null;
      if (selectedTrack && selectedBlockId) {
        selectedBlock = selectedTrack.midiBlocks.find(b => b.id === selectedBlockId) || null;
        // If block ID is set but block not found in the found track, maybe deselect block?
        // For now, keeping it simple: if track found, look for block ID in it.
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
    tracks: [], // Initialize with empty array instead of TrackManager
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
        // Determine new selection IDs
        const newSelectedTrackId = trackId;
        const newSelectedBlockId = null; // Selecting track clears block selection
        
        // Get updated selection objects based on new IDs and current tracks
        const selections = getUpdatedSelections(state.tracks, newSelectedTrackId, newSelectedBlockId);

        return { 
            selectedTrackId: newSelectedTrackId,
            selectedBlockId: newSelectedBlockId,
            selectedTrack: selections.selectedTrack,
            selectedBlock: selections.selectedBlock,
            selectedNotes: null // Clear notes on track selection change
        };
      });
    },
    
    selectBlock: (blockId: string | null) => {
      set(state => {
          let newSelectedTrackId: string | null = null; // Start assuming current track
          const newSelectedBlockId = blockId;

          if (blockId) {
              let found = false;
              // Find which track the block belongs to
              for (const track of state.tracks) {
                  if (track.midiBlocks.some((b: MIDIBlock) => b.id === blockId)) {
                      newSelectedTrackId = track.id;
                      found = true;
                      break; 
                  }
              }
              // If blockId was given but not found in any track, invalidate track selection too
              if (!found) {
                  newSelectedTrackId = null;
              }
          } else {
             // Keep current track ID if just deselecting a block
             newSelectedTrackId = state.selectedTrackId;
          }

          // Get updated selection objects based on potentially new IDs and current tracks
          const selections = getUpdatedSelections(state.tracks, newSelectedTrackId, newSelectedBlockId);
          
          return {
              selectedTrackId: newSelectedTrackId,
              selectedBlockId: newSelectedBlockId,
              selectedTrack: selections.selectedTrack,
              selectedBlock: selections.selectedBlock,
              selectedNotes: null // Clear note selection when block changes
          };
      });
    },
    
    addTrack: (track: Track) => {
      set(state => {
        // Add track immutably
        const newTracks = [...state.tracks, track];
        
        // Select the newly added track
        const newSelectedTrackId = track.id;
        const newSelectedBlockId = null;
        
        // Get updated selection objects based on new tracks and new IDs
        const selections = getUpdatedSelections(newTracks, newSelectedTrackId, newSelectedBlockId);

        return { 
          tracks: newTracks,
          selectedTrackId: newSelectedTrackId,
          selectedBlockId: newSelectedBlockId,
          selectedTrack: selections.selectedTrack, // Should be the newly added track
          selectedBlock: selections.selectedBlock, // Should be null
          selectedNotes: null // Clear notes when adding a track
        };
      });
    },
    
    removeTrack: (trackId: string) => {
       set(state => {
        // Remove track immutably
        const newTracks = state.tracks.filter(t => t.id !== trackId);
        
        let newSelectedTrackId = state.selectedTrackId;
        let newSelectedBlockId = state.selectedBlockId;

        // If the removed track was selected, clear selection
        if (state.selectedTrackId === trackId) {
          newSelectedTrackId = null;
          newSelectedBlockId = null;
        }
        // Note: If the selected block belonged to the removed track, 
        // but the track itself wasn't selected, the blockId might remain,
        // but getUpdatedSelections will return null for selectedBlock.

        const selections = getUpdatedSelections(newTracks, newSelectedTrackId, newSelectedBlockId);

        return {
            tracks: newTracks,
            selectedTrackId: newSelectedTrackId,
            selectedBlockId: newSelectedBlockId,
            selectedTrack: selections.selectedTrack,
            selectedBlock: selections.selectedBlock,
            selectedNotes: selections.selectedTrack ? state.selectedNotes : null // Clear notes if track selection cleared
          };
       });
    },
    
    addMidiBlock: (trackId: string, block: MIDIBlock) => {
       set(state => {
           // Update tracks array immutably
           let trackFound = false;
           const newTracks = state.tracks.map(t => {
               if (t.id === trackId) {
                   trackFound = true;
                   // Immutable update of midiBlocks array
                   return { ...t, midiBlocks: [...t.midiBlocks, block] };
               }
               return t; // Return other tracks unchanged
           });

           // If track wasn't found, don't change state
           if (!trackFound) return {}; 

           // Keep current selection IDs
           const newSelectedTrackId = state.selectedTrackId;
           const newSelectedBlockId = state.selectedBlockId;
           
           // Update selection objects based on the modified tracks array
           const selections = getUpdatedSelections(newTracks, newSelectedTrackId, newSelectedBlockId);

            return { 
                tracks: newTracks,
                // Keep selection IDs, update objects
                selectedTrack: selections.selectedTrack,
                selectedBlock: selections.selectedBlock,
            };
       });
    },
    
    updateMidiBlock: (trackId: string, updatedBlock: MIDIBlock) => {
        set(state => {
            let trackUpdated = false;
            // Update tracks array immutably
            const newTracks = state.tracks.map(t => {
                if (t.id === trackId) {
                    let blockFoundInTrack = false;
                    // Immutable update of the midiBlocks array
                    const updatedMidiBlocks = t.midiBlocks.map(b => {
                        if (b.id === updatedBlock.id) {
                            blockFoundInTrack = true;
                            return updatedBlock; // Replace with the updated block
                        }
                        return b;
                    });
                    
                    // Only return updated track if the block was actually found and updated
                    if (blockFoundInTrack) {
                        trackUpdated = true;
                        return { ...t, midiBlocks: updatedMidiBlocks };
                    }
                }
                return t;
            });
            
            // If the target track or the specific block wasn't found/updated, do nothing
            if (!trackUpdated) return {};

            // Keep current selection IDs
            const newSelectedTrackId = state.selectedTrackId;
            const newSelectedBlockId = state.selectedBlockId;

            // Get updated selection objects based on the modified tracks
            const selections = getUpdatedSelections(newTracks, newSelectedTrackId, newSelectedBlockId);

            return {
                tracks: newTracks,
                // Update selection objects, IDs remain the same
                selectedTrack: selections.selectedTrack,
                selectedBlock: selections.selectedBlock 
            };
        });
    },
    
    removeMidiBlock: (trackId: string, blockId: string) => {
        set(state => {
            let trackUpdated = false;
            // Update tracks array immutably
            const newTracks = state.tracks.map(t => {
                if (t.id === trackId) {
                    const originalLength = t.midiBlocks.length;
                    // Filter midiBlocks immutably
                    const updatedMidiBlocks = t.midiBlocks.filter(b => b.id !== blockId);
                    // Only create a new track object if a block was actually removed
                    if (updatedMidiBlocks.length < originalLength) {
                        trackUpdated = true;
                        return { ...t, midiBlocks: updatedMidiBlocks };
                    }
                }
                return t;
            });

            // If track/block wasn't found or removed, do nothing
            if (!trackUpdated) return {};

            let newSelectedTrackId = state.selectedTrackId;
            let newSelectedBlockId = state.selectedBlockId;

            // If the removed block was the selected one, clear block selection ID
            if (state.selectedBlockId === blockId) {
                 newSelectedBlockId = null;
            }

            // Get updated selection objects based on new tracks and potentially updated block ID
            const selections = getUpdatedSelections(newTracks, newSelectedTrackId, newSelectedBlockId);

            return {
                 tracks: newTracks,
                 selectedTrackId: newSelectedTrackId, // Keep track ID
                 selectedBlockId: newSelectedBlockId, // Update block ID if it was removed
                 selectedTrack: selections.selectedTrack, // Update object references
                 selectedBlock: selections.selectedBlock, // Update object references (will be null if ID cleared)
             };
        });
    },

    selectNotes: (notes: MIDINote[]) => {
      set({ selectedNotes: notes });
    },
    
    updateTrack: (trackId: string, updatedProperties: Partial<Track>) => {
       set(state => {
            let trackUpdated = false;
            // Update tracks array immutably
            const newTracks = state.tracks.map(t => {
                if (t.id === trackId) {
                    trackUpdated = true;
                    // Merge updated properties immutably
                    return { ...t, ...updatedProperties }; 
                }
                return t;
            });

            // If track wasn't found/updated, do nothing
            if (!trackUpdated) return {};

            // Keep current selection IDs
            const newSelectedTrackId = state.selectedTrackId;
            const newSelectedBlockId = state.selectedBlockId;

            // Get updated selection objects based on the modified tracks
            const selections = getUpdatedSelections(newTracks, newSelectedTrackId, newSelectedBlockId);

            return {
                 tracks: newTracks,
                 // Update selection objects, IDs remain the same
                 selectedTrack: selections.selectedTrack,
                 selectedBlock: selections.selectedBlock 
             };
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
        // Replicate TrackManager logic directly using the tracks array
        const { tracks } = get();
        let allVisuals: VisualObject[] = [];
        const secondsPerBeat = 60 / bpm;

        tracks.forEach(track => {
            // Ensure synthesizer exists and has the getVisuals method
            if (track.synthesizer && typeof (track.synthesizer as any).getVisuals === 'function') {
                track.midiBlocks.forEach(block => {
                    // Assuming MIDIBlock has startBeat and endBeat
                    const blockStartBeat = block.startBeat;
                    const blockEndBeat = block.endBeat; // Use endBeat
                    const durationInBeats = blockEndBeat - blockStartBeat; // Calculate duration in beats
                    
                    // Check if the block is active at the current time
                    const blockStartTimeSeconds = blockStartBeat * secondsPerBeat;
                    const blockEndTimeSeconds = blockEndBeat * secondsPerBeat;
                    
                    if (time >= blockStartTimeSeconds && time < blockEndTimeSeconds) {
                       // Calculate time relative to the start of the block
                       const timeWithinBlockSeconds = time - blockStartTimeSeconds;
                       const blockDurationSeconds = durationInBeats * secondsPerBeat;

                       // Cast to any temporarily to bypass strict type check if getVisuals isn't on base type
                       const synth = track.synthesizer as any; 
                       const blockVisuals = synth.getVisuals(
                           block.notes,
                           blockDurationSeconds,
                           timeWithinBlockSeconds,
                           block.id // Pass block ID for context
                       );
                       
                       if(blockVisuals) {
                           // If single object returned, wrap in array
                           const visualsArray = Array.isArray(blockVisuals) ? blockVisuals : [blockVisuals];
                           // Add trackId and blockId for potential downstream use/debugging
                           const visualsWithContext = visualsArray.map(vis => ({
                               ...vis,
                               trackId: track.id,
                               blockId: block.id
                           }));
                           allVisuals = allVisuals.concat(visualsWithContext);
                       }
                    }
                });
            }
        });

        return allVisuals;
    },

    // NEW: Action to toggle sidebar
    toggleInstrumentSidebar: () => set((state) => ({ 
      isInstrumentSidebarVisible: !state.isInstrumentSidebarVisible 
    })),
  };
});

export default useStore; 