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

        // Radial Duplicates (Pitch Controlled)
        this.properties.set('minRadialDuplicates', new Property<number>(
            'minRadialDuplicates', 1, { label: 'Min Radial Dups (Low Pitch)', uiType: 'slider', min: 1, max: 10, step: 1 }
        ));
        this.properties.set('maxRadialDuplicates', new Property<number>(
            'maxRadialDuplicates', 8, { label: 'Max Radial Dups (High Pitch)', uiType: 'slider', min: 1, max: 24, step: 1 }
        ));
        this.properties.set('minRadius', new Property<number>(
            'minRadius', 1.0, { label: 'Min Radius (Low Pitch)', uiType: 'slider', min: 0.1, max: 10, step: 0.1 }
        ));
        this.properties.set('maxRadius', new Property<number>(
            'maxRadius', 10.0, { label: 'Max Radius (High Pitch)', uiType: 'slider', min: 1, max: 30, step: 0.1 }
        ));

        // ADSR (Instant Attack/Release defaults)
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
            // --- LEVEL 1: Radial Duplication --- 
            .forEachInstance((noteLevelCtx: MappingContext): InstanceData[] => {
                const minDups = this.getPropertyValue<number>('minRadialDuplicates') ?? 1;
                const maxDups = this.getPropertyValue<number>('maxRadialDuplicates') ?? 8;
                const minRad = this.getPropertyValue<number>('minRadius') ?? 1.0;
                const maxRad = this.getPropertyValue<number>('maxRadius') ?? 10.0;

                // Map pitch within a 2-octave (24 semitone) range to number of duplicates and radius
                const pitchMod24 = noteLevelCtx.note.pitch % 24;
                const normalizedPitch = pitchMod24 / 23.0; // Normalize 0-23 to 0-1
                const numRadialDuplicates = Math.round(MappingUtils.mapValue(normalizedPitch, 0, 1, minDups, maxDups));
                const radius = MappingUtils.mapValue(normalizedPitch, 0, 1, minRad, maxRad);
                
                const radialInstances: InstanceData[] = [];
                for (let i = 0; i < numRadialDuplicates; i++) {
                    radialInstances.push({
                        angle: (i / numRadialDuplicates) * Math.PI * 2,
                        radius: radius
                    });
                }
                return radialInstances;
            })
            // // --- Apply Color and ADSR to each falling radial instance --- 
            // .withColor((ctx: MappingContext) => { // Color based on original note pitch
            //     const range = this.getPropertyValue<ColorRange>('hueRange') ?? { startHue: 0, endHue: 360 };
            //     const pitchClass = ctx.note.pitch % 12;
            //     const normalizedPitchClass = pitchClass / 11.0; // 0 to 1
            //     let hue: number;
            //     const rangeSize = range.endHue - range.startHue;
            //     hue = range.startHue + normalizedPitchClass * rangeSize;
            //     hue = ((hue % 360) + 360) % 360; // Wrap hue
            //     return `hsl(${hue.toFixed(0)}, 100%, 50%)`;
            // })
            .applyADSR(adsrConfigFn) // ADSR for opacity fade
            // --- Final Mappers (Apply to each falling sphere) ---
            .withPosition((ctx: MappingContext): Vec3Tuple => {
                // Context from Level 1 (Radial Duplication) is in instanceData now (since no level 2)
                const radialAngle = ctx.instanceData?.angle as number ?? 0;
                const radialRadius = ctx.instanceData?.radius as number ?? 0;
                
                // Gravity calculation
                const gravity = this.getPropertyValue<number>('gravity') ?? 9.8;
                const timeSinceStart = ctx.timeSinceNoteStart ?? 0;
                const zPos = -0.5 * gravity * Math.pow(timeSinceStart, 2);

                // Position on XY plane based on angle/radius, use gravity calc for Z
                const x = Math.cos(radialAngle) * radialRadius;
                const y = Math.sin(radialAngle) * radialRadius; 
                const z = zPos;

                return [x, y, z];
            })
            .withScale((ctx: MappingContext): Vec3Tuple => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 0.8;
                // No Z scale multiplier anymore
                return [baseSize, baseSize, baseSize];
            })
            .withOpacity((ctx: MappingContext): number => {
                // Use the ADSR amplitude calculated by the engine
                return ctx.adsrAmplitude ?? 0;
            });
    }

    // Override for Glow Effect
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        const baseObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);
        const glowIntensity = this.getPropertyValue<number>('glowIntensity') ?? 1.2;

        const processedObjects = baseObjects.map(obj => {
            if (!obj.properties || obj.properties.opacity === undefined || !obj.properties.color) {
                return obj; 
            }
            const effectiveOpacity = Math.max(0, obj.properties.opacity);
            const intensity = glowIntensity * effectiveOpacity;

            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    emissive: obj.properties.color, 
                    emissiveIntensity: intensity 
                }
            };
        });
        return processedObjects;
    }
}

export default RadialDuplicateGlowSynth; 