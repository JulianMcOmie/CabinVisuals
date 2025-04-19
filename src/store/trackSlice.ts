import { StateCreator } from 'zustand';
import { Track, MIDIBlock, MIDINote } from '../lib/types';
import { AppState } from './store'; // Import the combined AppState
import Effect from '../lib/Effect'; // Import Effect class

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
  moveMidiBlock: (blockId: string, oldTrackId: string, newTrackId: string, newStartBeat: number, newEndBeat: number) => void;
  updateTrack: (trackId: string, updatedProperties: Partial<Track>) => void;
  selectNotes: (notes: MIDINote[]) => void;
  reorderTracks: (draggedTrackId: string, targetTrackId: string | null) => void;
  // Effect Actions
  addEffectToTrack: (trackId: string, effectToAdd: Effect) => void;
  removeEffectFromTrack: (trackId: string, effectIndex: number) => void;
  updateEffectPropertyOnTrack: (trackId: string, effectIndex: number, propertyName: string, value: any) => void;
  // reorderEffectsOnTrack: (trackId: string, draggedIndex: number, targetIndex: number) => void; // Reordering skipped
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
    updateMidiBlock: (trackId: string, updatedBlockData: MIDIBlock) => {
        set((state) => {
            let trackUpdated = false;
            const newTracks = state.tracks.map((t: Track) => {
                if (t.id === trackId) {
                    let blockFoundInTrack = false;
                    const updatedMidiBlocks = t.midiBlocks.map((b: MIDIBlock) => {
                        if (b.id === updatedBlockData.id) {
                            blockFoundInTrack = true;
                            return { ...updatedBlockData }; 
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

            const currentNumMeasures = get().numMeasures; 
            const requiredBeats = updatedBlockData.endBeat; 
            const requiredMeasures = Math.ceil(requiredBeats / 4); 

            if (requiredMeasures > currentNumMeasures) {
                get().setNumMeasures(requiredMeasures);
            }

            const updatedSelections = getUpdatedSelections(newTracks, state.selectedTrackId, state.selectedBlockId);

            return {
                tracks: newTracks,
                selectedTrack: updatedSelections.selectedTrack, 
                selectedBlock: updatedSelections.selectedBlock 
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
    moveMidiBlock: (blockId: string, oldTrackId: string, newTrackId: string, newStartBeat: number, newEndBeat: number) => {
      set((state) => {
        const oldTrack = state.tracks.find(t => t.id === oldTrackId);
        if (!oldTrack) return {}; // Old track not found

        const blockToMove = oldTrack.midiBlocks.find(b => b.id === blockId);
        if (!blockToMove) return {}; // Block not found in old track

        // Create the NEW block object with updated position and notes (notes themselves aren't changed by move)
        const movedBlock = {
          ...blockToMove,
          startBeat: newStartBeat,
          endBeat: newEndBeat,
        };

        const newTracks = state.tracks.map(track => {
          // 1. Remove from Old Track
          if (track.id === oldTrackId) {
            const updatedMidiBlocks = track.midiBlocks.filter(b => b.id !== blockId);
            return { ...track, midiBlocks: updatedMidiBlocks };
          }
          // 2. Add to New Track
          if (track.id === newTrackId) {
            const updatedMidiBlocks = [...track.midiBlocks, movedBlock].sort((a, b) => a.startBeat - b.startBeat);
            return { ...track, midiBlocks: updatedMidiBlocks };
          }
          // 3. Return unchanged tracks
          return track;
        });

        // Update selections - keep block selected, update track ID if needed
        const selections = getUpdatedSelections(newTracks, newTrackId, blockId);

        // Ensure numMeasures accommodates the moved block
        const currentNumMeasures = get().numMeasures;
        const requiredBeats = movedBlock.endBeat;
        const requiredMeasures = Math.ceil(requiredBeats / 4);
        if (requiredMeasures > currentNumMeasures) {
            get().setNumMeasures(requiredMeasures);
        }

        return {
          tracks: newTracks,
          selectedTrackId: newTrackId, // Explicitly update selected track ID
          selectedBlockId: blockId, // Keep moved block selected
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
    reorderTracks: (draggedTrackId: string, targetTrackId: string | null) => {
      set((state: TrackState & { tracks: Track[] }) => {
        const currentTracks = state.tracks;
        const draggedIndex = currentTracks.findIndex(t => t.id === draggedTrackId);

        if (draggedIndex === -1) {
          console.warn(`reorderTracks: Dragged track ID ${draggedTrackId} not found.`);
          return {}; // Do nothing if dragged track not found
        }

        const newTracks = [...currentTracks];
        const [draggedItem] = newTracks.splice(draggedIndex, 1);

        if (targetTrackId === null) {
          // Dropped at the end
          newTracks.push(draggedItem);
        } else {
          // Dropped before targetTrackId
          const targetIndex = newTracks.findIndex(t => t.id === targetTrackId);

          if (targetIndex === -1) {
            console.warn(`reorderTracks: Target track ID ${targetTrackId} not found. Appending to end.`);
            newTracks.push(draggedItem); // Fallback: append to end if target not found
          } else {
             newTracks.splice(targetIndex, 0, draggedItem);
          }
        }

        // Update selections after reordering (selected track/block remain the same, references might change)
        const selections = getUpdatedSelections(newTracks, state.selectedTrackId, state.selectedBlockId);

        return {
          tracks: newTracks,
          selectedTrack: selections.selectedTrack,
          selectedBlock: selections.selectedBlock
        };
      });
    },
    // --- Effect Actions Implementations ---
    addEffectToTrack: (trackId: string, effectToAdd: Effect) => {
      set((state) => {
        const newTracks = state.tracks.map(track => {
          if (track.id === trackId) {
            const clonedEffect = effectToAdd.clone(); // Clone the effect before adding
            const updatedEffects = [...(track.effects || []), clonedEffect];
            return { ...track, effects: updatedEffects };
          }
          return track;
        });
        const selections = getUpdatedSelections(newTracks, state.selectedTrackId, state.selectedBlockId);
        return { 
          tracks: newTracks,
          selectedTrack: selections.selectedTrack, // Update selected track reference
          selectedBlock: selections.selectedBlock
        };
      });
    },
    removeEffectFromTrack: (trackId: string, effectIndex: number) => {
      set((state) => {
        const newTracks = state.tracks.map(track => {
          if (track.id === trackId) {
            const currentEffects = track.effects || [];
            if (effectIndex >= 0 && effectIndex < currentEffects.length) {
              const updatedEffects = [
                ...currentEffects.slice(0, effectIndex),
                ...currentEffects.slice(effectIndex + 1)
              ];
              return { ...track, effects: updatedEffects };
            }
          }
          return track;
        });
        const selections = getUpdatedSelections(newTracks, state.selectedTrackId, state.selectedBlockId);
        return { 
          tracks: newTracks,
          selectedTrack: selections.selectedTrack, // Update selected track reference
          selectedBlock: selections.selectedBlock
        };
      });
    },
    updateEffectPropertyOnTrack: (trackId: string, effectIndex: number, propertyName: string, value: any) => {
      set((state) => {
        const newTracks = state.tracks.map(track => {
          if (track.id === trackId) {
            const currentEffects = track.effects || [];
            if (effectIndex >= 0 && effectIndex < currentEffects.length) {
              const effectToUpdate = currentEffects[effectIndex];
              const clonedEffect = effectToUpdate.clone(); // Clone the specific effect
              clonedEffect.setPropertyValue(propertyName, value); // Update the property on the clone
              
              const updatedEffects = [
                ...currentEffects.slice(0, effectIndex),
                clonedEffect, // Replace with the updated clone
                ...currentEffects.slice(effectIndex + 1)
              ];
              return { ...track, effects: updatedEffects };
            }
          }
          return track;
        });
        const selections = getUpdatedSelections(newTracks, state.selectedTrackId, state.selectedBlockId);
        return { 
          tracks: newTracks,
          selectedTrack: selections.selectedTrack, // Update selected track reference
          selectedBlock: selections.selectedBlock
        };
      });
    },
  };
} 