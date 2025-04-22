import { AppState } from '../store'; 
import { Track, MIDIBlock, MIDINote } from '../../lib/types';
import * as P from '../../Persistence/persistence-service';
import {
    trackToTrackData,
    midiBlockToData,
    serializeSynth,
    serializeEffect
} from '../../utils/persistenceUtils';



const logError = (action: string, error: any) => {
    console.error(`Persistence Error [${action}]:`, error);
};

// --- Persistence Functions --- 

export const persistAddTrack = async (get: () => AppState, track: Track) => {
    try {
        const projectId = get().currentLoadedProjectId;
        if (!projectId) throw new Error("No project loaded");
        const order = get().tracks.length - 1; // Order based on final state (index)

        const trackData = trackToTrackData(track, projectId, order);
        await P.saveTrack(trackData);

        if (track.synthesizer) {
            const synthData = serializeSynth(track.synthesizer, track.id);
            if (synthData) {
                await P.saveSynth(synthData);
            }
        }
        // Effects and blocks are likely empty on initial add, handled separately
    } catch (error) {
        logError('addTrack', error);
    }
};

export const persistRemoveTrack = async (get: () => AppState, trackId: string) => {
    try {
        // 1. Delete the track and its descendants from DB
        await P.deleteTrack(trackId); // Cascade handled by service

        // 2. Update the order of remaining tracks in DB
        const finalTracks = get().tracks; 
        const projectId = get().currentLoadedProjectId;
        if (projectId) {
            const updatePromises = finalTracks.map((t, index) => 
                P.saveTrack(trackToTrackData(t, projectId, index))
            );
            await Promise.all(updatePromises);
        } else {
             throw new Error("No project loaded to update track order");
        }
    } catch (error) {
        logError('removeTrack', error);
    }
};

export const persistAddMidiBlock = async (get: () => AppState, trackId: string, block: MIDIBlock) => {
    try {
        const blockData = midiBlockToData(block, trackId);
        await P.saveMidiBlock(blockData);
    } catch (error) {
        logError('addMidiBlock', error);
    }
};

export const persistUpdateMidiBlock = async (get: () => AppState, trackId: string, updatedBlock: MIDIBlock) => {
    try {
        const blockData = midiBlockToData(updatedBlock, trackId);
        await P.saveMidiBlock(blockData);
    } catch (error) {
        logError('updateMidiBlock', error);
    }
};

export const persistRemoveMidiBlock = async (get: () => AppState, blockId: string) => {
     try {
         await P.deleteMidiBlock(blockId); // Cascade handled by service
     } catch (error) {
         logError('removeMidiBlock', error);
     }
};

export const persistMoveMidiBlock = async (get: () => AppState, blockId: string, oldTrackId: string, newTrackId: string) => {
    try {
        const finalState = get();
        const projectId = finalState.currentLoadedProjectId;
        if (!projectId) throw new Error("No project loaded");

        // 1. Find the moved block in its new track
        const newTrack = finalState.tracks.find(t => t.id === newTrackId);
        const movedBlock = newTrack?.midiBlocks.find(b => b.id === blockId);
        if (!movedBlock) throw new Error("Moved block not found in final state");

        // 2. Save the block with its new trackId
        const blockData = midiBlockToData(movedBlock, newTrackId);
        await P.saveMidiBlock(blockData);

        // 3. Save the state of the two affected tracks (their midiBlocks array changed)
        const oldTrack = finalState.tracks.find(t => t.id === oldTrackId);
        const oldTrackOrder = finalState.tracks.findIndex(t => t.id === oldTrackId);
        const newTrackOrder = finalState.tracks.findIndex(t => t.id === newTrackId);

        const trackSavePromises = [];
        if (oldTrack && oldTrackOrder !== -1) {
            trackSavePromises.push(P.saveTrack(trackToTrackData(oldTrack, projectId, oldTrackOrder)));
        }
        if (newTrack && newTrackOrder !== -1) {
             trackSavePromises.push(P.saveTrack(trackToTrackData(newTrack, projectId, newTrackOrder)));
        }
        await Promise.all(trackSavePromises);

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

        // 1. Save Track Metadata
        const trackData = trackToTrackData(updatedTrack, projectId, trackOrder);
        await P.saveTrack(trackData);

        // 2. Save Synth if it was part of the update
        if ('synthesizer' in updatedProperties && updatedTrack.synthesizer) {
            const synthData = serializeSynth(updatedTrack.synthesizer, trackId);
            if (synthData) {
                await P.saveSynth(synthData);
            }
        }
        // Note: Persisting changes to effects array here is complex, handled by specific effect actions

    } catch (error) {
        logError('updateTrack', error);
    }
};

export const persistReorderTracks = async (get: () => AppState) => {
    try {
        const finalTracks = get().tracks;
        const projectId = get().currentLoadedProjectId;
        if (!projectId) throw new Error("No project loaded");

        const savePromises = finalTracks.map((track, index) => {
            const trackData = trackToTrackData(track, projectId, index);
            return P.saveTrack(trackData);
        });
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
        const serialized = serializeEffect(addedEffectInstance, trackId, order);
        
        if (!serialized) throw new Error ("Failed to serialize added effect");
        if (!addedEffectInstance.id) throw new Error("Added effect has no ID");

        const effectData: P.EffectData = {
            ...serialized,
            id: addedEffectInstance.id,
            trackId: trackId,
            order: order
        };
        await P.saveEffect(effectData);
    } catch (error) {
        logError('addEffectToTrack', error);
    }
};

export const persistRemoveEffectFromTrack = async (get: () => AppState, trackId: string, deletedEffectId: string) => {
    try {
         // 1. Delete the effect from DB
        await P.deleteEffect(deletedEffectId);

        // 2. Update order of remaining effects in DB
        const finalTrackState = get().tracks.find(t => t.id === trackId);
        if (finalTrackState?.effects) {
            const updatePromises = finalTrackState.effects.map((effect, index) => {
                const serialized = serializeEffect(effect, trackId, index);
                 if (!serialized) throw new Error (`Failed to serialize effect during order update: ${(effect as EffectWithId).id}`);
                 if (!effect.id) throw new Error("Effect in list has no ID during order update");
                
                const effectData: P.EffectData = { 
                    ...serialized, 
                    id: effect.id, 
                    trackId: trackId, 
                    order: index 
                 };
                return P.saveEffect(effectData);
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
        const serialized = serializeEffect(updatedEffectInstance, trackId, effectIndex);

        if (!serialized) throw new Error ("Failed to serialize updated effect");
        if (!updatedEffectInstance.id) throw new Error("Updated effect has no ID");

        const effectData: P.EffectData = {
            ...serialized,
            id: updatedEffectInstance.id,
            trackId: trackId,
            order: effectIndex
        };
        await P.saveEffect(effectData);
     } catch (error) {
         logError('updateEffectPropertyOnTrack', error);
     }
};

export const persistSplitMidiBlock = async (get: () => AppState, trackId: string, block1Id: string, block2Id: string) => {
    try {
        const finalState = get();
        const track = finalState.tracks.find(t => t.id === trackId);
        if (!track) throw new Error("Track not found for split block persistence");

        const block1 = track.midiBlocks.find(b => b.id === block1Id);
        const block2 = track.midiBlocks.find(b => b.id === block2Id);

        if (!block1) throw new Error(`Block 1 (${block1Id}) not found after split`);
        if (!block2) throw new Error(`Block 2 (${block2Id}) not found after split`);

        const savePromises = [];

        // Save block 1 (includes its notes)
        savePromises.push(P.saveMidiBlock(midiBlockToData(block1, trackId)));

        // Save block 2 (includes its notes)
        savePromises.push(P.saveMidiBlock(midiBlockToData(block2, trackId)));

        await Promise.all(savePromises);

    } catch (error) {
        logError('splitMidiBlock', error);
    }
}; 