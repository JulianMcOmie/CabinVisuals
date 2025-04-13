import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class ShakerSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        // Properties to define rotation targets for different pitch classes (0-11)
        const props: [string, Property<any>][] = [
            ['baseSize', new Property<number>('baseSize', 0.5, { uiType: 'slider', label: 'Size', min: 0.1, max: 2, step: 0.05 })],
            ['positionX', new Property<number>('positionX', 0, { uiType: 'slider', label: 'X Position', min: -10, max: 10, step: 0.1 })],
            ['positionY', new Property<number>('positionY', 2, { uiType: 'slider', label: 'Y Position', min: -10, max: 10, step: 0.1 })],
            ['positionZ', new Property<number>('positionZ', 0, { uiType: 'slider', label: 'Z Position', min: -10, max: 10, step: 0.1 })],
            ['rotationSpeed', new Property<number>('rotationSpeed', 5, { uiType: 'slider', label: 'Rotation Speed (Lerp)', min: 1, max: 20, step: 0.5 })],
            ['attack', new Property<number>('attack', 0.01, { uiType: 'slider', label: 'Attack (s)', min: 0.001, max: 0.1, step: 0.001 })],
            ['decay', new Property<number>('decay', 0.05, { uiType: 'slider', label: 'Decay (s)', min: 0.01, max: 0.5, step: 0.005 })],
            ['sustain', new Property<number>('sustain', 0, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 0.05, { uiType: 'slider', label: 'Release (s)', min: 0.01, max: 0.5, step: 0.005 })],
        ];
        // Add rotation properties for each pitch class (0-11)
        for (let i = 0; i < 12; i++) {
            props.push([`rotX_${i}`, new Property<number>(`rotX_${i}`, (i % 4) * 90, { uiType: 'slider', label: `Rot X [${i}] (°)` , min: -180, max: 180, step: 5})]);
            props.push([`rotY_${i}`, new Property<number>(`rotY_${i}`, (i % 3) * 120, { uiType: 'slider', label: `Rot Y [${i}] (°)` , min: -180, max: 180, step: 5})]);
            props.push([`rotZ_${i}`, new Property<number>(`rotZ_${i}`, (i % 2) * 180, { uiType: 'slider', label: `Rot Z [${i}] (°)` , min: -180, max: 180, step: 5})]);
        }
        this.properties = new Map<string, Property<any>>(props);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('cube')
            .forEachInstance((ctx: MappingContext) => {
                // Store initial rotation based on previous note? No, simpler: store target rot based on current pitch
                const pitchMod12 = ctx.note.pitch % 12;
                const targetRotX = this.getPropertyValue<number>(`rotX_${pitchMod12}`) ?? 0;
                const targetRotY = this.getPropertyValue<number>(`rotY_${pitchMod12}`) ?? 0;
                const targetRotZ = this.getPropertyValue<number>(`rotZ_${pitchMod12}`) ?? 0;
                // We need to know the *previous* rotation to lerp from. This isn't easily available
                // across notes. So, let's just make it quickly snap/animate to the target.
                return [{ targetRotation: [targetRotX, targetRotY, targetRotZ] }];
            })
            .applyADSR((noteCtx: NoteContext) => ({ // Very short envelope for appearance
                attack: this.getPropertyValue<number>('attack') ?? 0.01,
                decay: this.getPropertyValue<number>('decay') ?? 0.05,
                sustain: this.getPropertyValue<number>('sustain') ?? 0,
                release: this.getPropertyValue<number>('release') ?? 0.05,
            }))
            .withPosition((ctx: MappingContext) => {
                const x = this.getPropertyValue<number>('positionX') ?? 0;
                const y = this.getPropertyValue<number>('positionY') ?? 2;
                const z = this.getPropertyValue<number>('positionZ') ?? 0;
                return [x, y, z];
            })
            .withScale((ctx: MappingContext) => {
                return this.getPropertyValue<number>('baseSize') ?? 0.5;
            })
            .withRotation((ctx: MappingContext) => {
                const targetRot = ctx.instanceData.targetRotation as [number, number, number];
                const speed = this.getPropertyValue<number>('rotationSpeed') ?? 5;
                const adsrProgress = MUtils.mapValue(ctx.adsrAmplitude ?? 0, 0, 1, 0, 1); // Simple lerp factor

                // Animate towards the target rotation based on ADSR progress
                // This is a simple approach; ideal lerping needs previous state.
                // For a shaker, maybe just instantly snap based on phase?
                if (ctx.adsrPhase === 'attack' || ctx.adsrPhase === 'decay') {
                    // Simple quick lerp towards target during attack/decay
                    // A proper quaternion slerp would be smoother but much more complex here.
                    const lerpFactor = Math.min(1, ctx.timeSinceNoteStart * speed * 5); // Faster lerp
                    // Lerping Euler angles is tricky, results may not be ideal. Snapping might be better visually.
                     return targetRot; // Just snap for simplicity
                } else {
                    // Stay at target during sustain/release (if sustain > 0)
                    // Since sustain is 0, it effectively disappears after decay.
                    return targetRot; // Keep target rotation
                }
            })
            .withColor((ctx: MappingContext) => {
                 const pitchMod12 = ctx.note.pitch % 12;
                 const hue = MUtils.mapValue(pitchMod12, 0, 11, 0, 360);
                 return `hsl(${hue.toFixed(0)}, 70%, 60%)`;
            })
            .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0);
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new ShakerSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default ShakerSynth; 