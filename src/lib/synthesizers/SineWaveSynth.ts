import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property, NumericMetadata } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class SineWaveSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['cubeSize', new Property<number>('cubeSize', 0.6, { uiType: 'slider', label: 'Cube Size', min: 0.1, max: 3, step: 0.05 })],
            ['travelSpeed', new Property<number>('travelSpeed', 3, { uiType: 'slider', label: 'Travel Speed (Z)', min: 0.1, max: 10, step: 0.1 })],
            ['initialYMin', new Property<number>('initialYMin', -5, { uiType: 'slider', label: 'Initial Y Min', min: -10, max: 10, step: 0.1 })],
            ['initialYMax', new Property<number>('initialYMax', 5, { uiType: 'slider', label: 'Initial Y Max', min: -10, max: 10, step: 0.1 })],
            ['oscillationFreq', new Property<number>('oscillationFreq', 0.5, { uiType: 'slider', label: 'Oscillation Freq (Hz)', min: 0.1, max: 5, step: 0.05 })],
            ['oscillationRange', new Property<number>('oscillationRange', 2, { uiType: 'slider', label: 'Oscillation Y Range', min: 0, max: 10, step: 0.1 })],
            ['colorStart', new Property<number>('colorStart', 0, { uiType: 'slider', label: 'Hue Start', min: 0, max: 360, step: 1 })],
            ['colorEnd', new Property<number>('colorEnd', 180, { uiType: 'slider', label: 'Hue End', min: 0, max: 360, step: 1 })],
            // Standard ADSR for fade
            ['attack', new Property<number>('attack', 0.1, { uiType: 'slider', label: 'Attack (s)', min: 0.01, max: 2, step: 0.01 })],
            ['decay', new Property<number>('decay', 0.2, { uiType: 'slider', label: 'Decay (s)', min: 0.01, max: 2, step: 0.01 })],
            ['sustain', new Property<number>('sustain', 0.7, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 1.0, { uiType: 'slider', label: 'Release (s)', min: 0.1, max: 4, step: 0.05 })],
            ['amplitude', new Property<number>(
                'amplitude', 1.0,
                { label: 'Amplitude', min: 0, max: 2, step: 0.1, uiType: 'slider' } as NumericMetadata & { uiType: 'slider'}
            )],
            ['frequency', new Property<number>(
                'frequency', 0.5, 
                { label: 'Frequency', min: 0.1, max: 5, step: 0.1, uiType: 'slider' } as NumericMetadata & { uiType: 'slider'}
            )],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('cube')
            .forEachInstance((ctx: MappingContext) => [{}]) // Single instance per note
            .applyADSR((noteCtx: NoteContext) => ({ // Standard fade envelope
                attack: this.getPropertyValue<number>('attack') ?? 0.1,
                decay: this.getPropertyValue<number>('decay') ?? 0.2,
                sustain: this.getPropertyValue<number>('sustain') ?? 0.7,
                release: this.getPropertyValue<number>('release') ?? 1.0,
            }))
            .withPosition((ctx: MappingContext) => {
                const travelSpeed = this.getPropertyValue<number>('travelSpeed') ?? 3;
                const initialYMin = this.getPropertyValue<number>('initialYMin') ?? -5;
                const initialYMax = this.getPropertyValue<number>('initialYMax') ?? 5;
                const oscFreq = this.getPropertyValue<number>('oscillationFreq') ?? 0.5;
                const oscRange = this.getPropertyValue<number>('oscillationRange') ?? 2;
                const pitchMod12 = ctx.note.pitch % 12;

                // Calculate initial Y position based on pitch
                const initialY = MUtils.mapValue(pitchMod12, 0, 11, initialYMin, initialYMax);

                // Calculate current Z position (moving backwards)
                const zPos = -ctx.timeSinceNoteStart * travelSpeed;

                // Calculate Y oscillation based on time
                const oscPhase = ctx.timeSinceNoteStart * oscFreq * 2 * Math.PI;
                const yOffset = Math.sin(oscPhase) * (oscRange / 2);
                const yPos = initialY + yOffset;

                const xPos = 0; // Keep centered on X

                return [xPos, yPos, zPos];
            })
            .withScale((ctx: MappingContext) => {
                const size = this.getPropertyValue<number>('cubeSize') ?? 0.6;
                // Fade size with ADSR
                return size * (ctx.adsrAmplitude ?? 0);
            })
            .withRotation((ctx: MappingContext) => {
                // Optional: Add some rotation?
                const rotSpeed = 30;
                const rotY = ctx.timeSinceNoteStart * rotSpeed;
                return [0, rotY, 0];
            })
            .withColor((ctx: MappingContext) => {
                const hueStart = this.getPropertyValue<number>('colorStart') ?? 0;
                const hueEnd = this.getPropertyValue<number>('colorEnd') ?? 180;
                const pitchMod12 = ctx.note.pitch % 12;
                const hue = MUtils.mapValue(pitchMod12, 0, 11, hueStart, hueEnd) % 360;
                const saturation = 85;
                const lightness = MUtils.mapValue(ctx.adsrAmplitude ?? 0, 0, 1, 40, 70);
                return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness.toFixed(0)}%)`;
            })
            .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0);
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        const objects: VisualObject[] = [];
        const amplitude = this.getPropertyValue<number>('amplitude') ?? 1.0;
        const frequency = this.getPropertyValue<number>('frequency') ?? 0.5;

        midiBlocks.forEach(block => {
            block.notes.forEach(note => {
                const noteStart = note.startBeat + block.startBeat;
                const noteEnd = noteStart + note.duration;

                // Check if the note is active at the current time
                if (time >= noteStart && time < noteEnd) {
                    // Base position or calculation based on pitch (example: simple mapping)
                    const baseX = (note.pitch % 12) - 6; // Example position based on pitch class
                    const baseZ = Math.floor(note.pitch / 12) - 5; // Example position based on octave

                    // Calculate vertical position based on sine wave
                    const yPos = Math.sin((time - noteStart) * Math.PI * 2 * frequency) * amplitude;
                    
                    // Calculate opacity fade out towards the end of the note
                    const timeRemaining = noteEnd - time;
                    const fadeDuration = Math.min(note.duration * 0.2, 0.5); // Fade out over last 20% or 0.5 beats
                    let opacity = 1.0;
                    if (timeRemaining < fadeDuration) {
                        opacity = Math.max(0, timeRemaining / fadeDuration);
                    }

                    objects.push({
                        type: 'sphere', // Example type
                        properties: {
                            position: [baseX, yPos, baseZ],
                            scale: [0.5, 0.5, 0.5], // Example scale
                            color: '#00ffaa', // Example color
                            opacity: opacity * (note.velocity / 127), // Opacity based on velocity and fade
                            // Initial velocity could be set here if desired, e.g.:
                            // velocity: [0, initialYVelocity, 0]
                        }
                    });
                }
            });
        });

        return objects;
    }

    clone(): this {
        const newInstance = new SineWaveSynth() as this;
        // Clone properties
        this.properties.forEach((prop, key) => {
            newInstance.properties.set(key, prop.clone());
        });
        return newInstance;
    }
}

export default SineWaveSynth; 