import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class PitchSphereSynth extends Synthesizer {
    // Temporary storage for min/max pitch during getObjectsAtTime call
    private _minPitch: number = 0;
    private _maxPitch: number = 127;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['minY', new Property<number>('minY', 0, { uiType: 'slider', label: 'Min Y Position', min: -10, max: 10, step: 0.1 })],
            ['maxY', new Property<number>('maxY', 5, { uiType: 'slider', label: 'Max Y Position', min: -10, max: 10, step: 0.1 })],
            ['size', new Property<number>('size', 0.5, { uiType: 'slider', label: 'Sphere Size', min: 0.05, max: 5, step: 0.05 })],
            ['color', new Property<string>('color', '#ffffff', { uiType: 'color', label: 'Color' })],
            // ADSR for opacity
            ['attack', new Property<number>('attack', 0.1, { uiType: 'slider', label: 'Fade In (s)', min: 0.01, max: 2, step: 0.01 })],
            ['decay', new Property<number>('decay', 0.0, { uiType: 'slider', label: 'Decay (s)', min: 0.0, max: 2, step: 0.01 })],
            ['sustain', new Property<number>('sustain', 1.0, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 0.5, { uiType: 'slider', label: 'Fade Out (s)', min: 0.1, max: 5, step: 0.1 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('sphere')
            .applyADSR((noteCtx: NoteContext) => ({
                attack: this.getPropertyValue<number>('attack') ?? 0.1,
                decay: this.getPropertyValue<number>('decay') ?? 0.0,
                sustain: this.getPropertyValue<number>('sustain') ?? 1.0,
                release: this.getPropertyValue<number>('release') ?? 0.5,
            }))
            .withPosition((ctx: MappingContext) => {
                const minY = this.getPropertyValue<number>('minY') ?? 0;
                const maxY = this.getPropertyValue<number>('maxY') ?? 5;

                // Map pitch to Y position using the pre-calculated min/max pitch for the current block set
                // Clamp the value to ensure it stays within minY/maxY even if min/max pitch are the same
                const yPos = MUtils.mapValue(ctx.note.pitch, this._minPitch, this._maxPitch, minY, maxY, true);

                return [0, yPos, 0]; // X and Z position are static
            })
            .withScale((ctx: MappingContext) => {
                return this.getPropertyValue<number>('size') ?? 0.5;
            })
            .withColor((ctx: MappingContext) => {
                return this.getPropertyValue<string>('color') ?? '#ffffff';
            })
            .withOpacity((ctx: MappingContext) => {
                // Use ADSR amplitude for opacity
                return ctx.adsrAmplitude ?? 0;
            });
    }

    // Override to calculate min/max pitch before engine processing
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        let minPitch = 127;
        let maxPitch = 0;
        let hasNotes = false;

        midiBlocks.forEach(block => {
            block.notes.forEach(note => {
                hasNotes = true;
                minPitch = Math.min(minPitch, note.pitch);
                maxPitch = Math.max(maxPitch, note.pitch);
            });
        });

        // Handle edge case where min and max are the same (or no notes)
        if (!hasNotes || minPitch === maxPitch) {
            // Use a default range or adjust logic as needed
            this._minPitch = minPitch; // Set to the single pitch found
            this._maxPitch = minPitch + 1; // Avoid division by zero in mapValue
        } else {
            this._minPitch = minPitch;
            this._maxPitch = maxPitch;
        }

        // Now call the engine, which will use the stored _minPitch and _maxPitch in the mappers
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new PitchSphereSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        // Ensure min/max pitch are reset on clone if needed, though they are recalculated anyway
        cloned._minPitch = this._minPitch;
        cloned._maxPitch = this._maxPitch;
        return cloned;
    }
}

export default PitchSphereSynth; 