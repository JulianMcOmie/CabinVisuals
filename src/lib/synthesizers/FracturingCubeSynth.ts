import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, InstanceData } from '../VisualObjectEngine';

type Vec3 = [number, number, number];

class FracturingCubeSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['baseSize', new Property<number>('baseSize', 2, { uiType: 'slider', label: 'Overall Size', min: 0.5, max: 10, step: 0.1 })],
            ['maxSeparation', new Property<number>('maxSeparation', 0.5, { uiType: 'slider', label: 'Max Separation', min: 0, max: 3, step: 0.05 })],
            ['spinSpeed', new Property<number>('spinSpeed', 15, { uiType: 'slider', label: 'Spin Speed (°/s)', min: 0, max: 180, step: 5 })],
            ['colorVariance', new Property<number>('colorVariance', 30, { uiType: 'slider', label: 'Color Variance (Hue°)', min: 0, max: 90, step: 1 })],
            // ADSR controls separation/rejoining timing
            ['attack', new Property<number>('attack', 0.4, { uiType: 'slider', label: 'Separation Time (s)', min: 0.01, max: 3, step: 0.01 })],
            ['decay', new Property<number>('decay', 0.1, { uiType: 'slider', label: 'Settle Time (s)', min: 0.01, max: 1, step: 0.01 })], // Fast decay to reach full separation
            ['sustain', new Property<number>('sustain', 1.0, { uiType: 'slider', label: 'Sustain (Keep Separated)', min: 0, max: 1, step: 0.01 })], // Must be 1
            ['release', new Property<number>('release', 0.6, { uiType: 'slider', label: 'Rejoin Time (s)', min: 0.1, max: 4, step: 0.05 })],
        ]);
    }

    // Helper to generate sub-cube data based on pitch
    private getFracturePattern(pitchMod12: number): { relativeSize: Vec3, relativeOffset: Vec3 }[] {
        const patterns: { divisions: Vec3, patternId: number }[] = [
            { divisions: [1, 1, 1], patternId: 0 }, // 0
            { divisions: [2, 1, 1], patternId: 1 }, // 1
            { divisions: [1, 2, 1], patternId: 2 }, // 2
            { divisions: [1, 1, 2], patternId: 3 }, // 3
            { divisions: [2, 2, 1], patternId: 4 }, // 4
            { divisions: [2, 1, 2], patternId: 5 }, // 5
            { divisions: [1, 2, 2], patternId: 6 }, // 6
            { divisions: [3, 1, 1], patternId: 7 }, // 7
            { divisions: [1, 3, 1], patternId: 8 }, // 8
            { divisions: [1, 1, 3], patternId: 9 }, // 9
            { divisions: [2, 2, 2], patternId: 10 }, // 10
            { divisions: [4, 1, 1], patternId: 11 }, // 11
        ];
        const { divisions } = patterns[pitchMod12];
        const subCubes: { relativeSize: Vec3, relativeOffset: Vec3 }[] = [];
        const [divX, divY, divZ] = divisions;
        const relSize: Vec3 = [1 / divX, 1 / divY, 1 / divZ];

        for (let i = 0; i < divX; i++) {
            for (let j = 0; j < divY; j++) {
                for (let k = 0; k < divZ; k++) {
                    // Calculate center of this sub-cube relative to the parent cube's center (range -0.5 to 0.5)
                    const offsetX = (i + 0.5) / divX - 0.5;
                    const offsetY = (j + 0.5) / divY - 0.5;
                    const offsetZ = (k + 0.5) / divZ - 0.5;
                    subCubes.push({ relativeSize: relSize, relativeOffset: [offsetX, offsetY, offsetZ] });
                }
            }
        }
        return subCubes;
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('cube')
             // Level 1: Generate sub-cubes based on pitch
            .forEachInstance((parentCtx: MappingContext) => {
                const pitchMod12 = parentCtx.note.pitch % 12;
                const subCubeDefs = this.getFracturePattern(pitchMod12);
                const instances: InstanceData[] = [];
                subCubeDefs.forEach((def, index) => {
                    instances.push({
                        subCubeIndex: index,
                        totalSubCubes: subCubeDefs.length,
                        relativeSize: def.relativeSize,
                        relativeOffset: def.relativeOffset,
                     });
                });
                return instances;
            })
            .applyADSR((noteCtx: NoteContext) => ({ // ADSR controls separation amount
                attack: this.getPropertyValue<number>('attack') ?? 0.4,
                decay: this.getPropertyValue<number>('decay') ?? 0.1,
                sustain: 1.0, // Sustain must be 1 for separation logic
                release: this.getPropertyValue<number>('release') ?? 0.6,
            }))
            // Configure the sub-cubes
            .withPosition((ctx: MappingContext) => {
                const maxSeparation = this.getPropertyValue<number>('maxSeparation') ?? 0.5;
                const relativeOffset = ctx.instanceData.relativeOffset as Vec3;

                // ADSR amplitude (0->1->0) determines the separation factor
                const separationFactor = (ctx.adsrAmplitude ?? 0) * maxSeparation;

                // The actual offset is the relative offset scaled by separation
                const actualOffset: Vec3 = [
                    relativeOffset[0] * separationFactor,
                    relativeOffset[1] * separationFactor,
                    relativeOffset[2] * separationFactor
                ];

                // Base position (can be adjusted if needed)
                const basePosition: Vec3 = [0, 0, 0];

                return [
                    basePosition[0] + actualOffset[0],
                    basePosition[1] + actualOffset[1],
                    basePosition[2] + actualOffset[2]
                ];
            })
            .withScale((ctx: MappingContext) => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 2;
                const relativeSize = ctx.instanceData.relativeSize as Vec3;
                // Scale is constant, determined by base size and relative fraction
                return [
                    relativeSize[0] * baseSize,
                    relativeSize[1] * baseSize,
                    relativeSize[2] * baseSize
                 ];
            })
            .withRotation((ctx: MappingContext) => {
                const spinSpeed = this.getPropertyValue<number>('spinSpeed') ?? 15;
                const rotation = ctx.timeSinceNoteStart * spinSpeed;
                // Rotate sub-cubes differently based on index for visual interest
                const idx = ctx.instanceData.subCubeIndex as number;
                switch (idx % 3) {
                    case 0: return [rotation, 0, 0];
                    case 1: return [0, rotation, 0];
                    default: return [0, 0, rotation];
                }
            })
            .withColor((ctx: MappingContext) => {
                const colorVariance = this.getPropertyValue<number>('colorVariance') ?? 30;
                const pitchMod12 = ctx.note.pitch % 12;
                const baseHue = MUtils.mapValue(pitchMod12, 0, 11, 0, 360); // Base hue from pitch
                // Vary hue slightly per sub-cube
                const hueShift = MUtils.mapValue(ctx.instanceData.subCubeIndex, 0, ctx.instanceData.totalSubCubes -1, -colorVariance / 2, colorVariance / 2);
                const hue = (baseHue + hueShift + 360) % 360;
                const saturation = 75;
                const lightness = 65;
                return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness}%)`;
            })
            // Opacity is constant, not affected by ADSR
            .withOpacity((ctx: MappingContext) => {
                 // Return 1 if ADSR is active (attack, decay, sustain, release), 0 if idle
                return (ctx.adsrPhase && ctx.adsrPhase !== 'idle') ? 1.0 : 0.0;
            });
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new FracturingCubeSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default FracturingCubeSynth; 