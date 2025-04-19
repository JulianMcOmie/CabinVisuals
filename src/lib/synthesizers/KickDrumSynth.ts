import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, PhysicsEnvelopeConfig } from '../VisualObjectEngine';

class KickDrumSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['baseSize', new Property<number>('baseSize', 3, { uiType: 'slider', label: 'Base Size', min: 0.1, max: 5, step: 0.1 })],
            ['compressionFactor', new Property<number>('compressionFactor', 0.5, { uiType: 'slider', label: 'Compression Amount', min: 0, max: 2, step: 0.05 })],
            ['minScaleFactor', new Property<number>('minScaleFactor', 0.1, { uiType: 'slider', label: 'Min Size Factor', min: 0.01, max: 0.5, step: 0.01 })],
            ['positionX', new Property<number>('positionX', 0, { uiType: 'slider', label: 'X Position', min: -10, max: 10, step: 0.1 })],
            ['positionY', new Property<number>('positionY', 0, { uiType: 'slider', label: 'Y Position', min: -10, max: 10, step: 0.1 })],
            ['positionZ', new Property<number>('positionZ', 0, { uiType: 'slider', label: 'Z Position', min: -10, max: 10, step: 0.1 })],
            ['baseColor', new Property<string>('baseColor', '#ff4400', { uiType: 'color', label: 'Color' })],
            ['tension', new Property<number>('tension', 250, { uiType: 'slider', label: 'Tension', min: 10, max: 1000, step: 5 })],
            ['friction', new Property<number>('friction', 15, { uiType: 'slider', label: 'Friction', min: 0, max: 50, step: 0.5 })],
            ['initialVelocity', new Property<number>('initialVelocity', 5, { uiType: 'slider', label: 'Impact Velocity', min: 0, max: 20, step: 0.2 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('sphere')
            .applyPhysicsEnvelope((noteCtx: NoteContext): PhysicsEnvelopeConfig => ({
                tension: this.getPropertyValue<number>('tension') ?? 250,
                friction: this.getPropertyValue<number>('friction') ?? 15,
                initialVelocity: (this.getPropertyValue<number>('initialVelocity') ?? 5) * MUtils.mapValue(noteCtx.note.velocity, 0, 127, 0.5, 1.5),
            }))
            .withPosition((ctx: MappingContext) => {
                const x = this.getPropertyValue<number>('positionX') ?? 0;
                const y = this.getPropertyValue<number>('positionY') ?? 0;
                const z = this.getPropertyValue<number>('positionZ') ?? 0;
                return [x, y, z];
            })
            .withScale((ctx: MappingContext) => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 1.5;
                const compressionFactor = this.getPropertyValue<number>('compressionFactor') ?? 0.5;
                const minScaleFactor = this.getPropertyValue<number>('minScaleFactor') ?? 0.1;
                const physicsDisplacement = ctx.physicsValue ?? 0; // Oscillator value

                // Positive physics displacement should decrease size (compression)
                const targetScale = baseSize - (physicsDisplacement * compressionFactor);

                // Ensure scale doesn't go below the minimum factor of base size
                const minScale = baseSize * minScaleFactor;
                const finalScale = Math.max(minScale, targetScale);

                return finalScale; // Return a single number for uniform scaling
            })
            .withColor((ctx: MappingContext) => {
                return this.getPropertyValue<string>('baseColor') ?? '#ff4400';
            })
            .withOpacity((ctx: MappingContext) => {
                return 1.0;
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