import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, ColorRange, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, ADSRConfig } from '../VisualObjectEngine';

class ViolinRingSynth extends Synthesizer {
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    clone(): this {
        const cloned = new ViolinRingSynth() as this;
        this.properties.forEach((prop, key) => {
            cloned.setPropertyValue(key, prop.value);
        });
        return cloned;
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    private initializeProperties(): void {
        this.properties.set('maxRingSize', new Property<number>(
            'maxRingSize',
            8.0,
            { label: 'Max Ring Size', uiType: 'slider', min: 1.0, max: 20.0, step: 0.1 }
        ));
        this.properties.set('ringThickness', new Property<number>(
            'ringThickness',
            0.2,
            { label: 'Ring Thickness', uiType: 'slider', min: 0.05, max: 1.0, step: 0.05 }
        ));
        this.properties.set('expansionSpeed', new Property<number>(
            'expansionSpeed',
            2.5,
            { label: 'Expansion Speed', uiType: 'slider', min: 0.5, max: 8.0, step: 0.1 }
        ));
        this.properties.set('hueRange', new Property<ColorRange>(
            'hueRange',
            { startHue: 240, endHue: 320 },
            { label: 'Hue Range (Pitch)', uiType: 'colorRange' }
        ));
        this.properties.set('velocityColorShift', new Property<number>(
            'velocityColorShift',
            60,
            { label: 'Velocity Color Shift', uiType: 'slider', min: 0, max: 180, step: 5 }
        ));
        this.properties.set('ySpread', new Property<number>(
            'ySpread',
            4.0,
            { label: 'Vertical Spread', uiType: 'slider', min: 0, max: 10, step: 0.1 }
        ));
        this.properties.set('attack', new Property<number>(
            'attack',
            0.02,
            { label: 'Attack (s)', uiType: 'slider', min: 0.0, max: 0.5, step: 0.01 }
        ));
        this.properties.set('decay', new Property<number>(
            'decay',
            1.5,
            { label: 'Decay (s)', uiType: 'slider', min: 0.1, max: 5.0, step: 0.1 }
        ));
        this.properties.set('sustain', new Property<number>(
            'sustain',
            0.0,
            { label: 'Sustain Level', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('release', new Property<number>(
            'release',
            0.8,
            { label: 'Release (s)', uiType: 'slider', min: 0.1, max: 3.0, step: 0.1 }
        ));
    }

    private initializeEngine(): void {
        const adsrConfigFn = (noteCtx: NoteContext): ADSRConfig => ({
            attack: this.getPropertyValue<number>('attack') ?? 0.02,
            decay: this.getPropertyValue<number>('decay') ?? 1.5,
            sustain: this.getPropertyValue<number>('sustain') ?? 0.0,
            release: this.getPropertyValue<number>('release') ?? 0.8,
        });

        this.engine.defineObject('ring')
            .applyADSR(adsrConfigFn)
            .withPosition((ctx: MappingContext): [number, number, number] => {
                const ySpread = this.getPropertyValue<number>('ySpread') ?? 4.0;
                const yPos = MappingUtils.mapPitchToRange(ctx.note.pitch, -ySpread, ySpread);
                return [0, yPos, 0];
            })
            .withScale((ctx: MappingContext): [number, number, number] => {
                const maxRingSize = this.getPropertyValue<number>('maxRingSize') ?? 8.0;
                const expansionSpeed = this.getPropertyValue<number>('expansionSpeed') ?? 2.5;
                
                // Calculate ring expansion based on time since note start
                const expansionProgress = Math.max(0, ctx.timeSinceNoteStart * expansionSpeed);
                const ringSize = Math.min(maxRingSize, expansionProgress);
                
                // Make the ring scale with velocity for initial impact
                const velocityScale = MappingUtils.mapValue(ctx.note.velocity, 0, 127, 0.3, 1.0);
                const finalRingSize = ringSize * velocityScale;
                
                // For ring geometry, we scale uniformly in x and y, and keep z minimal for flatness
                return [finalRingSize, finalRingSize, 1.0];
            })
            .withColor((ctx: MappingContext): string => {
                const range = this.getPropertyValue<ColorRange>('hueRange') ?? { startHue: 240, endHue: 320 };
                const velocityColorShift = this.getPropertyValue<number>('velocityColorShift') ?? 60;
                
                // Map pitch to hue range
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
                
                // Add velocity-based color shift
                const velocityShift = MappingUtils.mapValue(ctx.note.velocity, 0, 127, 0, velocityColorShift);
                const finalHue = ((baseHue + velocityShift) % 360 + 360) % 360;
                
                // Vary saturation and lightness based on expansion
                const expansionSpeed = this.getPropertyValue<number>('expansionSpeed') ?? 2.5;
                const expansionProgress = Math.max(0, ctx.timeSinceNoteStart * expansionSpeed);
                const maxRingSize = this.getPropertyValue<number>('maxRingSize') ?? 8.0;
                const expansionPercent = Math.min(1.0, expansionProgress / maxRingSize);
                
                // Increase saturation as ring expands, then decrease
                const saturation = Math.max(60, 100 - (expansionPercent * 40));
                // Start bright, fade to darker as it expands
                const lightness = Math.max(30, 70 - (expansionPercent * 40));
                
                return `hsl(${finalHue.toFixed(0)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%)`;
            })
            .withOpacity((ctx: MappingContext): number => {
                const adsrOpacity = ctx.adsrAmplitude ?? 1.0;
                
                // Additional fade based on ring expansion
                const expansionSpeed = this.getPropertyValue<number>('expansionSpeed') ?? 2.5;
                const maxRingSize = this.getPropertyValue<number>('maxRingSize') ?? 8.0;
                const expansionProgress = Math.max(0, ctx.timeSinceNoteStart * expansionSpeed);
                const expansionPercent = Math.min(1.0, expansionProgress / maxRingSize);
                
                // Fade out as ring reaches maximum size
                const expansionFade = 1.0 - (expansionPercent * 0.3);
                
                // Velocity affects initial opacity
                const velocityOpacity = MappingUtils.mapValue(ctx.note.velocity, 0, 127, 0.4, 1.0);
                
                return adsrOpacity * expansionFade * velocityOpacity;
            });
    }
}

export default ViolinRingSynth;