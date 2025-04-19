import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, PhysicsEnvelopeConfig, ADSRConfig } from '../VisualObjectEngine';

class SnareDrumSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            // Size and Position
            ['baseSize', new Property<number>('baseSize', 0.2, { uiType: 'slider', label: 'Base Size', min: 0.01, max: 2, step: 0.01 })],
            ['expansionFactor', new Property<number>('expansionFactor', 1.5, { uiType: 'slider', label: 'Expansion Amount', min: 0.1, max: 5, step: 0.1 })],
            ['positionX', new Property<number>('positionX', 0, { uiType: 'slider', label: 'X Position', min: -10, max: 10, step: 0.1 })],
            ['positionY', new Property<number>('positionY', -1, { uiType: 'slider', label: 'Y Position', min: -10, max: 10, step: 0.1 })],
            ['positionZ', new Property<number>('positionZ', 0, { uiType: 'slider', label: 'Z Position', min: -10, max: 10, step: 0.1 })],
            ['baseColor', new Property<string>('baseColor', '#E0E0E0', { uiType: 'color', label: 'Color' })],
            // Physics controls for size expansion
            ['tension', new Property<number>('tension', 400, { uiType: 'slider', label: 'Tension', min: 50, max: 1500, step: 10 })],
            ['friction', new Property<number>('friction', 18, { uiType: 'slider', label: 'Friction', min: 0, max: 60, step: 0.5 })],
            ['initialVelocity', new Property<number>('initialVelocity', 8, { uiType: 'slider', label: 'Impact Velocity', min: 1, max: 30, step: 0.5 })],
            // ADSR controls for opacity fade
            ['opacityAttack', new Property<number>('opacityAttack', 0.005, { uiType: 'slider', label: 'Fade In (s)', min: 0.001, max: 0.1, step: 0.001 })],
            ['opacityDecay', new Property<number>('opacityDecay', 0.15, { uiType: 'slider', label: 'Fade Out (s)', min: 0.01, max: 1, step: 0.005 })],
            ['opacitySustain', new Property<number>('opacitySustain', 0, { uiType: 'slider', label: 'Sustain', min: 0, max: 1, step: 0.01 })],
            ['opacityRelease', new Property<number>('opacityRelease', 0.05, { uiType: 'slider', label: 'Release (s)', min: 0.01, max: 0.5, step: 0.005 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('sphere') // Could also use a thin cylinder or disk
            .forEachInstance((ctx: MappingContext) => [{}]) // Single instance per note
            .applyPhysicsEnvelope((noteCtx: NoteContext): PhysicsEnvelopeConfig => ({
                tension: this.getPropertyValue<number>('tension') ?? 400,
                friction: this.getPropertyValue<number>('friction') ?? 18,
                initialVelocity: (this.getPropertyValue<number>('initialVelocity') ?? 8) * MUtils.mapValue(noteCtx.note.velocity, 0, 127, 0.5, 1.5),
            }))
            .applyADSR((noteCtx: NoteContext): ADSRConfig => ({ // Separate ADSR for opacity
                attack: this.getPropertyValue<number>('opacityAttack') ?? 0.005,
                decay: this.getPropertyValue<number>('opacityDecay') ?? 0.15,
                sustain: this.getPropertyValue<number>('opacitySustain') ?? 0,
                release: this.getPropertyValue<number>('opacityRelease') ?? 0.05,
            }))
            .withPosition((ctx: MappingContext) => {
                const x = this.getPropertyValue<number>('positionX') ?? 0;
                const y = this.getPropertyValue<number>('positionY') ?? -1;
                const z = this.getPropertyValue<number>('positionZ') ?? 0;
                return [x, y, z];
            })
            .withScale((ctx: MappingContext) => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 0.2;
                const expansionFactor = this.getPropertyValue<number>('expansionFactor') ?? 1.5;
                const physicsDisplacement = ctx.physicsValue ?? 0; // Oscillator value

                // Positive physics displacement should *increase* size (expansion)
                const targetScale = baseSize + (physicsDisplacement * expansionFactor);

                // Ensure scale doesn't go below a very small minimum (or baseSize if preferred)
                const finalScale = Math.max(0.01, targetScale);

                return finalScale; // Uniform scaling
            })
            .withColor((ctx: MappingContext) => {
                 // Just use base color for now
                 return this.getPropertyValue<string>('baseColor') ?? '#E0E0E0';
            })
            .withOpacity((ctx: MappingContext) => {
                // Opacity is directly controlled by the ADSR envelope
                return ctx.adsrAmplitude ?? 0;
            });
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