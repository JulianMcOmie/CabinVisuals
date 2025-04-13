import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, InstanceData } from '../VisualObjectEngine';

class RadialVibratingSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['minCopies', new Property<number>('minCopies', 2, { uiType: 'numberInput', label: 'Min Radial Copies', min: 1, max: 12, step: 1 })],
            ['maxRadius', new Property<number>('maxRadius', 5, { uiType: 'slider', label: 'Max Radius', min: 1, max: 15, step: 0.5 })],
            ['vibrationAmplitude', new Property<number>('vibrationAmplitude', 0.3, { uiType: 'slider', label: 'Vibration Amplitude', min: 0, max: 2, step: 0.05 })],
            ['vibrationFrequency', new Property<number>('vibrationFrequency', 1, { uiType: 'slider', label: 'Vibration Freq (cycles/beat)', min: 0.1, max: 8, step: 0.1 })],
            ['spinSpeed', new Property<number>('spinSpeed', 45, { uiType: 'slider', label: 'Spin Speed (°/s)', min: 0, max: 360, step: 5 })],
            ['baseSize', new Property<number>('baseSize', 0.4, { uiType: 'slider', label: 'Cube Size', min: 0.1, max: 2, step: 0.05 })],
            ['attack', new Property<number>('attack', 0.3, { uiType: 'slider', label: 'Expand Time (s)', min: 0.01, max: 3, step: 0.01 })],
            ['decay', new Property<number>('decay', 0.1, { uiType: 'slider', label: 'Settle Time (s)', min: 0.01, max: 1, step: 0.01 })], // Short decay to reach maxRadius quickly
            ['sustain', new Property<number>('sustain', 1.0, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })], // Sustain at 1 for full radius during hold
            ['release', new Property<number>('release', 0.8, { uiType: 'slider', label: 'Collapse Time (s)', min: 0.1, max: 4, step: 0.05 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('cube')
            // Level 1: Generate radial copies based on pitch
            .forEachInstance((parentCtx: MappingContext) => {
                const noteMod12 = parentCtx.note.pitch % 12; // 0-11
                const minCopies = this.getPropertyValue<number>('minCopies') ?? 2;
                const numCopies = minCopies + noteMod12;
                const instances: InstanceData[] = [];
                const angleStep = (2 * Math.PI) / numCopies; // Angle in radians

                for (let i = 0; i < numCopies; i++) {
                    instances.push({ radialIndex: i, angleRadians: i * angleStep });
                }
                return instances;
            })
            .applyADSR((noteCtx: NoteContext) => ({
                attack: this.getPropertyValue<number>('attack') ?? 0.3,
                decay: this.getPropertyValue<number>('decay') ?? 0.1,
                sustain: this.getPropertyValue<number>('sustain') ?? 1.0,
                release: this.getPropertyValue<number>('release') ?? 0.8,
            }))
            // Configure the radial cubes (Level 1 instances)
            .withPosition((ctx: MappingContext) => {
                const maxRadius = this.getPropertyValue<number>('maxRadius') ?? 5;
                const vibrationAmplitude = this.getPropertyValue<number>('vibrationAmplitude') ?? 0.3;
                const vibrationFrequency = this.getPropertyValue<number>('vibrationFrequency') ?? 1;
                const angleRadians = ctx.instanceData.angleRadians as number;

                let currentRadius = 0;

                // Determine radius based on ADSR phase
                if (ctx.adsrPhase === 'attack' || ctx.adsrPhase === 'decay') {
                    // Move outwards based on amplitude progress towards sustain level (which is 1)
                    currentRadius = (ctx.adsrAmplitude ?? 0) * maxRadius;
                } else if (ctx.adsrPhase === 'sustain') {
                    // Vibrate around maxRadius based on the beat (time)
                    const beatPhase = (ctx.time * vibrationFrequency) * (2 * Math.PI);
                    const vibrationOffset = Math.sin(beatPhase) * vibrationAmplitude;
                    currentRadius = maxRadius + vibrationOffset;
                } else if (ctx.adsrPhase === 'release') {
                    // Collapse inwards based on amplitude (which goes from sustain level to 0)
                    currentRadius = (ctx.adsrAmplitude ?? 0) * maxRadius;
                } else { // idle
                    currentRadius = 0;
                }

                const x = currentRadius * Math.cos(angleRadians);
                const y = currentRadius * Math.sin(angleRadians);
                const z = 0;

                return [x, y, z];
            })
            .withScale((ctx: MappingContext) => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 0.4;
                // Scale slightly based on ADSR, but mostly constant during sustain/release
                const amplitude = ctx.adsrAmplitude ?? 0;
                // Let's keep size relatively constant once expanded
                 const sizeFactor = (ctx.adsrPhase === 'attack' || ctx.adsrPhase === 'decay') ? amplitude : (ctx.adsrPhase === 'sustain' ? 1.0 : amplitude); // Keep size 1 during sustain, shrink during release
                return baseSize * sizeFactor;
            })
            .withRotation((ctx: MappingContext) => {
                const angleRadians = ctx.instanceData.angleRadians as number;
                const spinSpeed = this.getPropertyValue<number>('spinSpeed') ?? 45;

                // 1. Static rotation to face outwards (rotate around Y)
                const radialYRotationDegrees = -angleRadians * (180 / Math.PI);

                // 2. Dynamic spin (e.g., around local Y axis, which is world Y before radial rotation)
                const spinRotation = ctx.timeSinceNoteStart * spinSpeed;

                // Combine: First apply spin, then radial orientation.
                // Or simpler: just add spin to the radial Y rotation.
                return [0, radialYRotationDegrees + spinRotation, 0];
            })
            .withColor((ctx: MappingContext) => {
                const noteMod12 = ctx.note.pitch % 12;
                const hue = MUtils.mapValue(noteMod12, 0, 11, 0, 360); // Full hue range mapped to octave
                const saturation = 85;
                const lightness = MUtils.mapValue(ctx.adsrAmplitude ?? 0, 0, 1, 30, 70); // Fade brightness with envelope
                return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness.toFixed(0)}%)`;
            })
            .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0);
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new RadialVibratingSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default RadialVibratingSynth; 