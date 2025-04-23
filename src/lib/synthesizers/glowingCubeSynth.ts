import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, ColorRange } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, NoteContext, MappingUtils } from '../VisualObjectEngine';

class GlowingCubeSynth extends Synthesizer {
    private _minPitch: number | null = null;
    private _maxPitch: number | null = null;
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    clone(): this {
        const cloned = new GlowingCubeSynth() as this;
        this.properties.forEach((prop, key) => {
            const originalProp = this.properties.get(key);
            if (originalProp) {
                cloned.setPropertyValue(key, originalProp.value);
            }
        });
        return cloned;
    }

    private initializeProperties(): void {
        this.properties.set('glowIntensity', new Property<number>(
            'glowIntensity', 1.5, { label: 'Glow Intensity', uiType: 'slider', min: 0, max: 5, step: 0.1 }
        ));
        this.properties.set('approachSpeed', new Property<number>(
            'approachSpeed', 20.0, { label: 'Approach Speed (units/sec)', uiType: 'slider', min: 1, max: 100, step: 1 }
        ));
        this.properties.set('lookaheadTime', new Property<number>(
            'lookaheadTime', 2.0, { label: 'Lookahead Time (sec)', uiType: 'slider', min: 0.1, max: 10, step: 0.1 }
        ));
         this.properties.set('cubeSize', new Property<number>(
            'cubeSize', 0.5, { label: 'Cube Size', uiType: 'slider', min: 0.1, max: 3, step: 0.05 }
        ));
         this.properties.set('verticalRange', new Property<number>(
            'verticalRange', 10.0, { label: 'Vertical Range', uiType: 'slider', min: 1, max: 50, step: 1 }
        ));
         this.properties.set('targetZ', new Property<number>(
            'targetZ', 2.0, { label: 'Target Z', uiType: 'slider', min: -10, max: 10, step: 0.5 }
        ));
        this.properties.set('pitchHueRange', new Property<ColorRange>(
            'pitchHueRange',
            { startHue: 0, endHue: 360 },
            { label: 'Pitch Hue Range', uiType: 'colorRange' }
        ));
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('box')
            .applyApproachEnvelope((noteCtx: NoteContext) => ({
                 lookaheadTime: this.getPropertyValue<number>('lookaheadTime') ?? 2.0,
            }))
            .withPosition((ctx: MappingContext) => {
                const approachSpeed = this.getPropertyValue<number>('approachSpeed') ?? 20.0;
                const targetZ = this.getPropertyValue<number>('targetZ') ?? 2.0;
                const verticalRange = this.getPropertyValue<number>('verticalRange') ?? 10.0;
                const halfVerticalRange = verticalRange / 2;

                let zPos = targetZ;
                if (ctx.timeUntilNoteStart !== undefined && ctx.timeUntilNoteStart > 0) {
                     zPos = targetZ - approachSpeed * ctx.timeUntilNoteStart;
                } else {
                     zPos = targetZ - approachSpeed * (ctx.timeUntilNoteStart ?? 0);
                }

                let yPos = 0;
                if (this._minPitch !== null && this._maxPitch !== null && this._minPitch !== this._maxPitch) {
                    const pitch = ctx.note.pitch;
                    const normalizedPitch = (pitch - this._minPitch) / (this._maxPitch - this._minPitch);
                    yPos = -halfVerticalRange + normalizedPitch * verticalRange;
                } else if (this._minPitch !== null) {
                    yPos = 0;
                }
                yPos = Math.max(-halfVerticalRange, Math.min(halfVerticalRange, yPos));

                return [0, 0, zPos];
            })
            .withScale((ctx: MappingContext) => {
                const cubeSize = this.getPropertyValue<number>('cubeSize') ?? 0.5;
                return [cubeSize, cubeSize, cubeSize];
            })
            .withColor((ctx: MappingContext) => {
                const range = this.getPropertyValue<ColorRange>('pitchHueRange') ?? { startHue: 0, endHue: 360 };
                const minPitch = this._minPitch ?? 0;
                const maxPitch = this._maxPitch ?? 127;
                const pitchRangeSize = (maxPitch - minPitch);

                const normalizedPitch = pitchRangeSize > 0 
                    ? (Math.max(minPitch, Math.min(maxPitch, ctx.note.pitch)) - minPitch) / pitchRangeSize
                    : (ctx.note.pitch / 127);

                let hue: number;
                const hueRangeSize = range.endHue - range.startHue;

                if (hueRangeSize >= 0) {
                    hue = range.startHue + normalizedPitch * hueRangeSize;
                } else {
                    const wrappedRangeSize = 360 + hueRangeSize;
                    hue = range.startHue + normalizedPitch * wrappedRangeSize;
                }
                
                hue = ((hue % 360) + 360) % 360;

                const saturation = 100;
                const lightness = 50;
                return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness}%)`;
            })
            .withOpacity((ctx: MappingContext) => {
                return ctx.timeUntilNoteStart !== undefined ? 1.0 : 0.0;
            });
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }
}

export default GlowingCubeSynth; 