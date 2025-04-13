import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class SnareDrumSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['maxSize', new Property<number>('maxSize', 1.8, { uiType: 'slider', label: 'Max Size', min: 0.2, max: 5, step: 0.1 })],
            ['positionX', new Property<number>('positionX', 0, { uiType: 'slider', label: 'X Position', min: -10, max: 10, step: 0.1 })],
            ['positionY', new Property<number>('positionY', -1, { uiType: 'slider', label: 'Y Position', min: -10, max: 10, step: 0.1 })],
            ['positionZ', new Property<number>('positionZ', 0, { uiType: 'slider', label: 'Z Position', min: -10, max: 10, step: 0.1 })],
            ['baseColor', new Property<string>('baseColor', '#cccccc', { uiType: 'color', label: 'Color' })],
            // ADSR controls size increase and fade
            ['attack', new Property<number>('attack', 0.01, { uiType: 'slider', label: 'Impact Time (s)', min: 0.001, max: 0.1, step: 0.001 })],
            ['decay', new Property<number>('decay', 0.1, { uiType: 'slider', label: 'Fade Time (s)', min: 0.01, max: 1, step: 0.005 })],
            ['sustain', new Property<number>('sustain', 0, { uiType: 'slider', label: 'Sustain (Unused)', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 0.01, { uiType: 'slider', label: 'Release (Unused)', min: 0.01, max: 0.5, step: 0.005 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('sphere')
            .forEachInstance((ctx: MappingContext) => [{}]) // Single instance per note
            .applyADSR((noteCtx: NoteContext) => ({ // Short envelope for impact/fade
                attack: this.getPropertyValue<number>('attack') ?? 0.01,
                decay: this.getPropertyValue<number>('decay') ?? 0.1,
                sustain: this.getPropertyValue<number>('sustain') ?? 0,
                release: this.getPropertyValue<number>('release') ?? 0.01,
            }))
            .withPosition((ctx: MappingContext) => {
                const x = this.getPropertyValue<number>('positionX') ?? 0;
                const y = this.getPropertyValue<number>('positionY') ?? -1;
                const z = this.getPropertyValue<number>('positionZ') ?? 0;
                return [x, y, z];
            })
            .withScale((ctx: MappingContext) => {
                const maxSize = this.getPropertyValue<number>('maxSize') ?? 1.8;
                // ADSR amplitude goes 0 -> 1 -> 0. We want size to go 0 -> maxSize -> 0.
                const amplitude = ctx.adsrAmplitude ?? 0;
                const scale = maxSize * amplitude;
                return Math.max(0.001, scale);
            })
            .withColor((ctx: MappingContext) => {
                 const baseColor = this.getPropertyValue<string>('baseColor') ?? '#cccccc';
                 // Optionally make brightness pulse with ADSR?
                 const amplitude = ctx.adsrAmplitude ?? 0;
                 const lightness = MUtils.mapValue(amplitude, 0, 1, 50, 85); // Pulse brightness
                 // Basic HSL parsing/reconstruction to adjust lightness
                 try {
                    const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
                    if (hslMatch) {
                        return `hsl(${hslMatch[1]}, ${hslMatch[2]}%, ${lightness.toFixed(0)}%)`;
                    }
                    // Add basic hex support? - Or just return base color if not HSL
                 } catch (e) { /* ignore color parsing errors */ }
                 return baseColor; // Fallback
            })
            .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0);
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new SnareDrumSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default SnareDrumSynth; 