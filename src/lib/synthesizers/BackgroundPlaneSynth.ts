import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class BackgroundPlaneSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['width', new Property<number>('width', 50, { uiType: 'slider', label: 'Width (X)', min: 10, max: 100, step: 1 })],
            ['height', new Property<number>('height', 50, { uiType: 'slider', label: 'Height (Y)', min: 10, max: 100, step: 1 })],
            ['depth', new Property<number>('depth', 0.1, { uiType: 'slider', label: 'Depth (Z)', min: 0.01, max: 2, step: 0.01 })],
            ['positionZ', new Property<number>('positionZ', -20, { uiType: 'slider', label: 'Z Position (Depth)', min: -50, max: 0, step: 0.5 })],
            ['baseHue', new Property<number>('baseHue', 0, { uiType: 'slider', label: 'Base Hue', min: 0, max: 360, step: 1 })],
            ['huePitchScale', new Property<number>('huePitchScale', 20, { uiType: 'slider', label: 'Hue/Pitch (0-11)', min: 0, max: 30, step: 1 })],
            ['saturation', new Property<number>('saturation', 60, { uiType: 'slider', label: 'Saturation %', min: 0, max: 100, step: 1 })],
            ['lightness', new Property<number>('lightness', 30, { uiType: 'slider', label: 'Lightness %', min: 0, max: 100, step: 1 })],
            // ADSR: Keep it visible while note is held
            ['attack', new Property<number>('attack', 0.01, { uiType: 'slider', label: 'Fade In (s)', min: 0.001, max: 1, step: 0.001 })],
            ['decay', new Property<number>('decay', 0.0, { uiType: 'slider', label: 'Decay (s)', min: 0.0, max: 1, step: 0.01 })],
            ['sustain', new Property<number>('sustain', 1.0, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 0.01, { uiType: 'slider', label: 'Fade Out (s)', min: 0.001, max: 1, step: 0.001 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('cube')
            .forEachInstance((ctx: MappingContext) => [{}]) // Single instance per note
            .applyADSR((noteCtx: NoteContext) => ({ // Fast attack/release, full sustain
                attack: this.getPropertyValue<number>('attack') ?? 0.01,
                decay: this.getPropertyValue<number>('decay') ?? 0.0,
                sustain: this.getPropertyValue<number>('sustain') ?? 1.0,
                release: this.getPropertyValue<number>('release') ?? 0.01,
            }))
            .withPosition((ctx: MappingContext) => {
                const z = this.getPropertyValue<number>('positionZ') ?? -20;
                return [0, 0, z]; // Centered X, Y, far back Z
            })
            .withScale((ctx: MappingContext) => {
                const width = this.getPropertyValue<number>('width') ?? 50;
                const height = this.getPropertyValue<number>('height') ?? 50;
                const depth = this.getPropertyValue<number>('depth') ?? 0.1;
                 // Only show if ADSR is active
                const scaleFactor = (ctx.adsrPhase && ctx.adsrPhase !== 'idle') ? 1 : 0;
                return [width * scaleFactor, height * scaleFactor, depth * scaleFactor];
            })
            .withRotation((ctx: MappingContext) => {
                return [0, 0, 0]; // No rotation needed
            })
            .withColor((ctx: MappingContext) => {
                const baseHue = this.getPropertyValue<number>('baseHue') ?? 0;
                const huePitchScale = this.getPropertyValue<number>('huePitchScale') ?? 20;
                const saturation = this.getPropertyValue<number>('saturation') ?? 60;
                const lightness = this.getPropertyValue<number>('lightness') ?? 30;
                const pitchMod12 = ctx.note.pitch % 12;
                const hue = (baseHue + pitchMod12 * huePitchScale) % 360;
                return `hsl(${hue.toFixed(0)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%)`;
            })
            .withOpacity((ctx: MappingContext) => {
                // Use ADSR amplitude for fade in/out
                return ctx.adsrAmplitude ?? 0;
            });
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new BackgroundPlaneSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default BackgroundPlaneSynth; 