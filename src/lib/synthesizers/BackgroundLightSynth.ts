import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { 
    MappingContext, 
    NoteContext, 
    MappingUtils, 
    ADSRConfig 
} from '../VisualObjectEngine';

// Optional: Define simple vector helpers if needed
type Vec3Tuple = [number, number, number];

class BackgroundLightSynth extends Synthesizer {
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    clone(): this {
         const cloned = new BackgroundLightSynth() as this;
         this.properties.forEach((prop, key) => {
             const originalProp = this.properties.get(key);
             if (originalProp) {
                 cloned.setPropertyValue(key, originalProp.value);
             }
         });
         return cloned;
    }

    private initializeProperties(): void {
        this.properties.set('lightColor', new Property<string>(
            'lightColor', '#ffffff', { label: 'Light Color', uiType: 'color' }
        ));
        this.properties.set('intensity', new Property<number>(
            'intensity', 5.0, { label: 'Intensity Multiplier', uiType: 'slider', min: 0.1, max: 20, step: 0.1 }
        ));
        this.properties.set('distance', new Property<number>(
            'distance', 50, { label: 'Distance', uiType: 'slider', min: 10, max: 200, step: 1 }
        ));
        this.properties.set('spread', new Property<number>(
            'spread', 20, { label: 'Spread', uiType: 'slider', min: 0, max: 100, step: 1 }
        ));
         this.properties.set('baseSize', new Property<number>(
            'baseSize', 1.0, { label: 'Base Size', uiType: 'slider', min: 0.1, max: 10, step: 0.1 }
        ));
        // ADSR properties with long decay/release defaults
        this.properties.set('attackTime', new Property<number>(
            'attackTime', 0.1, { label: 'Attack (s)', uiType: 'slider', min: 0.0, max: 2.0, step: 0.01 }
        ));
        this.properties.set('decayTime', new Property<number>(
            'decayTime', 2.0, { label: 'Decay (s)', uiType: 'slider', min: 0.0, max: 10.0, step: 0.1 }
        ));
        this.properties.set('sustainLevel', new Property<number>(
            'sustainLevel', 0.3, { label: 'Sustain Level', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('releaseTime', new Property<number>(
            'releaseTime', 5.0, { label: 'Release (s)', uiType: 'slider', min: 0.0, max: 20.0, step: 0.1 }
        ));
    }

    private initializeEngine(): void {
        const adsrConfigFn = (noteCtx: NoteContext): ADSRConfig => ({
            attack: this.getPropertyValue<number>('attackTime') ?? 0.1,
            decay: this.getPropertyValue<number>('decayTime') ?? 2.0,
            sustain: this.getPropertyValue<number>('sustainLevel') ?? 0.3,
            release: this.getPropertyValue<number>('releaseTime') ?? 5.0,
        });

        this.engine.defineObject('sphere') // Start with a sphere
            .applyADSR(adsrConfigFn)
            .withPosition((ctx: MappingContext): Vec3Tuple => {
                const distance = this.getPropertyValue<number>('distance') ?? 50;
                const spread = this.getPropertyValue<number>('spread') ?? 20;
                // Use pitch to influence X/Y position within the spread
                const xPos = MappingUtils.mapValue(ctx.note.pitch, 0, 127, -spread / 2, spread / 2);
                // Use velocity for slight Y variation maybe?
                const yPos = MappingUtils.mapValue(ctx.note.velocity, 0, 127, -spread / 4, spread / 4);
                // Place it far away on the Z axis
                return [xPos, yPos, distance]; 
            })
            .withColor((ctx: MappingContext): string => {
                return this.getPropertyValue<string>('lightColor') ?? '#ffffff';
            }) 
            .withScale((ctx: MappingContext): Vec3Tuple => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 1.0;
                 // Maybe scale slightly with velocity? Or keep constant?
                const velScale = MappingUtils.mapValue(ctx.note.velocity, 0, 127, 0.8, 1.2);
                const finalSize = baseSize * velScale;
                return [finalSize, finalSize, finalSize];
            })
            .withOpacity((ctx: MappingContext): number => {
                // Opacity driven directly by ADSR
                return ctx.adsrAmplitude ?? 0.0; 
            });
    }

    // Override to add emissive properties based on ADSR
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        const baseObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);
        const baseIntensity = this.getPropertyValue<number>('intensity') ?? 5.0;

        const processedObjects = baseObjects.map(obj => {
            if (!obj.properties || obj.properties.opacity === undefined || !obj.properties.color) {
                return obj; 
            }
            // Use opacity (driven by ADSR) to scale emissive intensity
            const effectiveOpacity = Math.max(0, obj.properties.opacity);
            const intensity = baseIntensity * effectiveOpacity;

            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    emissive: obj.properties.color, // Glow with the object's color
                    emissiveIntensity: intensity    // Intensity controlled by ADSR via opacity
                }
            };
        });
        return processedObjects;
    }
}

export default BackgroundLightSynth; 