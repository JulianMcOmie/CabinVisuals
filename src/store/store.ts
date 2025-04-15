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
        // Find the selected track directly from the state's tracks array
        const selectedTrack = trackId ? state.tracks.find(t => t.id === trackId) || null : null;
        return { 
            selectedTrackId: trackId, 
            selectedTrack: selectedTrack,
            selectedBlockId: null, // Selecting track clears block selection
            selectedBlock: null,
            selectedNotes: null 
        };
      });
    },
    
    selectBlock: (blockId: string | null) => {
      set(state => {
          let newSelectedTrackId: string | null = null;
          let newSelectedTrack: Track | null = null;
          let newSelectedBlock: MIDIBlock | null = null;

          if (blockId) {
              // Iterate through the state's tracks array
              for (const track of state.tracks) {
                  const block = track.midiBlocks.find((b: MIDIBlock) => b.id === blockId);
                  if (block) {
                      newSelectedTrackId = track.id;
                      newSelectedTrack = track;
                      newSelectedBlock = block;
                      break; 
                  }
              }
          } 

          // If block wasn't found or blockId is null, clear/update selections accordingly
           if (!newSelectedBlock) {
               newSelectedTrackId = state.selectedTrackId; // Keep current track if block is just deselected
               newSelectedTrack = state.selectedTrack;
               // If blockId was provided but not found, it implies the currently selected track might be wrong
               // However, sticking to simple deselection/clearing if not found.
               if (blockId && !state.tracks.some(t => t.id === newSelectedTrackId)) {
                  newSelectedTrackId = null;
                  newSelectedTrack = null;
               }
           }

          return {
              selectedTrackId: newSelectedTrackId,
              selectedBlockId: blockId, // Set to null if blockId is null
              selectedTrack: newSelectedTrack,
              selectedBlock: newSelectedBlock, // Set to null if not found or blockId is null
              selectedNotes: null // Clear note selection when block changes
          };
      });
    },
    
    addTrack: (track: Track) => {
      set(state => {
        // Add track immutably to the tracks array
        const newTracks = [...state.tracks, track];
        return { 
          tracks: newTracks,
        };
      });
    },
    
    removeTrack: (trackId: string) => {
       set(state => {
        // Remove track immutably using filter
        const newTracks = state.tracks.filter(t => t.id !== trackId);
        
        // If the removed track was selected, clear selection
        if (state.selectedTrackId === trackId) {
          return {
            tracks: newTracks,
            selectedTrackId: null,
            selectedBlockId: null,
            selectedTrack: null,
            selectedBlock: null,
            selectedNotes: null
          };
        } else {
          // Otherwise, just update the tracks array
          return { tracks: newTracks };
        }
       });
    },
    
    addMidiBlock: (trackId: string, block: MIDIBlock) => {
       set(state => {
           // Update tracks array immutably
           const newTracks = state.tracks.map(t => {
               if (t.id === trackId) {
                   // Immutable update of midiBlocks array for the target track
                   return { ...t, midiBlocks: [...t.midiBlocks, block] };
               }
               return t; // Return other tracks unchanged
           });
            return { 
                tracks: newTracks,
            };
       });
    },
    
    updateMidiBlock: (trackId: string, updatedBlock: MIDIBlock) => {
        set(state => {
            let blockStillExists = false; // Flag to check if selected block is still valid
            let updatedSelectedTrack = state.selectedTrack; // Keep track if the selected track is updated

            // Update tracks array immutably
            const newTracks = state.tracks.map(t => {
                if (t.id === trackId) {
                    let blockFoundInTrack = false;
                    // Immutable update of the midiBlocks array
                    const updatedMidiBlocks = t.midiBlocks.map(b => {
                        if (b.id === updatedBlock.id) {
                            blockStillExists = true; // Confirm the block exists
                            blockFoundInTrack = true;
                            return updatedBlock; // Replace with the updated block
                        }
                        return b;
                    });
                    
                    // Only return updated track if the block was actually found and updated
                    if (blockFoundInTrack) {
                        const newlyUpdatedTrack = { ...t, midiBlocks: updatedMidiBlocks };
                        // If this is the currently selected track, update the selectedTrack reference
                        if (state.selectedTrackId === trackId) {
                            updatedSelectedTrack = newlyUpdatedTrack;
                        }
                        return newlyUpdatedTrack;
                    }
                }
                return t;
            });
            
             // If the updated block was selected, update the selectedBlock state object too
            if (state.selectedBlockId === updatedBlock.id && blockStillExists) {
                return {
                    tracks: newTracks,
                    selectedBlock: updatedBlock, // Update the selectedBlock object directly
                    selectedTrack: updatedSelectedTrack // Update selectedTrack if it changed
                };
            } else {
                // Otherwise, just update the tracks array (and potentially selectedTrack if it was the parent)
                 return { 
                    tracks: newTracks,
                    selectedTrack: updatedSelectedTrack 
                };
            }
        });
    },
    
    removeMidiBlock: (trackId: string, blockId: string) => {
        set(state => {
            let selectedBlockWasRemoved = false;
             let updatedSelectedTrack = state.selectedTrack;

            // Update tracks array immutably
            const newTracks = state.tracks.map(t => {
                if (t.id === trackId) {
                    const originalLength = t.midiBlocks.length;
                    // Filter midiBlocks immutably
                    const updatedMidiBlocks = t.midiBlocks.filter(b => b.id !== blockId);
                    // Check if the selected block was the one removed
                    if (state.selectedBlockId === blockId && updatedMidiBlocks.length < originalLength) {
                        selectedBlockWasRemoved = true;
                    }
                    const newlyUpdatedTrack = { ...t, midiBlocks: updatedMidiBlocks };
                    // If this is the currently selected track, update the selectedTrack reference
                    if (state.selectedTrackId === trackId) {
                        updatedSelectedTrack = newlyUpdatedTrack;
                    }
                    return newlyUpdatedTrack;
                }
                return t;
            });

            // If the removed block was selected, clear the block selection
            if (selectedBlockWasRemoved) {
                 return {
                     tracks: newTracks,
                     selectedBlockId: null,
                     selectedBlock: null,
                     selectedTrack: updatedSelectedTrack // Keep updated selected track reference
                 };
            } else {
                // Otherwise, just update the tracks array and selected track if necessary
                 return { 
                    tracks: newTracks,
                    selectedTrack: updatedSelectedTrack 
                 };
            }
        });
    },

    selectNotes: (notes: MIDINote[]) => {
      set({ selectedNotes: notes });
    },
    
    updateTrack: (trackId: string, updatedProperties: Partial<Track>) => {
       set(state => {
             let selectedTrackStillExists = false;
             let newlySelectedTrackObject: Track | null = null; // To hold the updated selected track object

            // Update tracks array immutably
            const newTracks = state.tracks.map(t => {
                if (t.id === trackId) {
                    selectedTrackStillExists = true;
                    // Merge updated properties immutably
                    const updatedTrack = { ...t, ...updatedProperties };
                    // If this is the selected track, store its updated version
                    if (state.selectedTrackId === trackId) {
                        newlySelectedTrackObject = updatedTrack;
                    }
                    return updatedTrack;
                }
                return t;
            });


            // If the updated track was selected, update the selectedTrack object
            if (state.selectedTrackId === trackId && selectedTrackStillExists) {
                 return {
                     tracks: newTracks,
                     selectedTrack: newlySelectedTrackObject // Update selectedTrack object
                 };
            } else {
                 // Otherwise, just update the tracks array
                 return { tracks: newTracks };
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