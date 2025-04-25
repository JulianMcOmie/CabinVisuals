import Synthesizer, { ProcessedTrackVisuals } from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote, ColorRange } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, InstanceData, NoteContext, ADSRConfig } from '../VisualObjectEngine';
import { VisualObject3D } from '../VisualizerManager'; // Needed for potential override type safety, though not strictly used here

// Basic Vector Math Helpers
type Vec3Tuple = [number, number, number];

class RadialDuplicateGlowSynth extends Synthesizer {
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    clone(): this {
        const cloned = new RadialDuplicateGlowSynth() as this;
        this.properties.forEach((prop, key) => {
            const originalProp = this.properties.get(key);
            if (originalProp) {
                cloned.setPropertyValue(key, originalProp.value);
            }
        });
        return cloned;
    }

    private initializeProperties(): void {
        // Glow & Base Visual
        this.properties.set('glowIntensity', new Property<number>(
            'glowIntensity', 1.2, { label: 'Glow Intensity', uiType: 'slider', min: 0, max: 5, step: 0.1 }
        ));
        this.properties.set('baseSize', new Property<number>(
            'baseSize', 0.8, { label: 'Base Size', uiType: 'slider', min: 0.1, max: 5, step: 0.05 }
        ));
        this.properties.set('hueRange', new Property<ColorRange>(
            'hueRange', { startHue: 0, endHue: 360 }, { label: 'Hue Range (Note % 12)', uiType: 'colorRange' }
        ));

        // Add Gravity Property
        this.properties.set('gravity', new Property<number>(
            'gravity', 9.8, { label: 'Gravity Strength', uiType: 'slider', min: 0, max: 50, step: 0.1 }
        ));

        // --- ADD HEIGHT MAPPING PROPERTY ---
        this.properties.set('maxYHeight', new Property<number>(
            'maxYHeight', 15.0, { label: 'Max Y Height (High Pitch)', uiType: 'slider', min: 1, max: 50, step: 0.5 }
        ));

        // ADSR (Increased Release default)
        this.properties.set('attackTime', new Property<number>(
            'attackTime', 0.01, { label: 'Fade Attack (s)', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('decayTime', new Property<number>(
            'decayTime', 0.2, { label: 'Fade Decay (s)', uiType: 'slider', min: 0.0, max: 2.0, step: 0.01 }
        ));
        this.properties.set('sustainLevel', new Property<number>(
            'sustainLevel', 0.8, { label: 'Fade Sustain Level', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('releaseTime', new Property<number>(
            'releaseTime', 2.0, { label: 'Fade Release (s)', uiType: 'slider', min: 0.0, max: 5.0, step: 0.01 }
        ));
    }

    private initializeEngine(): void {
        const adsrConfigFn = (noteCtx: NoteContext): ADSRConfig => ({
            attack: this.getPropertyValue<number>('attackTime') ?? 0.01,
            decay: this.getPropertyValue<number>('decayTime') ?? 0.2,
            sustain: this.getPropertyValue<number>('sustainLevel') ?? 0.8,
            release: this.getPropertyValue<number>('releaseTime') ?? 2.0,
        });

        this.engine.defineObject('sphere')
            // --- Apply ADSR to the single falling sphere --- 
            .applyADSR(adsrConfigFn) // ADSR for opacity fade
            
            // --- Final Mappers (Apply to the single falling sphere) ---
            .withPosition((ctx: MappingContext): Vec3Tuple => {
                // No instanceData from radial duplication anymore
                
                // Map pitch to Y height
                const maxY = this.getPropertyValue<number>('maxYHeight') ?? 15.0;
                const yPos = MappingUtils.mapPitchToRange(ctx.note.pitch, 0, maxY);

                // Gravity calculation for Z
                const gravity = this.getPropertyValue<number>('gravity') ?? 9.8;
                const timeSinceStart = ctx.timeSinceNoteStart ?? 0;
                const zPos = -0.5 * gravity * Math.pow(timeSinceStart, 2);

                // Position: X=0, Y=pitch-mapped, Z=gravity-calculated
                const x = 0;
                const y = yPos; 
                const z = zPos;

                return [x, y, z];
            })
            .withScale((ctx: MappingContext): Vec3Tuple => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 0.8;
                return [baseSize, baseSize, baseSize];
            })
            .withOpacity((ctx: MappingContext): number => {
                // Use the ADSR amplitude calculated by the engine
                return ctx.adsrAmplitude ?? 0;
            });
    }

    // Override for Glow Effect (Still applies if base color isn't white)
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        const baseObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);
        const glowIntensity = this.getPropertyValue<number>('glowIntensity') ?? 1.2;

        const processedObjects = baseObjects.map(obj => {
            if (!obj.properties || obj.properties.opacity === undefined) { // Removed color check as user removed color mapping
                return obj; 
            }
            const effectiveOpacity = Math.max(0, obj.properties.opacity);
            // Use white as base emissive color since mapping was removed
            const emissiveColor = obj.properties.color ?? '#ffffff'; // Default to white if no color mapper
            const intensity = glowIntensity * effectiveOpacity;

            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    emissive: emissiveColor, 
                    emissiveIntensity: intensity 
                }
            };
        });
        return processedObjects;
    }
}

export default RadialDuplicateGlowSynth; 