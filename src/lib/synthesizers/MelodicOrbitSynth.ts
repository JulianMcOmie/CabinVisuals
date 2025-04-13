import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class MelodicOrbitSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['orbitRadius', new Property<number>('orbitRadius', 4, { uiType: 'slider', label: 'Orbit Radius', min: 0.5, max: 10, step: 0.1 })],
            ['orbitSpeed', new Property<number>('orbitSpeed', 90, { uiType: 'slider', label: 'Orbit Speed (°/s)', min: 10, max: 720, step: 5 })],
            ['startSize', new Property<number>('startSize', 0.5, { uiType: 'slider', label: 'Start Size', min: 0.1, max: 3, step: 0.05 })],
            ['baseHue', new Property<number>('baseHue', 120, { uiType: 'slider', label: 'Base Hue', min: 0, max: 360, step: 1 })],
            ['huePitchScale', new Property<number>('huePitchScale', 10, { uiType: 'slider', label: 'Hue/Pitch', min: 0, max: 30, step: 1 })],
            ['attack', new Property<number>('attack', 0.05, { uiType: 'slider', label: 'Attack (s)', min: 0.01, max: 1, step: 0.01 })],
            ['decay', new Property<number>('decay', 0.4, { uiType: 'slider', label: 'Decay (s)', min: 0.1, max: 2, step: 0.01 })],
            ['sustain', new Property<number>('sustain', 0, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })], // Fade away
            ['release', new Property<number>('release', 0.8, { uiType: 'slider', label: 'Release (s)', min: 0.1, max: 3, step: 0.01 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('sphere')
            .forEachInstance((ctx: MappingContext) => [{}]) // Single instance per note
            .applyADSR((noteCtx: NoteContext) => ({ // ADSR controls fade out
                attack: this.getPropertyValue<number>('attack') ?? 0.05,
                decay: this.getPropertyValue<number>('decay') ?? 0.4,
                sustain: this.getPropertyValue<number>('sustain') ?? 0, // Fade
                release: this.getPropertyValue<number>('release') ?? 0.8,
            }))
            .withPosition((ctx: MappingContext) => {
                const radius = this.getPropertyValue<number>('orbitRadius') ?? 4;
                const speed = this.getPropertyValue<number>('orbitSpeed') ?? 90;
                const angleDegrees = ctx.timeSinceNoteStart * speed;
                const angleRadians = angleDegrees * (Math.PI / 180);
                const x = radius * Math.cos(angleRadians);
                const y = radius * Math.sin(angleRadians);
                // Y position based on overall pitch
                const z = MUtils.mapPitchToRange(ctx.note.pitch, -3, 3); // Map pitch to Z offset
                return [x, y, z];
            })
            .withScale((ctx: MappingContext) => {
                const startSize = this.getPropertyValue<number>('startSize') ?? 0.5;
                const amplitude = ctx.adsrAmplitude ?? 0;
                return startSize * amplitude;
            })
            .withColor((ctx: MappingContext) => {
                const baseHue = this.getPropertyValue<number>('baseHue') ?? 120;
                const huePitchScale = this.getPropertyValue<number>('huePitchScale') ?? 10;
                const pitchMod12 = ctx.note.pitch % 12;
                const hue = (baseHue + pitchMod12 * huePitchScale) % 360;
                const saturation = 80;
                const lightness = MUtils.mapValue(ctx.adsrAmplitude ?? 0, 0, 1, 40, 75);
                return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness.toFixed(0)}%)`;
            })
            .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0);
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new MelodicOrbitSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default MelodicOrbitSynth; 