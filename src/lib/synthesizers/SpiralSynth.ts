import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class SpiralSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['radiusGrowth', new Property<number>('radiusGrowth', 0.5, {
                uiType: 'slider', label: 'Radius Growth', min: 0.1, max: 5, step: 0.1
            })],
            ['angleSpeed', new Property<number>('angleSpeed', 90, { // Degrees per second
                uiType: 'slider', label: 'Angle Speed (°/s)', min: 10, max: 720, step: 10
            })],
            ['baseSize', new Property<number>('baseSize', 0.5, {
                uiType: 'slider', label: 'Base Size', min: 0.05, max: 2, step: 0.05
            })],
            ['hueShiftScale', new Property<number>('hueShiftScale', 5, { // Degrees per semitone (0-11)
                uiType: 'slider', label: 'Hue Shift/Note', min: 0, max: 30, step: 1
            })],
            ['attack', new Property<number>('attack', 0.1, { uiType: 'slider', label: 'Attack (s)', min: 0.001, max: 2, step: 0.001 })],
            ['decay', new Property<number>('decay', 0.2, { uiType: 'slider', label: 'Decay (s)', min: 0.001, max: 2, step: 0.001 })],
            ['sustain', new Property<number>('sustain', 0.8, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 1.0, { uiType: 'slider', label: 'Release (s)', min: 0.001, max: 5, step: 0.001 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('sphere')
            .applyADSR((noteCtx: NoteContext) => ({
                attack: this.getPropertyValue<number>('attack') ?? 0.1,
                decay: this.getPropertyValue<number>('decay') ?? 0.2,
                sustain: this.getPropertyValue<number>('sustain') ?? 0.8,
                release: this.getPropertyValue<number>('release') ?? 1.0,
            }))
            .withPosition((ctx: MappingContext) => {
                const radiusGrowth = this.getPropertyValue<number>('radiusGrowth') ?? 0.5;
                const angleSpeed = this.getPropertyValue<number>('angleSpeed') ?? 90; // Degrees per second

                const radius = ctx.timeSinceNoteStart * radiusGrowth;
                const angleDegrees = ctx.timeSinceNoteStart * angleSpeed;
                const angleRadians = angleDegrees * (Math.PI / 180);

                const x = radius * Math.cos(angleRadians);
                const y = MUtils.mapPitchToRange(ctx.note.pitch, -4, 4); // Pitch determines Y height
                const z = radius * Math.sin(angleRadians);

                return [x, y, z];
            })
            .withScale((ctx: MappingContext) => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 0.5;
                const amplitude = ctx.adsrAmplitude ?? 0;
                const scale = baseSize * amplitude * (ctx.note.velocity / 127);
                // Make scale slightly non-uniform based on note progress for pulsing
                const pulse = 1 + Math.sin(ctx.noteProgressPercent * Math.PI * 4) * 0.1;
                return [scale * pulse, scale, scale * pulse];
            })
            .withRotation((ctx: MappingContext) => {
                const noteMod12 = ctx.note.pitch % 12; // 0-11
                const rotationSpeedFactor = MUtils.mapValue(noteMod12, 0, 11, 0.5, 2.0); // Higher notes spin faster
                const yRotation = ctx.timeSinceNoteStart * 180 * rotationSpeedFactor; // Degrees
                return [0, yRotation, 0];
            })
            .withColor((ctx: MappingContext) => {
                const noteMod12 = ctx.note.pitch % 12; // 0-11
                const hueShiftScale = this.getPropertyValue<number>('hueShiftScale') ?? 5;
                const baseHue = 200; // Start around blue
                const hue = (baseHue + noteMod12 * hueShiftScale) % 360;
                const saturation = MUtils.mapValue(ctx.note.velocity, 0, 127, 60, 95); // Velocity affects saturation
                const lightness = MUtils.mapValue(ctx.adsrAmplitude ?? 0, 0, 1, 30, 75); // Brightness tied to ADSR

                return `hsl(${hue.toFixed(0)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%)`;
            })
            .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0);
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new SpiralSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default SpiralSynth; 