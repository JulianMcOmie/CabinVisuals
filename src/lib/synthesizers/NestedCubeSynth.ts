import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, InstanceData } from '../VisualObjectEngine';

class NestedCubeSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['baseSize', new Property<number>('baseSize', 1.5, { uiType: 'slider', label: 'Base Size', min: 0.2, max: 5, step: 0.1 })],
            ['childScale', new Property<number>('childScale', 0.2, { uiType: 'slider', label: 'Child Scale', min: 0.05, max: 0.8, step: 0.01 })],
            ['childSpinSpeedScale', new Property<number>('childSpinSpeedScale', 30, { // Degrees per second per note (0-11)
                uiType: 'slider', label: 'Child Spin/Note', min: 0, max: 180, step: 5
            })],
            ['attack', new Property<number>('attack', 0.1, { uiType: 'slider', label: 'Attack (s)', min: 0.001, max: 1, step: 0.001 })],
            ['decay', new Property<number>('decay', 0.4, { uiType: 'slider', label: 'Decay (s)', min: 0.01, max: 2, step: 0.01 })],
            ['sustain', new Property<number>('sustain', 0.7, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 0.6, { uiType: 'slider', label: 'Release (s)', min: 0.01, max: 3, step: 0.01 })],
            // Add separate ADSR for children?
            ['childAttack', new Property<number>('childAttack', 0.2, { uiType: 'slider', label: 'Child Attack', min: 0.001, max: 1, step: 0.001 })],
            ['childRelease', new Property<number>('childRelease', 0.5, { uiType: 'slider', label: 'Child Release', min: 0.01, max: 2, step: 0.01 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        // --- Parent Cube Definition (Level 1) ---
        this.engine.defineObject('cube')
            .applyADSR((noteCtx: NoteContext) => ({ // Parent ADSR
                attack: this.getPropertyValue<number>('attack') ?? 0.1,
                decay: this.getPropertyValue<number>('decay') ?? 0.4,
                sustain: this.getPropertyValue<number>('sustain') ?? 0.7,
                release: this.getPropertyValue<number>('release') ?? 0.6,
            }))
            .withPosition((ctx: MappingContext) => {
                // Parent cube position based on pitch
                const y = MUtils.mapPitchToRange(ctx.note.pitch, -5, 5);
                return [0, y, 0]; // Center X, Z
            })
            .withScale((ctx: MappingContext) => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 1.5;
                const amplitude = ctx.adsrAmplitude ?? 0;
                return baseSize * amplitude * (ctx.note.velocity / 127);
            })
            .withColor((ctx: MappingContext) => {
                 // Parent color based on pitch (cycle hue)
                 return MUtils.mapPitchToHSL(ctx.note.pitch, 80, 60);
            })
            .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0)

            // --- Child Cube Definition (Level 2) ---
            .applyADSR((noteCtx: NoteContext) => ({ // *Child* ADSR - different timings
                attack: this.getPropertyValue<number>('childAttack') ?? 0.2,
                decay: this.getPropertyValue<number>('decay') ?? 0.4, // Share decay/sustain for simplicity
                sustain: this.getPropertyValue<number>('sustain') ?? 0.7,
                release: this.getPropertyValue<number>('childRelease') ?? 0.5,
            }))
            .forEachInstance((parentCtx: MappingContext) => {
                // Generate data for 8 child cubes, positioned at parent corners
                const parentScale = parentCtx.calculatedProperties?.scale ?? [1, 1, 1];
                // Handle if parent scale is a single number
                const parentScaleVec = typeof parentScale === 'number' ? [parentScale, parentScale, parentScale] : parentScale;
                const halfScale = [parentScaleVec[0] / 2, parentScaleVec[1] / 2, parentScaleVec[2] / 2];
                const instances: InstanceData[] = [];
                const corners = [
                    [ halfScale[0],  halfScale[1],  halfScale[2]], [-halfScale[0],  halfScale[1],  halfScale[2]],
                    [ halfScale[0], -halfScale[1],  halfScale[2]], [-halfScale[0], -halfScale[1],  halfScale[2]],
                    [ halfScale[0],  halfScale[1], -halfScale[2]], [-halfScale[0],  halfScale[1], -halfScale[2]],
                    [ halfScale[0], -halfScale[1], -halfScale[2]], [-halfScale[0], -halfScale[1], -halfScale[2]],
                ];
                corners.forEach((cornerOffset, index) => {
                    instances.push({ cornerIndex: index, offset: cornerOffset });
                });
                return instances;
            })
            .setType('box') // Use 'box' for potentially different look
            .withPosition((ctx: MappingContext) => {
                // Child position is relative to parent's *calculated* position + offset
                const parentPos = ctx.parentContext?.calculatedProperties?.position ?? [0, 0, 0];
                const offset = ctx.instanceData.offset as [number, number, number];
                return [parentPos[0] + offset[0], parentPos[1] + offset[1], parentPos[2] + offset[2]];
            })
            .withScale((ctx: MappingContext) => {
                // Child scale depends on parent scale and childScale property
                const parentScale = ctx.parentContext?.calculatedProperties?.scale ?? [1, 1, 1];
                const parentScaleVec = typeof parentScale === 'number' ? [parentScale, parentScale, parentScale] : parentScale;
                const childScaleFactor = this.getPropertyValue<number>('childScale') ?? 0.2;
                const amplitude = ctx.adsrAmplitude ?? 0; // Use child ADSR amplitude

                // Calculate base child size relative to parent
                const childBase = parentScaleVec[0] * childScaleFactor; // Assume uniform parent scaling for simplicity here

                return childBase * amplitude; // Child size fades with its own ADSR
            })
            .withRotation((ctx: MappingContext) => {
                const noteMod12 = ctx.note.pitch % 12; // 0-11
                const spinSpeedScale = this.getPropertyValue<number>('childSpinSpeedScale') ?? 30;
                const spinSpeed = noteMod12 * spinSpeedScale; // Higher notes spin faster (degrees/sec)
                const rotation = ctx.timeSinceNoteStart * spinSpeed; // Continuous rotation
                // Apply rotation differently based on corner index for variety
                switch (ctx.instanceData.cornerIndex % 3) {
                    case 0: return [rotation, 0, 0];
                    case 1: return [0, rotation, 0];
                    default: return [0, 0, rotation];
                }
            })
            .withColor((ctx: MappingContext) => {
                 // Child color contrasts with parent, affected by child ADSR
                 const parentColor = ctx.parentContext?.calculatedProperties?.color ?? 'hsl(0, 0%, 100%)';
                 // Basic parsing of HSL (improve with regex if needed)
                 const match = parentColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
                 let hue = 180;
                 if (match) {
                     hue = (parseInt(match[1]) + 180) % 360; // Opposite hue
                 }
                 const saturation = 85;
                 const lightness = MUtils.mapValue(ctx.adsrAmplitude ?? 0, 0, 1, 40, 70); // Child brightness fades
                 return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness.toFixed(0)}%)`;
            })
            .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0); // Child opacity uses child ADSR
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new NestedCubeSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default NestedCubeSynth; 