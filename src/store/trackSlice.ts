import { StateCreator } from 'zustand';
import { Track, MIDIBlock, MIDINote } from '../lib/types';
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
  moveMidiBlock: (oldTrackId: string, newTrackId: string, block: MIDIBlock) => void;
  updateTrack: (trackId: string, updatedProperties: Partial<Track>) => void;
  selectNotes: (notes: MIDINote[]) => void;
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
      set((state: TrackState) => {
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
      set((state: TrackState & { tracks: Track[] }) => {
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
      set((state: TrackState & { tracks: Track[] }) => {
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
       set((state: TrackState & { tracks: Track[] }) => {
        const newTracks = state.tracks.filter((t: Track) => t.id !== trackId);
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
       set((state: TrackState & { tracks: Track[] }) => {
           let trackFound = false;
           const newTracks = state.tracks.map((t: Track) => {
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
        set((state: TrackState & { tracks: Track[] }) => {
            let trackUpdated = false;
            const newTracks = state.tracks.map((t: Track) => {
                if (t.id === trackId) {
                    let blockFoundInTrack = false;
                    const updatedMidiBlocks = t.midiBlocks.map((b: MIDIBlock) => {
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

            // Make sure numMeasures is extended if the block is moved outside the current track length
            const currentNumMeasures = get().numMeasures; // Get current numMeasures from timeSlice
            const requiredBeats = updatedBlock.endBeat;
            const requiredMeasures = Math.ceil(requiredBeats / 4); // Calculate measures needed for the block

            if (requiredMeasures > currentNumMeasures) {
                get().setNumMeasures(requiredMeasures); // Call action from timeSlice
            }

            return {
                tracks: newTracks,
                selectedTrack: selections.selectedTrack,
                selectedBlock: selections.selectedBlock
            };
        });
    },
    removeMidiBlock: (trackId: string, blockId: string) => {
        set((state: TrackState & { tracks: Track[] }) => {
            let trackUpdated = false;
            const newTracks = state.tracks.map((t: Track) => {
                if (t.id === trackId) {
                    const originalLength = t.midiBlocks.length;
                    const updatedMidiBlocks = t.midiBlocks.filter((b: MIDIBlock) => b.id !== blockId);
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
    moveMidiBlock: (oldTrackId: string, newTrackId: string, block: MIDIBlock) => {
        set((state: TrackState & { tracks: Track[] }) => {
            let blockMoved = false;
            const newTracks = state.tracks.map((t: Track) => {
                // Remove block from old track
                if (t.id === oldTrackId) {
                    const updatedMidiBlocks = t.midiBlocks.filter(b => b.id !== block.id);
                    if (updatedMidiBlocks.length < t.midiBlocks.length) {
                        blockMoved = true; // Mark moved only if actually found and removed
                        return { ...t, midiBlocks: updatedMidiBlocks };
                    }
                }
                // Add block to new track (potentially replacing existing if ID matched, though unlikely)
                if (t.id === newTrackId) {
                    // Ensure block isn't duplicated if somehow oldTrackId === newTrackId
                    const blockExists = t.midiBlocks.some(b => b.id === block.id);
                    if (!blockExists) {
                        return { ...t, midiBlocks: [...t.midiBlocks, block] };
                    } else {
                        // If block already exists (e.g., move within same track - should be handled by update), update it
                        return { ...t, midiBlocks: t.midiBlocks.map(b => b.id === block.id ? block : b) };
                    }
                }
                return t;
            });

            if (!blockMoved) {
                console.warn(`moveMidiBlock: Block ID ${block.id} not found in original track ID ${oldTrackId}. No move performed.`);
                return {}; // No change if block wasn't found in original track
            }

            // Update selections - keep block selected, update track ID if needed
            const selections = getUpdatedSelections(newTracks, newTrackId, block.id);

            return {
                tracks: newTracks,
                selectedTrackId: newTrackId, // Update selected track to the new one
                selectedBlockId: block.id, // Keep the block selected
                selectedTrack: selections.selectedTrack,
                selectedBlock: selections.selectedBlock
            };
        });
    },
    selectNotes: (notes: MIDINote[]) => {
      set({ selectedNotes: notes });
    },
    updateTrack: (trackId: string, updatedProperties: Partial<Track>) => {
       set((state: TrackState & { tracks: Track[] }) => {
            let trackUpdated = false;
            const newTracks = state.tracks.map((t: Track) => {
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
  };
} 