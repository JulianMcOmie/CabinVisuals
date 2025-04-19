import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote, ColorRange } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, InstanceData, ADSRConfigFn } from '../VisualObjectEngine';

class OscillatingGlowRowSynth extends Synthesizer {
    private _minPitch: number | null = null;
    private _maxPitch: number | null = null;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        // Row Properties
        this.properties.set('numSpheres', new Property<number>(
            'numSpheres', 5, { label: 'Number of Spheres', uiType: 'slider', min: 1, max: 20, step: 1 }
        ));
        this.properties.set('zSpacing', new Property<number>(
            'zSpacing', 3.0, { label: 'Z Spacing', uiType: 'slider', min: 0.1, max: 10.0, step: 0.1 }
        ));
        this.properties.set('startZ', new Property<number>(
            'startZ', -5.0, { label: 'Start Z', uiType: 'slider', min: -30.0, max: 10.0, step: 0.5 }
        ));
        this.properties.set('ySpread', new Property<number>(
            'ySpread', 4.0, { label: 'Y Spread (Pitch)', uiType: 'slider', min: 0, max: 15, step: 0.1 }
        ));

        // Appearance Properties
        this.properties.set('baseSize', new Property<number>(
            'baseSize', 1.0, { label: 'Sphere Size', uiType: 'slider', min: 0.1, max: 5.0, step: 0.05 }
        ));
        this.properties.set('hueRange', new Property<ColorRange>(
            'hueRange',
            { startHue: 0, endHue: 240 }, // Default: Red to Blue
            { label: 'Hue Range (Pitch)', uiType: 'colorRange' }
        ));
        this.properties.set('hueShiftRate', new Property<number>(
            'hueShiftRate', 15, { label: 'Hue Shift Rate (°/sec)', uiType: 'slider', min: -90, max: 90, step: 1 }
        ));
         this.properties.set('saturation', new Property<number>(
            'saturation', 100, { label: 'Saturation %', uiType: 'slider', min: 0, max: 100, step: 1 }
        ));
        this.properties.set('lightness', new Property<number>(
            'lightness', 55, { label: 'Lightness %', uiType: 'slider', min: 0, max: 100, step: 1 }
        ));

        // Glow & Oscillation Properties
        this.properties.set('baseGlow', new Property<number>(
            'baseGlow', 1.0, { label: 'Base Glow Intensity', uiType: 'slider', min: 0.0, max: 5.0, step: 0.1 }
        ));
        this.properties.set('oscillationFreq', new Property<number>(
            'oscillationFreq', 1.5, { label: 'Glow Osc Freq (Hz)', uiType: 'slider', min: 0.1, max: 10.0, step: 0.1 }
        ));
        this.properties.set('oscillationAmount', new Property<number>(
            'oscillationAmount', 0.8, { label: 'Glow Osc Amount', uiType: 'slider', min: 0.0, max: 5.0, step: 0.1 }
        ));

        // ADSR Properties (Slow Fade Out)
        this.properties.set('attack', new Property<number>(
            'attack', 0.1, { label: 'Attack (s)', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('decay', new Property<number>(
            'decay', 0.1, { label: 'Decay (s)', uiType: 'slider', min: 0.0, max: 2.0, step: 0.01 }
        ));
        this.properties.set('sustain', new Property<number>( // High sustain to keep effect going
            'sustain', 1.0, { label: 'Sustain Level', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('release', new Property<number>( // Slow release
            'release', 2.5, { label: 'Release (s)', uiType: 'slider', min: 0.1, max: 10.0, step: 0.1 }
        ));
    }

    private initializeEngine(): void {
        const adsrConfigFn: ADSRConfigFn = (noteCtx: NoteContext) => ({
            attack: this.getPropertyValue<number>('attack') ?? 0.1,
            decay: this.getPropertyValue<number>('decay') ?? 0.1,
            sustain: this.getPropertyValue<number>('sustain') ?? 1.0,
            release: this.getPropertyValue<number>('release') ?? 2.5,
        });

        this.engine.defineObject('sphere') // Base definition (properties applied per instance)
            .forEachInstance((parentCtx: MappingContext): InstanceData[] => {
                const numSpheres = Math.floor(this.getPropertyValue<number>('numSpheres') ?? 1);
                const instances: InstanceData[] = [];
                for (let i = 0; i < numSpheres; i++) {
                    // Store index and also the parent note's pitch for later mapping
                    instances.push({ 
                        zIndex: i, 
                        notePitch: parentCtx.note.pitch, // Pass pitch down
                    });
                }
                return instances;
            })
            .applyADSR(adsrConfigFn) // Apply ADSR to each sphere instance
            .withPosition((ctx: MappingContext): [number, number, number] => {
                const startZ = this.getPropertyValue<number>('startZ') ?? -5.0;
                const zSpacing = this.getPropertyValue<number>('zSpacing') ?? 3.0;
                const ySpread = this.getPropertyValue<number>('ySpread') ?? 4.0;
                const zIndex = ctx.instanceData.zIndex as number;
                const pitch = ctx.instanceData.notePitch as number; // Use pitch from instance data
                let yPos = 0;
                
                // Manual Y position mapping based on pitch
                if (this._minPitch !== null && this._maxPitch !== null && this._minPitch !== this._maxPitch) {
                    const normalizedPitch = (pitch - this._minPitch) / (this._maxPitch - this._minPitch);
                    yPos = -ySpread + normalizedPitch * (ySpread - (-ySpread)); // Map to [-ySpread, ySpread]
                } else if (this._minPitch !== null) {
                    yPos = 0; // Center if only one pitch
                }
                yPos = Math.max(-ySpread, Math.min(ySpread, yPos)); // Clamp
                
                const zPos = startZ + zIndex * zSpacing;
                return [0, yPos, zPos]; // X=0, Y mapped, Z based on index
            })
            .withScale((ctx: MappingContext): [number, number, number] => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 1.0;
                return [baseSize, baseSize, baseSize]; // Constant size
            })
            .withColor((ctx: MappingContext): string => {
                const range = this.getPropertyValue<ColorRange>('hueRange') ?? { startHue: 0, endHue: 240 };
                const hueShiftRate = this.getPropertyValue<number>('hueShiftRate') ?? 15;
                const saturation = this.getPropertyValue<number>('saturation') ?? 100;
                const lightness = this.getPropertyValue<number>('lightness') ?? 55;
                const pitch = ctx.instanceData.notePitch as number; // Use pitch from instance data
                
                let basePitchHue: number;
                // Map pitch to the hue range
                if (this._minPitch !== null && this._maxPitch !== null && this._minPitch !== this._maxPitch) {
                    const normalizedPitch = (pitch - this._minPitch) / (this._maxPitch - this._minPitch);
                    const rangeSize = range.endHue - range.startHue;
                    if (rangeSize >= 0) {
                        basePitchHue = range.startHue + normalizedPitch * rangeSize;
                    } else {
                        const wrappedRangeSize = 360 + rangeSize;
                        basePitchHue = range.startHue + normalizedPitch * wrappedRangeSize;
                    }
                } else {
                    // Default to start hue if pitch range is invalid
                    basePitchHue = range.startHue;
                }
                
                // Apply time-based hue shift
                const currentHue = basePitchHue + hueShiftRate * ctx.timeSinceNoteStart;
                const wrappedHue = ((currentHue % 360) + 360) % 360; // Ensure 0-359

                return `hsl(${wrappedHue.toFixed(0)}, ${saturation}%, ${lightness}%)`;
            })
            .withOpacity((ctx: MappingContext): number => {
                // Opacity controlled by ADSR
                return ctx.adsrAmplitude ?? 0;
            });
            // Note: Emissive properties are handled in getObjectsAtTime override
    }

    // Override to add oscillating glow
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        // Calculate min/max pitch from current blocks (moved here)
        if (midiBlocks.length === 0) {
            this._minPitch = null;
            this._maxPitch = null;
            return [];
        } else {
             let minP: number | null = null;
             let maxP: number | null = null;
             midiBlocks.forEach(block => {
                 block.notes.forEach(note => {
                     if (minP === null || note.pitch < minP) minP = note.pitch;
                     if (maxP === null || note.pitch > maxP) maxP = note.pitch;
                 });
             });
             // Handle case where blocks might exist but contain no notes
             this._minPitch = minP;
             this._maxPitch = maxP;
             if (minP === null) { // No notes found
                return [];
             }
        }

        // Get base objects from the engine (now uses calculated min/max pitch implicitly via mappers)
        const baseObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);

        const processedObjects = baseObjects.map(obj => {
            if (!obj.properties || obj.properties.opacity === undefined || !obj.properties.color) {
                return obj;
            }

            const baseGlow = this.getPropertyValue<number>('baseGlow') ?? 1.0;
            const oscillationFreq = this.getPropertyValue<number>('oscillationFreq') ?? 1.5;
            const oscillationAmount = this.getPropertyValue<number>('oscillationAmount') ?? 0.8;

            let timeSinceNoteStart = 0; // Fallback
            const sourceNote = midiBlocks.flatMap(b => b.notes).find(n => n.id === obj.sourceNoteId);
            if (sourceNote && bpm > 0) {
                 const beatDuration = 60.0 / bpm;
                 // Calculate time in seconds, assuming 'time' is also in seconds.
                 // Need to be careful about time units consistency.
                 timeSinceNoteStart = Math.max(0, time - (sourceNote.startBeat * beatDuration)); 
            }
            
            const oscValue = Math.sin(2 * Math.PI * oscillationFreq * timeSinceNoteStart);
            const modulatedGlow = baseGlow + oscillationAmount * oscValue;
            const clampedGlow = Math.max(0, modulatedGlow);

            const intensity = clampedGlow * obj.properties.opacity;

            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    emissive: obj.properties.color,
                    emissiveIntensity: intensity > 0.01 ? intensity : 0
                }
            };
        });

        return processedObjects;
    }


    clone(): this {
        const cloned = new OscillatingGlowRowSynth() as this;
        this.properties.forEach((prop, key) => {
            const clonedProp = cloned.properties.get(key);
            if (clonedProp) {
                clonedProp.value = prop.value;
            }
        });
        return cloned;
    }
}

export default OscillatingGlowRowSynth; 