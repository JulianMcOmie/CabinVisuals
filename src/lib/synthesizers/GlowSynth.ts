import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, ColorRange, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class GlowSynth extends Synthesizer {
    private _minPitch: number | null = null;
    private _maxPitch: number | null = null;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    clone(): this {
        const cloned = new GlowSynth() as this;
        this.properties.forEach((prop, key) => {
            cloned.setPropertyValue(key, prop.value);
        });
        return cloned;
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        if (midiBlocks.length === 0) {
            this._minPitch = null;
            this._maxPitch = null;
            return [];
        } else {
             let minP = midiBlocks[0].notes[0]?.pitch ?? null;
             let maxP = minP;
             midiBlocks.forEach(block => {
                 block.notes.forEach(note => {
                     if (minP === null || note.pitch < minP) minP = note.pitch;
                     if (maxP === null || note.pitch > maxP) maxP = note.pitch;
                 });
             });
             this._minPitch = minP;
             this._maxPitch = maxP;
        }

        const baseObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);

        const processedObjects = baseObjects.map(obj => {
            if (!obj.properties || obj.properties.opacity === undefined || !obj.properties.color) {
                return obj;
            }

            const baseIntensity = this.getPropertyValue<number>('glowIntensity') ?? 1.0;
            const intensity = baseIntensity * obj.properties.opacity;

            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    emissive: obj.properties.color,
                    emissiveIntensity: intensity > 0.01 ? intensity : 0
                }
            };
        });

        return processedObjects;
    }

    private initializeProperties(): void {
        this.properties.set('ySpread', new Property<number>(
            'ySpread',
            3.0,
            { label: 'Y Spread', uiType: 'slider', min: 0, max: 10, step: 0.1 }
        ));
        this.properties.set('glowIntensity', new Property<number>(
            'glowIntensity',
            1.0,
            { label: 'Glow Intensity', uiType: 'slider', min: 0, max: 5, step: 0.1 }
        ));
         this.properties.set('baseSize', new Property<number>(
            'baseSize',
            1.5,
            { label: 'Base Size', uiType: 'slider', min: 0.1, max: 5, step: 0.05 }
        ));
        this.properties.set('expansionRate', new Property<number>(
            'expansionRate',
            2.0,
            { label: 'Expansion Rate', uiType: 'slider', min: 0.0, max: 10.0, step: 0.1 }
        ));
        this.properties.set('hueRange', new Property<ColorRange>(
            'hueRange',
            { startHue: 180, endHue: 300 },
            { label: 'Hue Range (Note)', uiType: 'colorRange' }
        ));
        this.properties.set('attack', new Property<number>(
            'attack',
            0.01,
            { label: 'Attack (s)', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('decay', new Property<number>(
            'decay',
            0.5,
            { label: 'Decay (s)', uiType: 'slider', min: 0.0, max: 2.0, step: 0.01 }
        ));
        this.properties.set('sustain', new Property<number>(
            'sustain',
            0.2,
            { label: 'Sustain Level', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('release', new Property<number>(
            'release',
            1.0,
            { label: 'Release (s)', uiType: 'slider', min: 0.0, max: 5.0, step: 0.01 }
        ));
    }

    private initializeEngine(): void {
        this.engine.defineObject('sphere')
            .withPosition((ctx: MappingContext) => {
                const ySpread = this.getPropertyValue<number>('ySpread') ?? 3.0;
                let yPos = 0;
                
                if (this._minPitch !== null && this._maxPitch !== null && this._minPitch !== this._maxPitch) {
                    const pitch = ctx.note.pitch;
                    const minPitch = this._minPitch;
                    const maxPitch = this._maxPitch;
                    const normalizedPitch = (pitch - minPitch) / (maxPitch - minPitch);
                    yPos = -ySpread + normalizedPitch * (ySpread - (-ySpread));
                } else if (this._minPitch !== null) {
                    yPos = 0;
                }
                yPos = Math.max(-ySpread, Math.min(ySpread, yPos));
                
                return [0, yPos, 0];
            })
            .withScale((ctx: MappingContext) => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 1.5;
                const expansionRate = this.getPropertyValue<number>('expansionRate') ?? 2.0;
                const currentSize = baseSize + expansionRate * ctx.timeSinceNoteStart;
                const finalSize = Math.max(0.01, currentSize);
                return [finalSize, finalSize, finalSize];
            })
            .withColor((ctx: MappingContext) => {
                const range = this.getPropertyValue<ColorRange>('hueRange') ?? { startHue: 180, endHue: 300 };
                const pitchClass = ctx.note.pitch % 12;
                const normalizedPitchClass = pitchClass / 11;

                let hue: number;
                const rangeSize = range.endHue - range.startHue;

                if (rangeSize >= 0) {
                    hue = range.startHue + normalizedPitchClass * rangeSize;
                } else {
                    const wrappedRangeSize = 360 + rangeSize;
                    hue = range.startHue + normalizedPitchClass * wrappedRangeSize;
                }

                hue = ((hue % 360) + 360) % 360;

                const saturation = 100;
                const lightness = 50;
                return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness}%)`;
            })
            .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0)
            .applyADSR((noteCtx: NoteContext) => ({ 
                attack: this.getPropertyValue<number>('attack') ?? 0.01,
                decay: this.getPropertyValue<number>('decay') ?? 0.5,
                sustain: this.getPropertyValue<number>('sustain') ?? 0.2,
                release: this.getPropertyValue<number>('release') ?? 1.0,
             }));
    }
}

export default GlowSynth; 