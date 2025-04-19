import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils } from '../VisualObjectEngine';

class ReverseKickEngineSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this); // Use the engine
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['preHitDuration', new Property<number>('preHitDuration', 0.5, { uiType: 'slider', label: 'Pre-Hit Time (s)', min: 0.05, max: 2, step: 0.01 })],
            ['maxSize', new Property<number>('maxSize', 4.0, { uiType: 'slider', label: 'Max Size', min: 0.5, max: 10, step: 0.1 })],
            ['positionX', new Property<number>('positionX', 0, { uiType: 'slider', label: 'X Position', min: -10, max: 10, step: 0.1 })],
            ['positionY', new Property<number>('positionY', -3, { uiType: 'slider', label: 'Y Position', min: -10, max: 10, step: 0.1 })],
            ['positionZ', new Property<number>('positionZ', 0, { uiType: 'slider', label: 'Z Position', min: -10, max: 10, step: 0.1 })],
            ['color', new Property<string>('color', '#8800cc', { uiType: 'color', label: 'Color' })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('sphere')
            .withPosition((ctx: MappingContext) => {
                const posX = this.getPropertyValue<number>('positionX') ?? 0;
                const posY = this.getPropertyValue<number>('positionY') ?? 0;
                const posZ = this.getPropertyValue<number>('positionZ') ?? 0;
                return [posX, posY, posZ];
            })
            .withScale((ctx: MappingContext) => {
                const preHitDuration = this.getPropertyValue<number>('preHitDuration') ?? 0.5;
                const maxSize = this.getPropertyValue<number>('maxSize') ?? 4.0;
                const secondsPerBeat = 60 / ctx.bpm;
                const currentTimeSeconds = ctx.time * secondsPerBeat;
                const noteStartTimeSeconds = ctx.noteAbsoluteStartBeat * secondsPerBeat;
                const timeUntilNoteStartSeconds = noteStartTimeSeconds - currentTimeSeconds;

                if (preHitDuration <= 0) return 0; // Safety check

                // Is current time within the pre-hit window?
                if (timeUntilNoteStartSeconds > 0 && timeUntilNoteStartSeconds <= preHitDuration) {
                    const progress = timeUntilNoteStartSeconds / preHitDuration; // 1 down to 0
                    return Math.max(0, maxSize * progress); // Linear scale down
                } else {
                    return 0; // Scale is 0 if not in pre-hit window or after note start
                }
            })
            .withColor((ctx: MappingContext) => {
                return this.getPropertyValue<string>('color') ?? '#8800cc';
            })
            .withOpacity((ctx: MappingContext) => {
                const preHitDuration = this.getPropertyValue<number>('preHitDuration') ?? 0.5;
                const secondsPerBeat = 60 / ctx.bpm;
                const currentTimeSeconds = ctx.time * secondsPerBeat;
                const noteStartTimeSeconds = ctx.noteAbsoluteStartBeat * secondsPerBeat;
                const timeUntilNoteStartSeconds = noteStartTimeSeconds - currentTimeSeconds;

                 if (preHitDuration <= 0) return 0; // Safety check

                // Is current time within the pre-hit window?
                if (timeUntilNoteStartSeconds > 0 && timeUntilNoteStartSeconds <= preHitDuration) {
                    return 1; // Fully opaque during pre-hit
                } else {
                    return 0; // Fully transparent otherwise
                }
            });
            // NO .applyADSR() or .applyPhysicsEnvelope()
    }

    // Standard getObjectsAtTime using the engine
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    // Standard clone method
    clone(): this {
        const cloned = new ReverseKickEngineSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default ReverseKickEngineSynth; 