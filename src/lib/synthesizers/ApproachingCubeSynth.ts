import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class ApproachingCubeSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['baseSize', new Property<number>('baseSize', 0.8, { uiType: 'slider', label: 'Cube Size', min: 0.1, max: 4, step: 0.05 })],
            ['travelSpeed', new Property<number>('travelSpeed', 4, { uiType: 'slider', label: 'Travel Speed (Z)', min: 0.5, max: 15, step: 0.1 })],
            ['spreadSpeed', new Property<number>('spreadSpeed', 1.5, { uiType: 'slider', label: 'Spread Speed (XY)', min: 0, max: 10, step: 0.1 })],
            ['spinSpeed', new Property<number>('spinSpeed', 180, { uiType: 'slider', label: 'Spin Speed (°/s)', min: 10, max: 720, step: 10 })],
            ['quantizeSteps', new Property<number>('quantizeSteps', 8, { uiType: 'numberInput', label: 'Spin Quantize Steps', min: 2, max: 32, step: 1 })],
            // ADSR for fade out
            ['attack', new Property<number>('attack', 0.1, { uiType: 'slider', label: 'Fade In (s)', min: 0.01, max: 1, step: 0.01 })],
            ['decay', new Property<number>('decay', 0.0, { uiType: 'slider', label: 'Decay (s)', min: 0.0, max: 1, step: 0.01 })],
            ['sustain', new Property<number>('sustain', 1.0, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 2.0, { uiType: 'slider', label: 'Fade Out (s)', min: 0.1, max: 10, step: 0.1 })], // Long release
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('cube')
            .forEachInstance((ctx: MappingContext) => {
                // Calculate target direction angle based on pitch
                const pitchMod12 = ctx.note.pitch % 12;
                const targetAngle = MUtils.mapValue(pitchMod12, 0, 11, 0, 2 * Math.PI); // Map 0-11 to 0-360 degrees
                return [{
                    directionX: Math.cos(targetAngle),
                    directionY: Math.sin(targetAngle),
                }];
            })
            .applyADSR((noteCtx: NoteContext) => ({ // Long release for fade out
                attack: this.getPropertyValue<number>('attack') ?? 0.1,
                decay: this.getPropertyValue<number>('decay') ?? 0.0,
                sustain: this.getPropertyValue<number>('sustain') ?? 1.0,
                release: this.getPropertyValue<number>('release') ?? 2.0,
            }))
            .withPosition((ctx: MappingContext) => {
                const travelSpeed = this.getPropertyValue<number>('travelSpeed') ?? 4;
                const spreadSpeed = this.getPropertyValue<number>('spreadSpeed') ?? 1.5;
                const dirX = ctx.instanceData.directionX as number;
                const dirY = ctx.instanceData.directionY as number;
                const time = ctx.timeSinceNoteStart;

                // Calculate position based on time and direction/speed
                const xPos = dirX * spreadSpeed * time;
                const yPos = dirY * spreadSpeed * time;
                const zPos = travelSpeed * time;

                return [xPos, yPos, zPos];
            })
            .withScale((ctx: MappingContext) => {
                // Constant size, fade handled by opacity
                return this.getPropertyValue<number>('baseSize') ?? 0.8;
            })
            .withRotation((ctx: MappingContext) => {
                const spinSpeed = this.getPropertyValue<number>('spinSpeed') ?? 180;
                const quantizeSteps = Math.max(2, this.getPropertyValue<number>('quantizeSteps') ?? 8);
                const anglePerStep = 360 / quantizeSteps;

                // Calculate base angle
                const baseAngle = ctx.timeSinceNoteStart * spinSpeed;

                // Quantize the angle
                const quantizedAngle = Math.floor(baseAngle / anglePerStep) * anglePerStep;

                // Apply to multiple axes for more complex spin
                return [quantizedAngle * 0.7, quantizedAngle, quantizedAngle * 0.5];
            })
            .withColor((ctx: MappingContext) => {
                const pitchMod12 = ctx.note.pitch % 12;
                const hue = MUtils.mapValue(pitchMod12, 0, 11, 0, 360);
                const saturation = 80;
                const lightness = 65;
                return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness}%)`;
            })
            .withOpacity((ctx: MappingContext) => {
                // Fade out using ADSR
                return ctx.adsrAmplitude ?? 0;
            });
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new ApproachingCubeSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default ApproachingCubeSynth; 