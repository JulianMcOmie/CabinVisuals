import { AppState } from '../../store';
import { Track, MIDIBlock } from '@/lib/types';
import * as supabaseService from '@/Persistence/supabase-service';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { serializeSynth, serializeEffect } from '@/utils/persistenceUtils';

const logError = (action: string, error: any) => {
    console.error(`Supabase Persistence Error [${action}]:`, error);
};

const _ensureUuid = (id: string | undefined): string => {
    return id && uuidValidate(id) ? id : uuidv4();
};

// --- Persistence Functions ---

export const persistAddTrack = async (get: () => AppState, track: Track) => {
    try {
        const projectId = get().currentLoadedProjectId;
        if (!projectId) throw new Error("No project loaded");
        
        const order = get().tracks.length - 1;
        
        await supabaseService.saveTrack({
            id: track.id,
            projectId,
            name: track.name,
            isMuted: track.isMuted,
            isSoloed: track.isSoloed,
            order,
        });

        if (track.synthesizer) {
            const synthData = serializeSynth(track.synthesizer, track.id);
            if (synthData) {
                try { console.log('[DEBUG] persistAddTrack.serializeSynth:', synthData); } catch {}
                await supabaseService.saveSynth({
                    trackId: track.id,
                    type: synthData.type,
                    settings: synthData.settings,
                });
            }
        }
    } catch (error) {
        logError('addTrack', error);
    }
};

export const persistRemoveTrack = async (get: () => AppState, trackId: string) => {
    try {
        await supabaseService.deleteTrack(trackId);

        // Update order of remaining tracks
        const finalTracks = get().tracks;
        const projectId = get().currentLoadedProjectId;
        if (projectId) {
            const updatePromises = finalTracks.map((t, index) =>
                supabaseService.saveTrack({
                    id: t.id,
                    projectId,
                    name: t.name,
                    isMuted: t.isMuted,
                    isSoloed: t.isSoloed,
                    order: index,
                })
            );
            await Promise.all(updatePromises);
        }
    } catch (error) {
        logError('removeTrack', error);
    }
};

export const persistAddMidiBlock = async (get: () => AppState, trackId: string, block: MIDIBlock) => {
    try {
        await supabaseService.saveMidiBlock({
            id: block.id,
            trackId,
            startBeat: block.startBeat,
            endBeat: block.endBeat,
        });

        if (block.notes && block.notes.length > 0) {
            await supabaseService.saveMidiNotesBatch(
                block.notes.map(n => ({
                    id: String(n.id),
                    startBeat: n.startBeat,
                    duration: n.duration,
                    velocity: n.velocity,
                    pitch: n.pitch,
                })),
                block.id
            );
        }
    } catch (error) {
        logError('addMidiBlock', error);
    }
};

export const persistUpdateMidiBlock = async (get: () => AppState, trackId: string, updatedBlock: MIDIBlock, previousBlock?: MIDIBlock) => {
    try {
        await supabaseService.saveMidiBlock({
            id: updatedBlock.id,
            trackId,
            startBeat: updatedBlock.startBeat,
            endBeat: updatedBlock.endBeat,
        });

        // Handle notes deletion if previousBlock is provided
        if (previousBlock && updatedBlock.notes) {
            const previousNoteIds = new Set((previousBlock.notes || []).map(n => n.id));
            const currentNoteIds = new Set(updatedBlock.notes.map(n => n.id));
            const removedNoteIds = Array.from(previousNoteIds).filter(id => !currentNoteIds.has(id));

            for (const noteId of removedNoteIds) {
                await supabaseService.deleteMidiNote(String(noteId));
            }
        }

        // Save all current notes
        if (updatedBlock.notes && updatedBlock.notes.length > 0) {
            await supabaseService.saveMidiNotesBatch(
                updatedBlock.notes.map(n => ({
                    id: String(n.id),
                    startBeat: n.startBeat,
                    duration: n.duration,
                    velocity: n.velocity,
                    pitch: n.pitch,
                })),
                updatedBlock.id
            );
        }
    } catch (error) {
        logError('updateMidiBlock', error);
    }
};

export const persistRemoveMidiBlock = async (get: () => AppState, blockId: string) => {
    try {
        await supabaseService.deleteMidiBlock(blockId);
    } catch (error) {
        logError('removeMidiBlock', error);
    }
};

export const persistMoveMidiBlock = async (get: () => AppState, blockId: string, oldTrackId: string, newTrackId: string, movedBlock: MIDIBlock) => {
    try {
        await supabaseService.saveMidiBlock({
            id: blockId,
            trackId: newTrackId,
            startBeat: movedBlock.startBeat,
            endBeat: movedBlock.endBeat,
        });

        if (movedBlock.notes && movedBlock.notes.length > 0) {
            await supabaseService.saveMidiNotesBatch(
                movedBlock.notes.map(n => ({
                    id: String(n.id),
                    startBeat: n.startBeat,
                    duration: n.duration,
                    velocity: n.velocity,
                    pitch: n.pitch,
                })),
                blockId
            );
        }
    } catch (error) {
        logError('moveMidiBlock', error);
    }
};

export const persistUpdateTrack = async (get: () => AppState, trackId: string, updatedProperties: Partial<Track>) => {
    try {
        const finalState = get();
        const projectId = finalState.currentLoadedProjectId;
        const updatedTrack = finalState.tracks.find(t => t.id === trackId);
        const trackOrder = finalState.tracks.findIndex(t => t.id === trackId);

        if (!projectId) throw new Error("No project loaded");
        if (!updatedTrack || trackOrder === -1) throw new Error("Updated track not found");

        await supabaseService.saveTrack({
            id: updatedTrack.id,
            projectId,
            name: updatedTrack.name,
            isMuted: updatedTrack.isMuted,
            isSoloed: updatedTrack.isSoloed,
            order: trackOrder,
        });

        if ('synthesizer' in updatedProperties && updatedTrack.synthesizer) {
            const synthData = serializeSynth(updatedTrack.synthesizer, trackId);
            if (synthData) {
                try { console.log('[DEBUG] persistUpdateTrack.serializeSynth:', synthData); } catch {}
                await supabaseService.saveSynth({
                    trackId,
                    type: synthData.type,
                    settings: synthData.settings,
                });
            }
        }
    } catch (error) {
        logError('updateTrack', error);
    }
};

export const persistReorderTracks = async (get: () => AppState) => {
    try {
        const finalTracks = get().tracks;
        const projectId = get().currentLoadedProjectId;
        if (!projectId) throw new Error("No project loaded");

        const savePromises = finalTracks.map((track, index) =>
            supabaseService.saveTrack({
                id: track.id,
                projectId,
                name: track.name,
                isMuted: track.isMuted,
                isSoloed: track.isSoloed,
                order: index,
            })
        );
        await Promise.all(savePromises);
    } catch (error) {
        logError('reorderTracks', error);
    }
};

export const persistAddEffectToTrack = async (get: () => AppState, trackId: string) => {
    try {
        const finalState = get();
        const track = finalState.tracks.find(t => t.id === trackId);
        if (!track?.effects || track.effects.length === 0) throw new Error("No effects found on track after add");

        const addedEffectInstance = track.effects[track.effects.length - 1];
        const order = track.effects.length - 1;

        if (!addedEffectInstance.id) throw new Error("Added effect has no ID");

        const effectData = serializeEffect(addedEffectInstance, trackId, order);
        if (!effectData) throw new Error("Failed to serialize added effect");

        await supabaseService.saveEffect({
            id: addedEffectInstance.id,
            trackId,
            type: effectData.type,
            settings: effectData.settings,
            order,
        });
    } catch (error) {
        logError('addEffectToTrack', error);
    }
};

export const persistRemoveEffectFromTrack = async (get: () => AppState, trackId: string, deletedEffectId: string) => {
    try {
        await supabaseService.deleteEffect(deletedEffectId);

        // Update order of remaining effects
        const finalTrackState = get().tracks.find(t => t.id === trackId);
        if (finalTrackState?.effects) {
            const updatePromises = finalTrackState.effects.map((effect, index) => {
                if (!effect.id) throw new Error("Effect in list has no ID during order update");

                const effectData = serializeEffect(effect, trackId, index);
                if (!effectData) throw new Error("Failed to serialize effect during order update");

                return supabaseService.saveEffect({
                    id: effect.id,
                    trackId,
                    type: effectData.type,
                    settings: effectData.settings,
                    order: index,
                });
            });
            await Promise.all(updatePromises);
        }
    } catch (error) {
        logError('removeEffectFromTrack', error);
    }
};

export const persistUpdateEffectPropertyOnTrack = async (get: () => AppState, trackId: string, effectIndex: number) => {
    try {
        const finalState = get();
        const track = finalState.tracks.find(t => t.id === trackId);
        if (!track?.effects || effectIndex < 0 || effectIndex >= track.effects.length) {
            throw new Error("Updated effect not found in state");
        }
        const updatedEffectInstance = track.effects[effectIndex];

        if (!updatedEffectInstance.id) throw new Error("Updated effect has no ID");

        const effectData = serializeEffect(updatedEffectInstance, trackId, effectIndex);
        if (!effectData) throw new Error("Failed to serialize updated effect");

        await supabaseService.saveEffect({
            id: updatedEffectInstance.id,
            trackId,
            type: effectData.type,
            settings: effectData.settings,
            order: effectIndex,
        });
    } catch (error) {
        logError('updateEffectPropertyOnTrack', error);
    }
};

export const persistReorderEffectsOnTrack = async (get: () => AppState, trackId: string) => {
    try {
        const finalState = get();
        const track = finalState.tracks.find(t => t.id === trackId);
        if (!track?.effects) {
            console.warn(`PersistReorderEffects: Track ${trackId} not found or has no effects.`);
            return;
        }

        const savePromises = track.effects.map((effect, index) => {
            if (!effect.id) throw new Error(`Effect at index ${index} missing ID during reorder persistence`);

            const effectData = serializeEffect(effect, trackId, index);
            if (!effectData) throw new Error(`Failed to serialize effect ${effect.id} during reorder persistence`);

            return supabaseService.saveEffect({
                id: effect.id,
                trackId,
                type: effectData.type,
                settings: effectData.settings,
                order: index,
            });
        });

        await Promise.all(savePromises);
    } catch (error) {
        logError('reorderEffectsOnTrack', error);
    }
};

export const persistSplitMidiBlock = async (get: () => AppState, trackId: string, block1: MIDIBlock, block2: MIDIBlock) => {
    try {
        const savePromises = [];

        // Save block 1
        savePromises.push(
            supabaseService.saveMidiBlock({
                id: block1.id,
                trackId,
                startBeat: block1.startBeat,
                endBeat: block1.endBeat,
            })
        );

        if (block1.notes?.length) {
            savePromises.push(
                supabaseService.saveMidiNotesBatch(
                    block1.notes.map(n => ({
                        id: String(n.id),
                        startBeat: n.startBeat,
                        duration: n.duration,
                        velocity: n.velocity,
                        pitch: n.pitch,
                    })),
                    block1.id
                )
            );
        }

        // Save block 2
        savePromises.push(
            supabaseService.saveMidiBlock({
                id: block2.id,
                trackId,
                startBeat: block2.startBeat,
                endBeat: block2.endBeat,
            })
        );

        if (block2.notes?.length) {
            savePromises.push(
                supabaseService.saveMidiNotesBatch(
                    block2.notes.map(n => ({
                        id: String(n.id),
                        startBeat: n.startBeat,
                        duration: n.duration,
                        velocity: n.velocity,
                        pitch: n.pitch,
                    })),
                    block2.id
                )
            );
        }

        await Promise.all(savePromises);
    } catch (error) {
        logError('splitMidiBlock', error);
    }
};

