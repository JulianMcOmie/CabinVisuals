import Synthesizer from '../lib/Synthesizer';
import Effect from '../lib/Effect';
import { synthesizerConstructors, effectConstructors } from '../store/store';
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
    // TODO: Add other setting application methods if needed
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