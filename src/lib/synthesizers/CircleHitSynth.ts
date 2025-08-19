import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, ColorRange, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class CircleHitSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    clone(): this {
        const cloned = new CircleHitSynth() as this;
        this.properties.forEach((prop, key) => {
            cloned.setPropertyValue(key, prop.value);
        });
        return cloned;
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
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
        this.properties.set('baseRadius', new Property<number>(
            'baseRadius',
            0.5,
            { label: 'Base Radius', uiType: 'slider', min: 0.1, max: 2.0, step: 0.05 }
        ));
        this.properties.set('radiusStep', new Property<number>(
            'radiusStep',
            0.3,
            { label: 'Radius Step', uiType: 'slider', min: 0.1, max: 1.0, step: 0.05 }
        ));
        this.properties.set('glowIntensity', new Property<number>(
            'glowIntensity',
            0.3,
            { label: 'Glow Intensity', uiType: 'slider', min: 0, max: 5, step: 0.1 }
        ));
        this.properties.set('ringThickness', new Property<number>(
            'ringThickness',
            0.1,
            { label: 'Ring Thickness', uiType: 'slider', min: 0.05, max: 0.5, step: 0.01 }
        ));
        this.properties.set('hueRange', new Property<ColorRange>(
            'hueRange',
            { startHue: 240, endHue: 0 },
            { label: 'Hue Range (Pitch Class)', uiType: 'colorRange' }
        ));
        this.properties.set('attack', new Property<number>(
            'attack',
            0.01,
            { label: 'Attack (s)', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('decay', new Property<number>(
            'decay',
            0.2,
            { label: 'Decay (s)', uiType: 'slider', min: 0.0, max: 2.0, step: 0.01 }
        ));
        this.properties.set('sustain', new Property<number>(
            'sustain',
            0.5,
            { label: 'Sustain Level', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('release', new Property<number>(
            'release',
            0.8,
            { label: 'Release (s)', uiType: 'slider', min: 0.0, max: 5.0, step: 0.01 }
        ));
    }

    private initializeEngine(): void {
        this.engine.defineObject('ring')
            .withPosition((ctx: MappingContext) => {
                return [0, 0, 0];
            })
            .withScale((ctx: MappingContext) => {
                const baseRadius = this.getPropertyValue<number>('baseRadius') ?? 0.5;
                const radiusStep = this.getPropertyValue<number>('radiusStep') ?? 0.3;
                const ringThickness = this.getPropertyValue<number>('ringThickness') ?? 0.1;
                
                const pitchClass = ctx.note.pitch % 12;
                const outerRadius = baseRadius + (pitchClass * radiusStep);
                const innerRadius = Math.max(0, outerRadius - ringThickness);
                
                // For ring geometry: [innerRadius, outerRadius, thetaSegments]
                // We need to scale the ring geometry which has default inner=0.5, outer=1
                // So we scale by outerRadius and adjust for the inner/outer ratio
                const scale = outerRadius;
                return [scale, scale, scale];
            })
            .withColor((ctx: MappingContext) => {
                const range = this.getPropertyValue<ColorRange>('hueRange') ?? { startHue: 240, endHue: 0 };
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

                const saturation = 90;
                const lightness = 80;
                return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness}%)`;
            })
            .withOpacity((ctx: MappingContext) => (ctx.adsrAmplitude ?? 0) * (ctx.note.velocity * 2))
            .applyADSR((noteCtx: NoteContext) => ({ 
                attack: this.getPropertyValue<number>('attack') ?? 0.01,
                decay: this.getPropertyValue<number>('decay') ?? 0.2,
                sustain: this.getPropertyValue<number>('sustain') ?? 0.5,
                release: this.getPropertyValue<number>('release') ?? 0.8,
            }));
    }
}

export default CircleHitSynth;