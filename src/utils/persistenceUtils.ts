import { Track, MIDIBlock, MIDINote } from '../lib/types';
import { TrackData, MidiBlockData, MidiNoteData } from '../Persistence/persistence-service';
import Synthesizer from '../lib/Synthesizer';
import Effect from '../lib/Effect';

import { synthesizerConstructors, effectConstructors } from '../store/store';


/**
 * Converts a live Track object from the Zustand state into the
 * plain TrackData format needed for persistence.
 * 
 * @param track The live Track object.
 * @param projectId The ID of the project the track belongs to.
 * @param order The positional order (index) of the track within the project.
 * @returns A TrackData object suitable for saving to IndexedDB.
 */
export const trackToTrackData = (track: Track, projectId: string, order: number): TrackData => {
    // Ensure all required fields for TrackData are present
    if (!track.id || typeof track.name !== 'string' || typeof track.isMuted !== 'boolean' || typeof track.isSoloed !== 'boolean') {
        console.error("Invalid Track object passed to trackToTrackData:", track);
        // Returning a default/empty object might be problematic, throwing an error might be better
        // depending on how the calling code handles it.
        throw new Error("Invalid Track object provided for persistence conversion.");
    }
     if (typeof projectId !== 'string' || projectId === '') {
          throw new Error("Invalid projectId provided for persistence conversion.");
     }
      if (typeof order !== 'number' || !Number.isInteger(order) || order < 0) {
           throw new Error("Invalid order provided for persistence conversion.");
      }

    return {
        id: track.id,
        projectId: projectId, 
        name: track.name,
        isMuted: track.isMuted,
        isSoloed: track.isSoloed,
        order: order, 
    };
};

/**
 * Converts a live MIDIBlock object from the Zustand state into the
 * plain MidiBlockData format needed for persistence.
 * 
 * @param block The live MIDIBlock object.
 * @param trackId The ID of the track the block belongs to.
 * @returns A MidiBlockData object suitable for saving to IndexedDB.
 */
export const midiBlockToData = (block: MIDIBlock, trackId: string): MidiBlockData => {
    if (!block.id || typeof block.startBeat !== 'number' || typeof block.endBeat !== 'number') {
         throw new Error("Invalid MIDIBlock object provided for persistence conversion.");
    }
    if (typeof trackId !== 'string' || trackId === '') {
         throw new Error("Invalid trackId provided for MIDIBlock persistence conversion.");
    }
    return {
        id: block.id,
        trackId: trackId,
        startBeat: block.startBeat,
        endBeat: block.endBeat,
    };
};

/**
 * Converts a live MIDINote object from the Zustand state into the
 * plain MidiNoteData format needed for persistence.
 * 
 * @param note The live MIDINote object.
 * @param blockId The ID of the block the note belongs to.
 * @returns A MidiNoteData object suitable for saving to IndexedDB.
 */
export const midiNoteToData = (note: MIDINote, blockId: string): MidiNoteData => {
     if (!note.id || typeof note.pitch !== 'number' || typeof note.velocity !== 'number' || typeof note.startBeat !== 'number' || typeof note.duration !== 'number') {
          throw new Error("Invalid MIDINote object provided for persistence conversion.");
     }
      if (typeof blockId !== 'string' || blockId === '') {
           throw new Error("Invalid blockId provided for MIDINote persistence conversion.");
      }
    return {
        id: note.id,
        blockId: blockId,
        pitch: note.pitch,
        velocity: note.velocity,
        startBeat: note.startBeat,
        duration: note.duration,
    };
};

// --- Serialization Helpers ---

export function serializeSynth(instance: Synthesizer): { type: string; settings: any } | null {
    if (!instance) {
        console.error("Invalid synth instance provided for serialization", instance);
        return null;
    }
     const constructorName = instance.constructor.name;
    if (!constructorName) {
        console.error("Could not find constructor name for synth instance", instance);
        return null;
    }

    // Serialize properties
    const settings: Record<string, any> = {};
    instance.properties.forEach((property, key) => {
        settings[key] = property.value;
    });

    return {
        type: constructorName,
        settings: settings,
    };
}

export function deserializeSynth(data: { type: string; settings: any }): Synthesizer | null {
    const Constructor = synthesizerConstructors.get(data.type);
    if (!Constructor) {
        console.error(`No synthesizer constructor found for type: ${data.type}`);
        return null;
    }
    try {
        const instance = new Constructor(); // Pass settings to constructor if needed/supported
        applySettings(instance, data.settings);
        return instance;
    } catch (error) {
        console.error(`Error deserializing synthesizer type ${data.type}:`, error);
        return null;
    }
}

export function serializeEffect(instance: Effect): { type: string; settings: any } | null {
    const constructorName = instance.constructor.name;
    if (!constructorName) {
        console.error("Could not find constructor name for effect instance", instance);
        return null;
    }

     const settings: Record<string, any> = {};
     instance.properties.forEach((property, key) => {
        settings[key] = property.value;
     });

     return {
         type: constructorName,
         settings: settings,
     };
}

export function deserializeEffect(data: { type: string; settings: any }): Effect | null {
     const Constructor = effectConstructors.get(data.type);
     if (!Constructor) {
         console.error(`No effect constructor found for type: ${data.type}`);
         return null;
     }
     try {
         const instance = new Constructor(); // Pass settings to constructor if needed/supported
         applySettings(instance, data.settings);
         return instance;
     } catch (error) {
         console.error(`Error deserializing effect type ${data.type}:`, error);
         return null;
     }
} 

// --- Helper to apply settings --- 
export const applySettings = (instance: any, settings: Record<string, any>) => {
    if (!instance || !settings) return;

    // Prefer setPropertyValue if available (as defined in base classes)
    if (typeof instance.setPropertyValue === 'function') {
        for (const key in settings) {
            if (Object.prototype.hasOwnProperty.call(settings, key)) {
                try {
                    instance.setPropertyValue(key, settings[key]);
                } catch (e) {
                    console.warn(`Failed to set property "${key}" on`, instance, e);
                }
            }
        }
    } else if (instance.properties instanceof Map) {
         // Fallback: Directly manipulate properties Map if setPropertyValue doesn't exist
         console.warn('Attempting to set properties directly on Map for', instance.constructor.name, '. Consider implementing setPropertyValue.');
         for (const key in settings) {
            if (Object.prototype.hasOwnProperty.call(settings, key)) {
                if (instance.properties.has(key)) {
                    try {
                        instance.properties.get(key).value = settings[key];
                    } catch (e) {
                         console.warn(`Failed to set property map value "${key}" on`, instance, e);
                    }
                } else {
                    console.warn(`Property "${key}" not found in properties Map for`, instance.constructor.name);
                }
            }
         }
    }
};