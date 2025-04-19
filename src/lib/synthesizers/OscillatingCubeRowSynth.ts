import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, NoteContext, InstanceData, ADSRConfigFn } from '../VisualObjectEngine';

class OscillatingCubeRowSynth extends Synthesizer {
    private _minPitch: number | null = null;
    private _maxPitch: number | null = null;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        // Row Properties
        this.properties.set('numCubes', new Property<number>(
            'numCubes', 4, { label: 'Number of Cubes', uiType: 'slider', min: 1, max: 15, step: 1 }
        ));
        this.properties.set('zSpacing', new Property<number>(
            'zSpacing', 2.5, { label: 'Z Spacing', uiType: 'slider', min: 0.1, max: 8.0, step: 0.1 }
        ));
        this.properties.set('startZ', new Property<number>(
            'startZ', -3.0, { label: 'Start Z', uiType: 'slider', min: -20.0, max: 10.0, step: 0.5 }
        ));

        // Appearance Properties
        this.properties.set('baseSize', new Property<number>(
            'baseSize', 0.8, { label: 'Cube Size', uiType: 'slider', min: 0.1, max: 4.0, step: 0.05 }
        ));

        // Oscillation Properties
        this.properties.set('yAmplitude', new Property<number>(
            'yAmplitude', 1.5, { label: 'Y Oscillation Amplitude', uiType: 'slider', min: 0.0, max: 10.0, step: 0.1 }
        ));
        this.properties.set('minOscFreq', new Property<number>(
            'minOscFreq', 0.5, { label: 'Min Osc Freq (Hz)', uiType: 'slider', min: 0.1, max: 5.0, step: 0.05 }
        ));
        this.properties.set('maxOscFreq', new Property<number>(
            'maxOscFreq', 3.0, { label: 'Max Osc Freq (Hz)', uiType: 'slider', min: 0.5, max: 15.0, step: 0.1 }
        ));

        // ADSR Properties
        this.properties.set('attack', new Property<number>(
            'attack', 0.05, { label: 'Attack (s)', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('decay', new Property<number>(
            'decay', 0.1, { label: 'Decay (s)', uiType: 'slider', min: 0.0, max: 2.0, step: 0.01 }
        ));
        this.properties.set('sustain', new Property<number>(
            'sustain', 0.8, { label: 'Sustain Level', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('release', new Property<number>(
            'release', 0.5, { label: 'Release (s)', uiType: 'slider', min: 0.1, max: 5.0, step: 0.05 }
        ));
    }

    private initializeEngine(): void {
        const adsrConfigFn: ADSRConfigFn = (noteCtx: NoteContext) => ({
            attack: this.getPropertyValue<number>('attack') ?? 0.05,
            decay: this.getPropertyValue<number>('decay') ?? 0.1,
            sustain: this.getPropertyValue<number>('sustain') ?? 0.8,
            release: this.getPropertyValue<number>('release') ?? 0.5,
        });

        this.engine.defineObject('cube')
            .forEachInstance((parentCtx: MappingContext): InstanceData[] => {
                const numCubes = Math.floor(this.getPropertyValue<number>('numCubes') ?? 1);
                const instances: InstanceData[] = [];
                for (let i = 0; i < numCubes; i++) {
                    instances.push({ 
                        zIndex: i, 
                        notePitch: parentCtx.note.pitch, // Pass pitch for frequency mapping
                    });
                }
                return instances;
            })
            .applyADSR(adsrConfigFn)
            .withPosition((ctx: MappingContext): [number, number, number] => {
                const startZ = this.getPropertyValue<number>('startZ') ?? -3.0;
                const zSpacing = this.getPropertyValue<number>('zSpacing') ?? 2.5;
                const yAmplitude = this.getPropertyValue<number>('yAmplitude') ?? 1.5;
                const minFreq = this.getPropertyValue<number>('minOscFreq') ?? 0.5;
                const maxFreq = this.getPropertyValue<number>('maxOscFreq') ?? 3.0;
                
                const zIndex = ctx.instanceData.zIndex as number;
                const pitch = ctx.instanceData.notePitch as number;
                
                // --- Calculate Oscillation Frequency based on Pitch --- 
                let oscFreq = minFreq; // Default frequency
                if (this._minPitch !== null && this._maxPitch !== null && this._maxPitch > this._minPitch) {
                    // Normalize pitch within the current range
                    const normalizedPitch = (pitch - this._minPitch) / (this._maxPitch - this._minPitch);
                    // Map normalized pitch to the frequency range
                    oscFreq = minFreq + normalizedPitch * (maxFreq - minFreq);
                } else if (this._minPitch !== null) {
                     // If only one pitch, use min or max freq? Let's use minFreq.
                     oscFreq = minFreq;
                }
                 // Clamp frequency just in case
                 oscFreq = Math.max(minFreq, Math.min(maxFreq, oscFreq)); 

                // --- Calculate Position --- 
                const zPos = startZ + zIndex * zSpacing;
                const yPos = yAmplitude * Math.sin(2 * Math.PI * oscFreq * ctx.timeSinceNoteStart);

                return [0, yPos, zPos]; // X=0, Y oscillates, Z based on index
            })
            .withScale((ctx: MappingContext): [number, number, number] => {
                const baseSize = this.getPropertyValue<number>('baseSize') ?? 0.8;
                return [baseSize, baseSize, baseSize]; // Constant size
            })
            .withOpacity((ctx: MappingContext): number => {
                return ctx.adsrAmplitude ?? 0; // Fade with ADSR
            });
            // No color or emissive properties defined here by default
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        // Calculate min/max pitch
        if (midiBlocks.length === 0) {
            this._minPitch = null;
            this._maxPitch = null;
            return [];
        } else {
             let minP: number | null = null;
             let maxP: number | null = null;
             midiBlocks.forEach(block => {
                 block.notes.forEach(note => {
                     if (minP === null || note.pitch < minP) minP = note.pitch;
                     if (maxP === null || note.pitch > maxP) maxP = note.pitch;
                 });
             });
             this._minPitch = minP;
             this._maxPitch = maxP;
             if (minP === null) return []; // No notes
        }

        // Return objects generated by the engine
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new OscillatingCubeRowSynth() as this;
        this.properties.forEach((prop, key) => {
            const clonedProp = cloned.properties.get(key);
            if (clonedProp) {
                clonedProp.value = prop.value;
            }
        });
        return cloned;
    }
}

export default OscillatingCubeRowSynth; 