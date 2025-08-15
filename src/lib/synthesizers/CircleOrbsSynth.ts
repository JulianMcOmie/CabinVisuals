import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, ColorRange, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, ADSRConfig, InstanceData } from '../VisualObjectEngine';

class CircleOrbsSynth extends Synthesizer {
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    clone(): this {
        const cloned = new CircleOrbsSynth() as this;
        this.properties.forEach((prop, key) => {
            cloned.setPropertyValue(key, prop.value);
        });
        return cloned;
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    private initializeProperties(): void {
        this.properties.set('numberOfOrbs', new Property<number>(
            'numberOfOrbs',
            8,
            { label: 'Number of Orbs', uiType: 'slider', min: 3, max: 24, step: 1 }
        ));
        this.properties.set('minRadius', new Property<number>(
            'minRadius',
            2.0,
            { label: 'Min Circle Radius', uiType: 'slider', min: 0.5, max: 5.0, step: 0.1 }
        ));
        this.properties.set('maxRadius', new Property<number>(
            'maxRadius',
            8.0,
            { label: 'Max Circle Radius', uiType: 'slider', min: 2.0, max: 15.0, step: 0.1 }
        ));
        this.properties.set('orbSize', new Property<number>(
            'orbSize',
            0.3,
            { label: 'Orb Size', uiType: 'slider', min: 0.1, max: 1.0, step: 0.05 }
        ));
        this.properties.set('hueRange', new Property<ColorRange>(
            'hueRange',
            { startHue: 180, endHue: 280 },
            { label: 'Hue Range (Pitch)', uiType: 'colorRange' }
        ));
        this.properties.set('colorVariation', new Property<number>(
            'colorVariation',
            30,
            { label: 'Color Variation', uiType: 'slider', min: 0, max: 90, step: 5 }
        ));
        this.properties.set('velocityBrightness', new Property<number>(
            'velocityBrightness',
            40,
            { label: 'Velocity Brightness', uiType: 'slider', min: 0, max: 80, step: 5 }
        ));
        this.properties.set('attack', new Property<number>(
            'attack',
            0.05,
            { label: 'Attack (s)', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('decay', new Property<number>(
            'decay',
            0.3,
            { label: 'Decay (s)', uiType: 'slider', min: 0.0, max: 2.0, step: 0.05 }
        ));
        this.properties.set('sustain', new Property<number>(
            'sustain',
            0.7,
            { label: 'Sustain Level', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('release', new Property<number>(
            'release',
            1.0,
            { label: 'Release (s)', uiType: 'slider', min: 0.1, max: 3.0, step: 0.1 }
        ));
    }

    private initializeEngine(): void {
        const adsrConfigFn = (noteCtx: NoteContext): ADSRConfig => ({
            attack: this.getPropertyValue<number>('attack') ?? 0.05,
            decay: this.getPropertyValue<number>('decay') ?? 0.3,
            sustain: this.getPropertyValue<number>('sustain') ?? 0.7,
            release: this.getPropertyValue<number>('release') ?? 1.0,
        });

        this.engine.defineObject('sphere')
            .applyADSR(adsrConfigFn)
            .forEachInstance((ctx: MappingContext): InstanceData[] => {
                const numberOfOrbs = this.getPropertyValue<number>('numberOfOrbs') ?? 8;
                const instances: InstanceData[] = [];
                
                for (let i = 0; i < numberOfOrbs; i++) {
                    const angle = (i / numberOfOrbs) * Math.PI * 2;
                    instances.push({
                        id: i,
                        angle: angle,
                        orbIndex: i
                    });
                }
                
                return instances;
            })
            .withPosition((ctx: MappingContext): [number, number, number] => {
                const minRadius = this.getPropertyValue<number>('minRadius') ?? 2.0;
                const maxRadius = this.getPropertyValue<number>('maxRadius') ?? 8.0;
                
                // Map pitch to radius - higher pitch = larger radius
                const radius = MappingUtils.mapPitchToRange(ctx.note.pitch, minRadius, maxRadius);
                
                // Get angle from instance data
                const angle = ctx.instanceData.angle;
                
                // Calculate position on XY plane (circle lies flat)
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);
                const z = 0; // Keep on XY plane
                
                return [x, y, z];
            })
            .withScale((ctx: MappingContext): [number, number, number] => {
                const orbSize = this.getPropertyValue<number>('orbSize') ?? 0.3;
                
                // Scale with velocity for some dynamic size variation
                const velocityScale = MappingUtils.mapValue(ctx.note.velocity, 0, 127, 0.7, 1.3);
                const finalSize = orbSize * velocityScale;
                
                return [finalSize, finalSize, finalSize];
            })
            .withColor((ctx: MappingContext): string => {
                const range = this.getPropertyValue<ColorRange>('hueRange') ?? { startHue: 180, endHue: 280 };
                const colorVariation = this.getPropertyValue<number>('colorVariation') ?? 30;
                const velocityBrightness = this.getPropertyValue<number>('velocityBrightness') ?? 40;
                
                // Base hue from pitch
                const pitchClass = ctx.note.pitch % 12;
                const normalizedPitchClass = pitchClass / 11;
                
                let baseHue: number;
                const rangeSize = range.endHue - range.startHue;
                
                if (rangeSize >= 0) {
                    baseHue = range.startHue + normalizedPitchClass * rangeSize;
                } else {
                    const wrappedRangeSize = 360 + rangeSize;
                    baseHue = range.startHue + normalizedPitchClass * wrappedRangeSize;
                }
                
                // Add color variation based on orb position in circle
                const orbIndex = ctx.instanceData.orbIndex;
                const numberOfOrbs = this.getPropertyValue<number>('numberOfOrbs') ?? 8;
                const orbVariation = (orbIndex / numberOfOrbs) * colorVariation;
                
                const finalHue = ((baseHue + orbVariation) % 360 + 360) % 360;
                
                // Brightness varies with velocity
                const baseLightness = 60;
                const velocityLightness = MappingUtils.mapValue(ctx.note.velocity, 0, 127, 0, velocityBrightness);
                const lightness = Math.min(90, baseLightness + velocityLightness);
                
                const saturation = 85;
                
                return `hsl(${finalHue.toFixed(0)}, ${saturation}%, ${lightness.toFixed(0)}%)`;
            })
            .withOpacity((ctx: MappingContext): number => {
                const adsrOpacity = ctx.adsrAmplitude ?? 1.0;
                
                // Base opacity varies with velocity
                const velocityOpacity = MappingUtils.mapValue(ctx.note.velocity, 0, 127, 0.6, 1.0);
                
                return adsrOpacity * velocityOpacity;
            });
    }
}

export default CircleOrbsSynth;