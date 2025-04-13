import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class PulsingRadiusSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['baseRadius', new Property<number>('baseRadius', 0.5, { uiType: 'slider', label: 'Base Radius', min: 0.1, max: 3, step: 0.05 })],
            ['radiusPitchScale', new Property<number>('radiusPitchScale', 0.2, { uiType: 'slider', label: 'Radius/Note (0-11)', min: 0, max: 1, step: 0.01 })],
            ['pulseSpeed', new Property<number>('pulseSpeed', 2, { uiType: 'slider', label: 'Pulse Speed (Hz)', min: 0.1, max: 10, step: 0.1 })],
            ['pulseDepth', new Property<number>('pulseDepth', 0.3, { uiType: 'slider', label: 'Pulse Depth (0-1)', min: 0, max: 1, step: 0.05 })],
            ['colorHueBase', new Property<number>('colorHueBase', 0, { uiType: 'slider', label: 'Base Hue (0-360)', min: 0, max: 360, step: 1 })],
            ['colorHuePitchScale', new Property<number>('colorHuePitchScale', 15, { uiType: 'slider', label: 'Hue Shift/Note', min: 0, max: 30, step: 1 })],
            ['attack', new Property<number>('attack', 0.2, { uiType: 'slider', label: 'Attack (s)', min: 0.01, max: 2, step: 0.01 })],
            ['decay', new Property<number>('decay', 0.3, { uiType: 'slider', label: 'Decay (s)', min: 0.01, max: 2, step: 0.01 })],
            ['sustain', new Property<number>('sustain', 0.6, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 1.5, { uiType: 'slider', label: 'Release (s)', min: 0.1, max: 5, step: 0.05 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('torus') // Using a torus this time
            .applyADSR((noteCtx: NoteContext) => ({
                attack: this.getPropertyValue<number>('attack') ?? 0.2,
                decay: this.getPropertyValue<number>('decay') ?? 0.3,
                sustain: this.getPropertyValue<number>('sustain') ?? 0.6,
                release: this.getPropertyValue<number>('release') ?? 1.5,
            }))
            .forEachInstance((parentCtx: MappingContext) => [{}]) // Single instance per note
            .withPosition((ctx: MappingContext) => {
                // Position based on overall pitch, maybe centered Y for this one?
                // const y = MUtils.mapPitchToRange(ctx.note.pitch, -6, 6);
                return [0, 0, 0]; // Keep it centered
            })
            .withScale((ctx: MappingContext) => {
                const baseRadius = this.getPropertyValue<number>('baseRadius') ?? 0.5;
                const radiusPitchScale = this.getPropertyValue<number>('radiusPitchScale') ?? 0.2;
                const pulseSpeed = this.getPropertyValue<number>('pulseSpeed') ?? 2;
                const pulseDepth = this.getPropertyValue<number>('pulseDepth') ?? 0.3;

                const noteMod12 = ctx.note.pitch % 12; // 0-11
                const amplitude = ctx.adsrAmplitude ?? 0;
                if (amplitude < 0.001) return 0; // Skip if amplitude is zero

                // 1. Calculate radius based on pitch
                const pitchRadius = baseRadius + (noteMod12 * radiusPitchScale);

                // 2. Calculate pulse factor based on time
                const pulsePhase = ctx.timeSinceNoteStart * pulseSpeed * 2 * Math.PI; // Convert Hz to phase
                const pulseFactor = 1 + Math.sin(pulsePhase) * pulseDepth;

                // 3. Combine pitch radius, pulse, and ADSR amplitude
                const finalScale = pitchRadius * pulseFactor * amplitude;

                // Store pulse factor in instance data if needed for color/rotation
                ctx.instanceData.pulseFactor = pulseFactor; // Modify context's instance data

                return finalScale;
            })
            .withRotation((ctx: MappingContext) => {
                // Slow rotation, maybe slightly affected by pitch?
                const noteMod12 = ctx.note.pitch % 12;
                const baseSpeed = 20; // degrees per second
                const pitchSpeedFactor = MUtils.mapValue(noteMod12, 0, 11, 0.8, 1.2);
                const rotationY = ctx.timeSinceNoteStart * baseSpeed * pitchSpeedFactor;
                const rotationX = ctx.timeSinceNoteStart * baseSpeed * 0.5 * pitchSpeedFactor; // Rotate on X axis too
                return [rotationX, rotationY, 0];
            })
            .withColor((ctx: MappingContext) => {
                const colorHueBase = this.getPropertyValue<number>('colorHueBase') ?? 0;
                const colorHuePitchScale = this.getPropertyValue<number>('colorHuePitchScale') ?? 15;
                const noteMod12 = ctx.note.pitch % 12;

                const hue = (colorHueBase + noteMod12 * colorHuePitchScale) % 360;
                const saturation = 90;
                // Let lightness pulse slightly with the size pulse
                const pulseFactor = ctx.instanceData.pulseFactor ?? 1;
                const baseLightness = 60;
                const lightness = baseLightness + (pulseFactor - 1) * 15; // Pulse lightness (range ~45-75)

                return `hsl(${hue.toFixed(0)}, ${saturation}%, ${Math.max(30, Math.min(85, lightness)).toFixed(0)}%)`;
            })
            .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0);
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new PulsingRadiusSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default PulsingRadiusSynth; 