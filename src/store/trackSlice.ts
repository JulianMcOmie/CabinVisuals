import { StateCreator } from 'zustand';
import { Track, MIDIBlock, MIDINote } from '../lib/types';
import { AppState } from './store'; // Import the combined AppState
import Effect from '../lib/Effect'; // Import Effect class
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import * as supabaseService from '@/Persistence/supabase-service';

// Track Slice
export interface TrackState {
  tracks: Track[];
  selectedTrackId: string | null;
  selectedBlockId: string | null;
  selectedTrack: Track | null;
  selectedBlock: MIDIBlock | null;
  selectedNotes: MIDINote[] | null;
  clipboardBlock: MIDIBlock | null; // Added for copy/paste
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
  setClipboardBlock: (block: MIDIBlock | null) => void; // Added for copy/paste
  // Effect Actions
  addEffectToTrack: (trackId: string, effectToAdd: Effect) => void;
  removeEffectFromTrack: (trackId: string, effectIndex: number) => void;
  updateEffectPropertyOnTrack: (trackId: string, effectIndex: number, propertyName: string, value: any) => void;
  reorderEffectsOnTrack: (trackId: string, draggedIndex: number, targetIndex: number) => void;
  splitMidiBlock: (trackId: string, blockId: string, splitBeat: number) => void; // Added for splitting
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
    // --- helpers ---
    // Ensure IDs are UUIDs to satisfy Supabase uuid PKs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _ensureUuid: (id: any): string => (typeof id === 'string' && uuidValidate(id) ? id : uuidv4()),
    tracks: [],
    selectedTrackId: null,
    selectedBlockId: null,
    selectedTrack: null,
    selectedBlock: null,
    selectedNotes: null,
    clipboardBlock: null, // Initial state for clipboard
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
      
      // Set detail view mode to instrument only when selecting a track (no block)
      // and current mode is midi
      if (trackId) {
        const currentDetailViewMode = get().detailViewMode;
        if (currentDetailViewMode === "midi") {
          get().setDetailViewMode("instrument");
        }
      }
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
      
      // Set detail view mode to midi when selecting a block
      if (blockId) {
        get().setDetailViewMode("midi");
      }
    },
    addTrack: (track: Track) => {
      const ensureUuid = (get() as any)._ensureUuid as (id: string) => string;
      const ensuredTrack: Track = { ...track, id: ensureUuid(track.id) };
      set((state: TrackState & { tracks: Track[] }) => {
        const newTracks = [...state.tracks, ensuredTrack];
        const newSelectedTrackId = ensuredTrack.id;
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
      // Persist to Supabase
      const projectId = get().currentLoadedProjectId;
      const order = get().tracks.findIndex(t => t.id === ensuredTrack.id);
      if (projectId && order >= 0) {
        void supabaseService.saveTrack({
          id: ensuredTrack.id,
          projectId,
          name: ensuredTrack.name,
          isMuted: ensuredTrack.isMuted,
          isSoloed: ensuredTrack.isSoloed,
          order,
        });
      }
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
       // Persist to Supabase
       void supabaseService.deleteTrack(trackId);
    },
    addMidiBlock: (trackId: string, block: MIDIBlock) => {
       const ensureUuid = (get() as any)._ensureUuid as (id: string) => string;
       const ensuredBlockId = ensureUuid(block.id);
       const ensuredNotes = (block.notes || []).map(n => ({ ...n, id: ensureUuid(n.id) }));
       const ensuredBlock: MIDIBlock = { ...block, id: ensuredBlockId, notes: ensuredNotes };
       set((state: TrackState & { tracks: Track[] }) => {
           let trackFound = false;
           const newTracks = state.tracks.map((t: Track) => {
               if (t.id === trackId) {
                   trackFound = true;
                   return { ...t, midiBlocks: [...t.midiBlocks, ensuredBlock] };
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
       // Persist to Supabase: ensure block is saved before notes to satisfy FK/RLS
       (async () => {
         await supabaseService.saveMidiBlock({
           id: ensuredBlockId,
           trackId,
           startBeat: ensuredBlock.startBeat,
           endBeat: ensuredBlock.endBeat,
         });
         if (ensuredNotes && ensuredNotes.length > 0) {
           await supabaseService.saveMidiNotesBatch(
             ensuredNotes.map(n => ({ id: n.id, startBeat: n.startBeat, duration: n.duration, velocity: n.velocity, pitch: n.pitch })),
             ensuredBlockId
           );
         }
       })();
    },
    updateMidiBlock: (trackId: string, updatedBlockData: MIDIBlock) => {
        // Determine notes removed (Supabase upsert won't delete missing notes)
        const prevTracks = get().tracks;
        const prevBlock = prevTracks
          .find(t => t.id === trackId)?.midiBlocks
          .find(b => b.id === updatedBlockData.id);
        const prevNoteIds = new Set((prevBlock?.notes || []).map(n => String(n.id)));
        const nextNoteIds = new Set((updatedBlockData.notes || []).map(n => String(n.id)));
        const removedNoteIds: string[] = Array.from(prevNoteIds).filter(id => !nextNoteIds.has(id));

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
        // Persist to Supabase: block and notes
        (async () => {
          await supabaseService.saveMidiBlock({
            id: updatedBlockData.id,
            trackId,
            startBeat: updatedBlockData.startBeat,
            endBeat: updatedBlockData.endBeat,
          });
          if (updatedBlockData.notes) {
            const notesPayload = updatedBlockData.notes.map(n => ({ id: String(n.id), startBeat: n.startBeat, duration: n.duration, velocity: n.velocity, pitch: n.pitch }));
            await supabaseService.saveMidiNotesBatch(notesPayload, updatedBlockData.id);
          }
        })();
        // Explicitly delete removed notes
        if (removedNoteIds.length > 0) {
          removedNoteIds.forEach(id => { void supabaseService.deleteMidiNote(id); });
        }
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
        // Persist to Supabase
        void supabaseService.deleteMidiBlock(blockId);
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
      // Persist to Supabase: update moved block position
      const moved = get().tracks.find(t => t.id === newTrackId)?.midiBlocks.find(b => b.id === blockId);
      if (moved) {
        (async () => {
          await supabaseService.saveMidiBlock({ id: moved.id, trackId: newTrackId, startBeat: moved.startBeat, endBeat: moved.endBeat });
          if (moved.notes && moved.notes.length > 0) {
            const notesPayload = moved.notes.map(n => ({ id: String(n.id), startBeat: n.startBeat, duration: n.duration, velocity: n.velocity, pitch: n.pitch }));
            await supabaseService.saveMidiNotesBatch(notesPayload, moved.id);
          }
        })();
      }
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
       // Persist to Supabase
       const projectId = get().currentLoadedProjectId;
       const t = get().tracks.find(t => t.id === trackId);
       if (projectId && t) {
         const order = get().tracks.findIndex(tt => tt.id === trackId);
         void supabaseService.saveTrack({
           id: trackId,
           projectId,
           name: t.name,
           isMuted: t.isMuted,
           isSoloed: t.isSoloed,
           order,
         });
       }
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
      // Persist new order to Supabase
      const projectId = get().currentLoadedProjectId;
      if (projectId) {
        const tracksNow = get().tracks;
        tracksNow.forEach((t, idx) => {
          void supabaseService.saveTrack({
            id: t.id,
            projectId,
            name: t.name,
            isMuted: t.isMuted,
            isSoloed: t.isSoloed,
            order: idx,
          });
        });
      }
    },
    setClipboardBlock: (block: MIDIBlock | null) => {
        set({ clipboardBlock: block });
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
      // Persist effect to Supabase
      const track = get().tracks.find(t => t.id === trackId);
      const effectIndex = track?.effects ? track.effects.length - 1 : -1;
      const effect = track?.effects?.[effectIndex];
      if (effect && effectIndex >= 0) {
        const settings: Record<string, any> = {};
        effect.properties.forEach((prop, key) => { settings[key] = prop.value; });
        void supabaseService.saveEffect({
          id: effect.id,
          trackId,
          type: effect.constructor.name,
          settings,
          order: effectIndex,
        });
      }
    },
    removeEffectFromTrack: (trackId: string, effectIndex: number) => {
      let deletedEffectId: string | null = null;
      // Get ID *before* state update
      const track = get().tracks.find(t => t.id === trackId);
      if (track && track.effects && effectIndex >= 0 && effectIndex < track.effects.length) {
          deletedEffectId = track.effects[effectIndex].id;
      }

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
      // Persist to Supabase
      if (deletedEffectId) {
          void supabaseService.deleteEffect(deletedEffectId);
      } else {
           console.warn("Could not determine effect ID to delete for persistence in removeEffectFromTrack action.");
      }
    },
    updateEffectPropertyOnTrack: (trackId: string, effectIndex: number, propertyName: string, value: any) => {
      set((state) => {
        const newTracks = state.tracks.map(track => {
          if (track.id === trackId) {
            const currentEffects = track.effects || [];
            if (effectIndex >= 0 && effectIndex < currentEffects.length) {
              const effectToUpdate = currentEffects[effectIndex];
              console.log(`Updating effect: ${effectToUpdate.id} with property: ${propertyName} to value: ${value}`);
              const clonedEffect = effectToUpdate.clone(); // Clone the specific effect
              console.log(`Cloned effect: ${clonedEffect.id}`);
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
      // Persist to Supabase
      const track = get().tracks.find(t => t.id === trackId);
      const eff = track?.effects?.[effectIndex];
      if (eff) {
        const settings: Record<string, any> = {};
        eff.properties.forEach((prop, key) => { settings[key] = prop.value; });
        void supabaseService.saveEffect({
          id: eff.id,
          trackId,
          type: eff.constructor.name,
          settings,
          order: effectIndex,
        });
      }
    },
    reorderEffectsOnTrack: (trackId: string, draggedIndex: number, targetIndex: number) => {
      set((state) => {
          const newTracks = state.tracks.map(track => {
              if (track.id === trackId) {
                  const currentEffects = [...(track.effects || [])]; // Create a mutable copy

                  // Validate indices - targetIndex can be equal to length for appending
                  if (draggedIndex >= 0 && draggedIndex < currentEffects.length &&
                      targetIndex >= 0 && targetIndex <= currentEffects.length) {

                      const [draggedEffect] = currentEffects.splice(draggedIndex, 1); // Remove the dragged effect
                      currentEffects.splice(targetIndex, 0, draggedEffect); // Insert at the target index

                      return { ...track, effects: currentEffects }; // Return updated track

                  } else {
                      console.warn(`reorderEffectsOnTrack: Invalid indices (dragged: ${draggedIndex}, target: ${targetIndex}) for track ${trackId}.`);
                      // Return the track unchanged if indices are invalid
                      return track;
                  }
              }
              // Return other tracks unchanged
              return track;
          });

          // Selections don't change, but get updated references
          const selections = getUpdatedSelections(newTracks, state.selectedTrackId, state.selectedBlockId);

          return {
              tracks: newTracks,
              selectedTrack: selections.selectedTrack,
              selectedBlock: selections.selectedBlock
          };
      });
      // Persist new order to Supabase
      const track = get().tracks.find(t => t.id === trackId);
      if (track?.effects) {
        track.effects.forEach((eff, idx) => {
          const settings: Record<string, any> = {};
          eff.properties.forEach((prop, key) => { settings[key] = prop.value; });
          void supabaseService.saveEffect({
            id: eff.id,
            trackId,
            type: eff.constructor.name,
            settings,
            order: idx,
          });
        });
      }
    },
    splitMidiBlock: (trackId: string, blockId: string, splitBeat: number) => {
      let newBlockId2: string | null = null; // Need to capture the ID of the second block generated
      set((state) => {
        const tracks = state.tracks;
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex === -1) return {}; // Track not found

        const track = tracks[trackIndex];
        const blockIndex = track.midiBlocks.findIndex(b => b.id === blockId);
        if (blockIndex === -1) return {}; // Block not found

        const blockToSplit = track.midiBlocks[blockIndex];

        // Condition: Split beat must be strictly within the block
        if (!(splitBeat > blockToSplit.startBeat && splitBeat < blockToSplit.endBeat)) {
          return {}; // Do nothing if split point is at the edge or outside
        }

        const newBlockId1 = blockToSplit.id; // Keep original ID for the first part
        const newBlockId2 = uuidv4(); // Unique ID for the second part

        const notes1: MIDINote[] = [];
        const notes2: MIDINote[] = [];

        blockToSplit.notes.forEach(note => {
          const noteEndBeat = note.startBeat + note.duration;
          if (note.startBeat < splitBeat) {
            // Note starts before split point, goes to block 1
            const newDuration = Math.min(note.duration, splitBeat - note.startBeat);
            notes1.push({ ...note, duration: newDuration });
          } else {
            // Note starts at or after split point, goes to block 2
            notes2.push(note);
          }
        });

        const newBlock1: MIDIBlock = {
          ...blockToSplit,
          id: newBlockId1,
          endBeat: splitBeat,
          notes: notes1,
        };

        const newBlock2: MIDIBlock = {
          ...blockToSplit, // Copy color etc.
          id: newBlockId2,
          startBeat: splitBeat,
          // endBeat remains the same
          notes: notes2,
        };

        // Update the track's midiBlocks
        const updatedMidiBlocks = [
          ...track.midiBlocks.slice(0, blockIndex),
          newBlock1,
          newBlock2,
          ...track.midiBlocks.slice(blockIndex + 1)
        ].sort((a, b) => a.startBeat - b.startBeat); // Ensure sorted order

        const newTracks = [
          ...tracks.slice(0, trackIndex),
          { ...track, midiBlocks: updatedMidiBlocks },
          ...tracks.slice(trackIndex + 1)
        ];

        // Update selection to keep the first part selected
        const selections = getUpdatedSelections(newTracks, trackId, newBlockId1);

        return {
          tracks: newTracks,
          selectedTrackId: trackId,
          selectedBlockId: newBlockId1,
          selectedTrack: selections.selectedTrack,
          selectedBlock: selections.selectedBlock,
          selectedNotes: null, // Clear note selection after split
        };
      });
      // Persist to Supabase: save both new blocks and their notes
      const track = get().tracks.find(t => t.id === trackId);
      const newBlock1 = track?.midiBlocks.find(b => b.id === blockId);
      const newBlock2 = track?.midiBlocks.find(b => b.id === newBlockId2!);
      if (newBlock1) {
        (async () => {
          await supabaseService.saveMidiBlock({ id: newBlock1.id, trackId, startBeat: newBlock1.startBeat, endBeat: newBlock1.endBeat });
          if (newBlock1.notes?.length) {
            const notesPayload = newBlock1.notes.map(n => ({ id: String(n.id), startBeat: n.startBeat, duration: n.duration, velocity: n.velocity, pitch: n.pitch }));
            await supabaseService.saveMidiNotesBatch(notesPayload, newBlock1.id);
          }
        })();
      }
      if (newBlock2) {
        (async () => {
          await supabaseService.saveMidiBlock({ id: newBlock2.id, trackId, startBeat: newBlock2.startBeat, endBeat: newBlock2.endBeat });
          if (newBlock2.notes?.length) {
            const notesPayload = newBlock2.notes.map(n => ({ id: String(n.id), startBeat: n.startBeat, duration: n.duration, velocity: n.velocity, pitch: n.pitch }));
            await supabaseService.saveMidiNotesBatch(notesPayload, newBlock2.id);
          }
        })();
      }
      if (!newBlock2) {
           console.error("Could not determine ID of second block after split for persistence.");
      }
    },
  };
} 