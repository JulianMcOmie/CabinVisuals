import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, ADSRConfig } from '../VisualObjectEngine';

class SineWaveSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            // Size & Octave Scaling
            ['baseSize', new Property<number>('baseSize', 0.6, { uiType: 'slider', label: 'Base Size (Oct 5)', min: 0.1, max: 3, step: 0.05 })],
            ['sizeIncreasePerOctaveDown', new Property<number>('sizeIncreasePerOctaveDown', 0.15, { uiType: 'slider', label: '+ Size / Oct < 5', min: 0, max: 1, step: 0.01 })],
            // Position & Octave Scaling
            ['baseXSeparation', new Property<number>('baseXSeparation', 1.0, { uiType: 'slider', label: 'X Sep (Oct 5)', min: 0, max: 10, step: 0.1 })],
            ['xSeparationPerOctave', new Property<number>('xSeparationPerOctave', 0.75, { uiType: 'slider', label: '+ X Sep / Oct < 5', min: 0, max: 5, step: 0.05 })],
            ['initialYMin', new Property<number>('initialYMin', -5, { uiType: 'slider', label: 'Initial Y Min', min: -10, max: 10, step: 0.1 })],
            ['initialYMax', new Property<number>('initialYMax', 5, { uiType: 'slider', label: 'Initial Y Max', min: -10, max: 10, step: 0.1 })],
            ['travelSpeed', new Property<number>('travelSpeed', 3, { uiType: 'slider', label: 'Travel Speed (Z)', min: 0.1, max: 10, step: 0.1 })],
            // Oscillation
            ['oscillationFreq', new Property<number>('oscillationFreq', 0.5, { uiType: 'slider', label: 'Oscillation Freq (Hz)', min: 0.1, max: 5, step: 0.05 })],
            ['oscillationRange', new Property<number>('oscillationRange', 2, { uiType: 'slider', label: 'Oscillation Y Range', min: 0, max: 10, step: 0.1 })],
            // Color
            ['colorStart', new Property<number>('colorStart', 0, { uiType: 'slider', label: 'Hue Start (Pitch 0)', min: 0, max: 360, step: 1 })],
            ['colorEnd', new Property<number>('colorEnd', 240, { uiType: 'slider', label: 'Hue End (Pitch 11)', min: 0, max: 360, step: 1 })],
            // Standard ADSR for fade
            ['attack', new Property<number>('attack', 0.1, { uiType: 'slider', label: 'Fade Attack (s)', min: 0.01, max: 2, step: 0.01 })],
            ['decay', new Property<number>('decay', 0.2, { uiType: 'slider', label: 'Fade Decay (s)', min: 0.01, max: 2, step: 0.01 })],
            ['sustain', new Property<number>('sustain', 0.7, { uiType: 'slider', label: 'Fade Sustain Level', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 1.0, { uiType: 'slider', label: 'Fade Release (s)', min: 0.1, max: 4, step: 0.05 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;
        const REFERENCE_OCTAVE_INDEX = 5; // C4 = MIDI 60 corresponds to octave index 5

        this.engine.defineObject('cube')
            // Generate two instances per note, one for each side
            .forEachInstance((ctx: MappingContext) => [
                { side: 'left' },
                { side: 'right' }
            ]) 
            .applyADSR((noteCtx: NoteContext): ADSRConfig => ({ // Standard fade envelope
                attack: this.getPropertyValue<number>('attack') ?? 0.1,
                decay: this.getPropertyValue<number>('decay') ?? 0.2,
                sustain: this.getPropertyValue<number>('sustain') ?? 0.7,
                release: this.getPropertyValue<number>('release') ?? 1.0,
            }))
            .withPosition((ctx: MappingContext) => {
                // Get properties
                const travelSpeed = this.getPropertyValue<number>('travelSpeed') ?? 3;
                const initialYMin = this.getPropertyValue<number>('initialYMin') ?? -5;
                const initialYMax = this.getPropertyValue<number>('initialYMax') ?? 5;
                const oscFreq = this.getPropertyValue<number>('oscillationFreq') ?? 0.5;
                const oscRange = this.getPropertyValue<number>('oscillationRange') ?? 2;
                const baseXSeparation = this.getPropertyValue<number>('baseXSeparation') ?? 1.0;
                const xSeparationPerOctave = this.getPropertyValue<number>('xSeparationPerOctave') ?? 0.75;

                // Calculate pitch and octave info
                const pitch = ctx.note.pitch;
                const pitchClass = pitch % 12; // 0-11
                const octaveIndex = Math.floor(pitch / 12); // C0=0, C4=5, etc.
                const octaveOffset = REFERENCE_OCTAVE_INDEX - octaveIndex; // Positive for octaves below reference

                // --- X Position --- 
                const octaveXSeparation = Math.max(0, octaveOffset) * xSeparationPerOctave;
                const totalXSeparation = baseXSeparation + octaveXSeparation;
                const xPos = totalXSeparation * (ctx.instanceData.side === 'left' ? -1 : 1);

                // --- Y Position --- 
                const initialY = MUtils.mapValue(pitchClass, 0, 11, initialYMin, initialYMax);
                const oscPhase = ctx.timeSinceNoteStart * oscFreq * 2 * Math.PI;
                const yOffset = Math.sin(oscPhase) * (oscRange / 2);
                const yPos = initialY + yOffset;

                // --- Z Position --- 
                const zPos = -ctx.timeSinceNoteStart * travelSpeed;

                return [xPos, yPos, zPos];
            })
            .withScale((ctx: MappingContext) => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 0.6;
                const sizeIncreasePerOctaveDown = this.getPropertyValue<number>('sizeIncreasePerOctaveDown') ?? 0.15;

                // Calculate octave info
                const pitch = ctx.note.pitch;
                const octaveIndex = Math.floor(pitch / 12);
                const octaveOffset = REFERENCE_OCTAVE_INDEX - octaveIndex; // Positive for octaves below reference

                // Calculate size multiplier
                const sizeMultiplier = 1.0 + Math.max(0, octaveOffset) * sizeIncreasePerOctaveDown;
                
                // Combine base size, octave scaling, and ADSR fade
                const finalScale = baseSize * sizeMultiplier * (ctx.adsrAmplitude ?? 0);
                return Math.max(0.001, finalScale); // Prevent zero scale
            })
            .withRotation((ctx: MappingContext) => {
                const rotSpeed = 30; // Keep simple rotation
                const rotY = ctx.timeSinceNoteStart * rotSpeed;
                return [0, rotY, 0];
            })
            .withColor((ctx: MappingContext) => {
                const hueStart = this.getPropertyValue<number>('colorStart') ?? 0;
                const hueEnd = this.getPropertyValue<number>('colorEnd') ?? 240;
                const saturation = 85;
                const pitch = ctx.note.pitch;
                const pitchClass = pitch % 12; // 0-11

                // Map pitch class (0-11) to the hue range
                const hue = MUtils.mapValue(pitchClass, 0, 11, hueStart, hueEnd) % 360;
                
                // Map ADSR amplitude to lightness
                const lightness = MUtils.mapValue(ctx.adsrAmplitude ?? 0, 0, 1, 30, 75); // Dimmer min lightness
                return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness.toFixed(0)}%)`;
            })
            .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0); // Fade with ADSR
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new SineWaveSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default SineWaveSynth; 