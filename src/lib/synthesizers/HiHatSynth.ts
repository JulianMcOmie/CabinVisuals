import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class HiHatSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['size', new Property<number>('size', 0.4, { uiType: 'slider', label: 'Size', min: 0.1, max: 2, step: 0.05 })],
            ['positionX', new Property<number>('positionX', 0, { uiType: 'slider', label: 'X Position', min: -10, max: 10, step: 0.1 })],
            ['positionY', new Property<number>('positionY', 4, { uiType: 'slider', label: 'Y Position', min: -10, max: 10, step: 0.1 })],
            ['positionZ', new Property<number>('positionZ', 0, { uiType: 'slider', label: 'Z Position', min: -10, max: 10, step: 0.1 })],
            ['rotationX', new Property<number>('rotationX', 45, { uiType: 'slider', label: 'X Rotation', min: -180, max: 180, step: 5 })],
            ['rotationY', new Property<number>('rotationY', 45, { uiType: 'slider', label: 'Y Rotation', min: -180, max: 180, step: 5 })],
            ['color', new Property<string>('color', '#ffffaa', { uiType: 'color', label: 'Color' })],
            // Very quick ADSR for the tick sound
            ['attack', new Property<number>('attack', 0.005, { uiType: 'slider', label: 'Attack (s)', min: 0.001, max: 0.05, step: 0.001 })],
            ['decay', new Property<number>('decay', 0.03, { uiType: 'slider', label: 'Decay (s)', min: 0.01, max: 0.2, step: 0.005 })],
            ['sustain', new Property<number>('sustain', 0, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 0.01, { uiType: 'slider', label: 'Release (s)', min: 0.001, max: 0.1, step: 0.001 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('cube')
            .forEachInstance((ctx: MappingContext) => [{}]) // Single instance
            .applyADSR((noteCtx: NoteContext) => ({ // Very sharp envelope
                attack: this.getPropertyValue<number>('attack') ?? 0.005,
                decay: this.getPropertyValue<number>('decay') ?? 0.03,
                sustain: this.getPropertyValue<number>('sustain') ?? 0,
                release: this.getPropertyValue<number>('release') ?? 0.01,
            }))
            .withPosition((ctx: MappingContext) => {
                const x = this.getPropertyValue<number>('positionX') ?? 0;
                const y = this.getPropertyValue<number>('positionY') ?? 4;
                const z = this.getPropertyValue<number>('positionZ') ?? 0;
                return [x, y, z];
            })
            .withScale((ctx: MappingContext) => {
                // Scale pulses with the sharp ADSR
                const size = this.getPropertyValue<number>('size') ?? 0.4;
                const amplitude = ctx.adsrAmplitude ?? 0;
                return size * amplitude;
            })
            .withRotation((ctx: MappingContext) => {
                const rx = this.getPropertyValue<number>('rotationX') ?? 45;
                const ry = this.getPropertyValue<number>('rotationY') ?? 45;
                return [rx, ry, 0]; // Static rotation
            })
            .withColor((ctx: MappingContext) => {
                return this.getPropertyValue<string>('color') ?? '#ffffaa';
            })
            .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0); // Fade with ADSR
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new HiHatSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default HiHatSynth; 