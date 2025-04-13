import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class KickDrumSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['maxSize', new Property<number>('maxSize', 2.5, { uiType: 'slider', label: 'Max Size', min: 0.5, max: 8, step: 0.1 })],
            ['positionX', new Property<number>('positionX', 0, { uiType: 'slider', label: 'X Position', min: -10, max: 10, step: 0.1 })],
            ['positionY', new Property<number>('positionY', -4, { uiType: 'slider', label: 'Y Position', min: -10, max: 10, step: 0.1 })],
            ['positionZ', new Property<number>('positionZ', 0, { uiType: 'slider', label: 'Z Position', min: -10, max: 10, step: 0.1 })],
            ['baseColor', new Property<string>('baseColor', '#ff4400', { uiType: 'color', label: 'Color' })],
            // ADSR controls size reduction (attack/decay define the "impact")
            ['attack', new Property<number>('attack', 0.01, { uiType: 'slider', label: 'Impact Time (s)', min: 0.001, max: 0.1, step: 0.001 })],
            ['decay', new Property<number>('decay', 0.15, { uiType: 'slider', label: 'Size Decay (s)', min: 0.01, max: 1, step: 0.005 })],
            ['sustain', new Property<number>('sustain', 0, { uiType: 'slider', label: 'Sustain (Unused)', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 0.01, { uiType: 'slider', label: 'Release (Unused)', min: 0.01, max: 0.5, step: 0.005 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('sphere')
            .forEachInstance((ctx: MappingContext) => [{}]) // Single instance per note
            .applyADSR((noteCtx: NoteContext) => ({ // Short envelope for impact
                attack: this.getPropertyValue<number>('attack') ?? 0.01,
                decay: this.getPropertyValue<number>('decay') ?? 0.15,
                sustain: this.getPropertyValue<number>('sustain') ?? 0,
                release: this.getPropertyValue<number>('release') ?? 0.01,
            }))
            .withPosition((ctx: MappingContext) => {
                const x = this.getPropertyValue<number>('positionX') ?? 0;
                const y = this.getPropertyValue<number>('positionY') ?? -4;
                const z = this.getPropertyValue<number>('positionZ') ?? 0;
                return [x, y, z];
            })
            .withScale((ctx: MappingContext) => {
                const maxSize = this.getPropertyValue<number>('maxSize') ?? 2.5;
                // ADSR amplitude goes 0 -> 1 -> 0 quickly. We want size to go maxSize -> 0.
                // So, scale = maxSize * (1 - adsrAmplitude)
                const amplitude = ctx.adsrAmplitude ?? 0;
                const scale = maxSize * (1.0 - amplitude);
                return Math.max(0.001, scale); // Prevent zero or negative scale
            })
            .withColor((ctx: MappingContext) => {
                return this.getPropertyValue<string>('baseColor') ?? '#ff4400';
            })
            .withOpacity((ctx: MappingContext) => {
                // Fade quickly as size decreases
                const amplitude = ctx.adsrAmplitude ?? 0;
                return Math.max(0, 1.0 - amplitude * 1.5); // Fade faster than size shrinks
            });
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new KickDrumSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default KickDrumSynth; 