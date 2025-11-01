import { Track, MIDIBlock, MIDINote } from '@/lib/types';
import { TrackData, MidiBlockData, MidiNoteData, SynthData, EffectData } from '@/Persistence/supabase-service';
import Synthesizer from '@/lib/Synthesizer';
import Effect from '@/lib/Effect';

import { synthesizerConstructors, effectConstructors } from '../store/store';
import BasicSynthesizer from '@/lib/synthesizers/BasicSynthesizer';
import ScaleEffect from '@/lib/effects/ScaleEffect';

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
 * @param block The live MIDIBlock object (must contain its notes array).
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
    // Ensure notes array exists, even if empty
    const notesArray = Array.isArray(block.notes) ? block.notes : [];
    
    return {
        id: block.id,
        trackId: trackId,
        startBeat: block.startBeat,
        endBeat: block.endBeat,
        notes: notesArray.map(note => note as MidiNoteData),
    };
};

// --- Serialization Helpers ---

/**
 * Serializes a live Synthesizer instance into SynthData format.
 * @param instance The Synthesizer instance.
 * @param trackId The ID of the track this synth belongs to.
 * @returns A SynthData object or null if serialization fails.
 */
export function serializeSynth(instance: Synthesizer, trackId: string): SynthData | null {
    if (!instance) {
        console.error("Invalid synth instance provided for serialization", instance);
        return null;
    }
     const constructorName = instance.constructor.name;
    if (!constructorName) {
        console.error("Could not find constructor name for synth instance", instance);
        return null;
    }
     if (typeof trackId !== 'string' || trackId === '') {
          console.error("Invalid trackId provided for synth serialization");
          return null;
     }

    // Serialize properties
    const settings: Record<string, any> = {};
    instance.properties.forEach((property, key) => {
        settings[key] = property.value;
    });

    // Debug logging for synth serialization
    try {
        console.log('[DEBUG] serializeSynth ->', {
            trackId,
            type: constructorName,
            settingsKeys: Object.keys(settings),
            settings,
        });
    } catch {}

    return {
        trackId: trackId,
        type: constructorName,
        settings: settings,
    };
}

export function deserializeSynth(data: { type: string; settings: any }): Synthesizer | null {
    // Debug logging for synth deserialization input
    try { console.log('[DEBUG] deserializeSynth input:', data); } catch {}
    let Constructor = synthesizerConstructors.get(data.type);
    
    if (!Constructor) {
        console.warn(`No synthesizer constructor found for type: "${data.type}". Falling back to BasicSynthesizer.`);
        console.warn(`This likely means you have old project data. The synthesizer will be replaced with a default one.`);
        Constructor = BasicSynthesizer;
    }
    
    try {
        const instance = new Constructor(); // Pass settings to constructor if needed/supported
        applySettings(instance, data.settings);
        try { console.log('[DEBUG] deserializeSynth resolved constructor:', instance.constructor.name); } catch {}
        return instance;
    } catch (error) {
        console.error(`Error deserializing synthesizer type ${data.type}:`, error);
        // Even on error, try to return a basic synthesizer as last resort
        try {
            return new BasicSynthesizer();
        } catch (fallbackError) {
            console.error('Failed to create fallback BasicSynthesizer:', fallbackError);
            return null;
        }
    }
}

/**
 * Serializes a live Effect instance into EffectData format.
 * @param instance The Effect instance (must have an 'id' property).
 * @param trackId The ID of the track this effect belongs to.
 * @param order The order of this effect in the track's chain.
 * @returns An EffectData object or null if serialization fails.
 */
export function serializeEffect(instance: Effect, trackId: string, order: number): EffectData | null {
     if (!instance) {
         console.error("Invalid effect instance provided for serialization", instance);
         return null;
     }
    const constructorName = instance.constructor.name;
    if (!constructorName) {
        console.error("Could not find constructor name for effect instance", instance);
        return null;
    }
     if (typeof trackId !== 'string' || trackId === '') {
          console.error("Invalid trackId provided for effect serialization");
          return null;
     }
      if (typeof order !== 'number' || !Number.isInteger(order) || order < 0) {
           console.error("Invalid order provided for effect serialization");
           return null;
      }

    const settings: Record<string, any> = {};
     instance.properties.forEach((property, key) => {
        settings[key] = property.value;
     });

    const result = {
         id: instance.id,
         trackId: trackId,
         order: order,
         type: constructorName,
         settings: settings,
     };

    // Debug logging for effect serialization
    try {
        console.log('[DEBUG] serializeEffect ->', {
            id: instance.id,
            trackId,
            order,
            type: constructorName,
            settingsKeys: Object.keys(settings),
        });
    } catch {}

    return result;
}

export function deserializeEffect(data: EffectData): Effect | null {
    // Debug logging for effect deserialization input
    try { console.log('[DEBUG] deserializeEffect input:', data); } catch {}
     let Constructor = effectConstructors.get(data.type);
     
     if (!Constructor) {
         console.warn(`No effect constructor found for type: "${data.type}". Falling back to ScaleEffect.`);
         console.warn(`This likely means you have old project data. The effect will be replaced with a default one.`);
         Constructor = ScaleEffect;
     }
     
     try {
         const instance = new Constructor(data.id); 
         applySettings(instance, data.settings);
        try { console.log('[DEBUG] deserializeEffect resolved constructor:', instance.constructor.name); } catch {}
         return instance;
     } catch (error) {
         console.error(`Error deserializing effect type ${data.type}:`, error);
         // Even on error, try to return a basic effect as last resort
         try {
             return new ScaleEffect(data.id);
         } catch (fallbackError) {
             console.error('Failed to create fallback ScaleEffect:', fallbackError);
             return null;
         }
     }
} 

// --- Helper to apply settings --- 
export const applySettings = (instance: any, settings: Record<string, any>) => {
    if (!instance || !settings) return;

    // Debug log properties being applied
    try {
        console.log('[DEBUG] applySettings ->', instance?.constructor?.name, {
            keys: Object.keys(settings || {}),
            settings,
        });
    } catch {}

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