import { StateCreator } from 'zustand';
import { Track, MIDIBlock, MIDINote, VisualObject } from '../lib/types';
import { AppState } from './store'; // Import the combined AppState

// Track Slice
export interface TrackState {
  tracks: Track[];
  selectedTrackId: string | null;
  selectedBlockId: string | null;
  selectedTrack: Track | null;
  selectedBlock: MIDIBlock | null;
  selectedNotes: MIDINote[] | null;
}

export interface TrackActions {
  selectTrack: (trackId: string | null) => void;
  selectBlock: (blockId: string | null) => void;
  addTrack: (track: Track) => void;
  removeTrack: (trackId: string) => void;
  addMidiBlock: (trackId: string, block: MIDIBlock) => void;
  updateMidiBlock: (trackId: string, block: MIDIBlock) => void;
  removeMidiBlock: (trackId: string, blockId: string) => void;
  updateTrack: (trackId: string, updatedProperties: Partial<Track>) => void;
  selectNotes: (notes: MIDINote[]) => void;
  getVisualObjectsAtTime: (time: number) => VisualObject[];
}

export type TrackSlice = TrackState & TrackActions;

export const createTrackSlice: StateCreator<
  AppState,
  [],
  [],
  TrackSlice
> = (set, get) => {
  // Helper function remains internal to track logic
  const getUpdatedSelections = (tracks: Track[], selectedTrackId: string | null, selectedBlockId: string | null)
    : { selectedTrack: Track | null, selectedBlock: MIDIBlock | null } => {
    
    let selectedTrack: Track | null = null;
    let selectedBlock: MIDIBlock | null = null;

    if (selectedTrackId) {
      selectedTrack = tracks.find(t => t.id === selectedTrackId) || null;
      if (selectedTrack && selectedBlockId) {
        selectedBlock = selectedTrack.midiBlocks.find(b => b.id === selectedBlockId) || null;
      }
    }
    return { selectedTrack, selectedBlock };
  };

  return {
    tracks: [],
    selectedTrackId: null,
    selectedBlockId: null,
    selectedTrack: null,
    selectedBlock: null,
    selectedNotes: null,
    selectTrack: (trackId: string | null) => {
      set(state => {
        const newSelectedTrackId = trackId;
        const newSelectedBlockId = null;
        const selections = getUpdatedSelections(state.tracks, newSelectedTrackId, newSelectedBlockId);
        return { 
            selectedTrackId: newSelectedTrackId,
            selectedBlockId: newSelectedBlockId,
            selectedTrack: selections.selectedTrack,
            selectedBlock: selections.selectedBlock,
            selectedNotes: null
        };
      });
    },
    selectBlock: (blockId: string | null) => {
      set(state => {
          let newSelectedTrackId: string | null = null;
          const newSelectedBlockId = blockId;

          if (blockId) {
              let found = false;
              for (const track of state.tracks) {
                  if (track.midiBlocks.some((b: MIDIBlock) => b.id === blockId)) {
                      newSelectedTrackId = track.id;
                      found = true;
                      break; 
                  }
              }
              if (!found) {
                  newSelectedTrackId = null;
              }
          } else {
             newSelectedTrackId = state.selectedTrackId;
          }

          const selections = getUpdatedSelections(state.tracks, newSelectedTrackId, newSelectedBlockId);
          
          return {
              selectedTrackId: newSelectedTrackId,
              selectedBlockId: newSelectedBlockId,
              selectedTrack: selections.selectedTrack,
              selectedBlock: selections.selectedBlock,
              selectedNotes: null
          };
      });
    },
    addTrack: (track: Track) => {
      set(state => {
        const newTracks = [...state.tracks, track];
        const newSelectedTrackId = track.id;
        const newSelectedBlockId = null;
        const selections = getUpdatedSelections(newTracks, newSelectedTrackId, newSelectedBlockId);
        return { 
          tracks: newTracks,
          selectedTrackId: newSelectedTrackId,
          selectedBlockId: newSelectedBlockId,
          selectedTrack: selections.selectedTrack,
          selectedBlock: selections.selectedBlock,
          selectedNotes: null
        };
      });
    },
    removeTrack: (trackId: string) => {
       set(state => {
        const newTracks = state.tracks.filter(t => t.id !== trackId);
        let newSelectedTrackId = state.selectedTrackId;
        let newSelectedBlockId = state.selectedBlockId;

        if (state.selectedTrackId === trackId) {
          newSelectedTrackId = null;
          newSelectedBlockId = null;
        }

        const selections = getUpdatedSelections(newTracks, newSelectedTrackId, newSelectedBlockId);

        return {
            tracks: newTracks,
            selectedTrackId: newSelectedTrackId,
            selectedBlockId: newSelectedBlockId,
            selectedTrack: selections.selectedTrack,
            selectedBlock: selections.selectedBlock,
            selectedNotes: selections.selectedTrack ? state.selectedNotes : null
          };
       });
    },
    addMidiBlock: (trackId: string, block: MIDIBlock) => {
       set(state => {
           let trackFound = false;
           const newTracks = state.tracks.map(t => {
               if (t.id === trackId) {
                   trackFound = true;
                   return { ...t, midiBlocks: [...t.midiBlocks, block] };
               }
               return t;
           });

           if (!trackFound) return {}; 

           const selections = getUpdatedSelections(newTracks, state.selectedTrackId, state.selectedBlockId);

            return { 
                tracks: newTracks,
                selectedTrack: selections.selectedTrack,
                selectedBlock: selections.selectedBlock,
            };
       });
    },
    updateMidiBlock: (trackId: string, updatedBlock: MIDIBlock) => {
        set(state => {
            let trackUpdated = false;
            const newTracks = state.tracks.map(t => {
                if (t.id === trackId) {
                    let blockFoundInTrack = false;
                    const updatedMidiBlocks = t.midiBlocks.map(b => {
                        if (b.id === updatedBlock.id) {
                            blockFoundInTrack = true;
                            return updatedBlock;
                        }
                        return b;
                    });
                    
                    if (blockFoundInTrack) {
                        trackUpdated = true;
                        return { ...t, midiBlocks: updatedMidiBlocks };
                    }
                }
                return t;
            });
            
            if (!trackUpdated) return {};

            const selections = getUpdatedSelections(newTracks, state.selectedTrackId, state.selectedBlockId);

            return {
                tracks: newTracks,
                selectedTrack: selections.selectedTrack,
                selectedBlock: selections.selectedBlock 
            };
        });
    },
    removeMidiBlock: (trackId: string, blockId: string) => {
        set(state => {
            let trackUpdated = false;
            const newTracks = state.tracks.map(t => {
                if (t.id === trackId) {
                    const originalLength = t.midiBlocks.length;
                    const updatedMidiBlocks = t.midiBlocks.filter(b => b.id !== blockId);
                    if (updatedMidiBlocks.length < originalLength) {
                        trackUpdated = true;
                        return { ...t, midiBlocks: updatedMidiBlocks };
                    }
                }
                return t;
            });

            if (!trackUpdated) return {};

            let newSelectedTrackId = state.selectedTrackId;
            let newSelectedBlockId = state.selectedBlockId;

            if (state.selectedBlockId === blockId) {
                 newSelectedBlockId = null;
            }

            const selections = getUpdatedSelections(newTracks, newSelectedTrackId, newSelectedBlockId);

            return {
                 tracks: newTracks,
                 selectedTrackId: newSelectedTrackId,
                 selectedBlockId: newSelectedBlockId,
                 selectedTrack: selections.selectedTrack,
                 selectedBlock: selections.selectedBlock,
             };
        });
    },
    selectNotes: (notes: MIDINote[]) => {
      set({ selectedNotes: notes });
    },
    updateTrack: (trackId: string, updatedProperties: Partial<Track>) => {
       set(state => {
            let trackUpdated = false;
            const newTracks = state.tracks.map(t => {
                if (t.id === trackId) {
                    trackUpdated = true;
                    return { ...t, ...updatedProperties }; 
                }
                return t;
            });

            if (!trackUpdated) return {};

            const selections = getUpdatedSelections(newTracks, state.selectedTrackId, state.selectedBlockId);

            return {
                 tracks: newTracks,
                 selectedTrack: selections.selectedTrack,
                 selectedBlock: selections.selectedBlock 
             };
       });
    },
    getVisualObjectsAtTime: (time: number): VisualObject[] => {
        // Access state from other slices via get()
        const { tracks, bpm } = get();
        let allVisuals: VisualObject[] = [];
        const secondsPerBeat = 60 / bpm;

        tracks.forEach(track => {
            if (track.synthesizer && typeof (track.synthesizer as any).getVisuals === 'function') {
                track.midiBlocks.forEach(block => {
                    const blockStartBeat = block.startBeat;
                    const blockEndBeat = block.endBeat; 
                    const durationInBeats = blockEndBeat - blockStartBeat;
                    
                    const blockStartTimeSeconds = blockStartBeat * secondsPerBeat;
                    const blockEndTimeSeconds = blockEndBeat * secondsPerBeat;
                    
                    if (time >= blockStartTimeSeconds && time < blockEndTimeSeconds) {
                       const timeWithinBlockSeconds = time - blockStartTimeSeconds;
                       const blockDurationSeconds = durationInBeats * secondsPerBeat;
                       const synth = track.synthesizer as any; 
                       const blockVisuals = synth.getVisuals(
                           block.notes,
                           blockDurationSeconds,
                           timeWithinBlockSeconds,
                           block.id
                       );
                       
                       if(blockVisuals) {
                           const visualsArray = Array.isArray(blockVisuals) ? blockVisuals : [blockVisuals];
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
  };
} 