import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import { VisualObject3D } from '../VisualizerManager'; // Import the type for applyGlobalModification
import VisualObjectEngine from '../VisualObjectEngine'; // Engine needed for instantiation

// Simple Vector Math Helpers (using tuples)
type Vec3Tuple = [number, number, number];
const vec3Scale = (v: Vec3Tuple, s: number): Vec3Tuple => [v[0] * s, v[1] * s, v[2] * s];

// ADSR Calculation Helper (adapted from VisualObjectEngine)
interface ADSRParams {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
}

function calculateADSRValue(
    currentTimeSec: number, 
    noteStartSec: number, 
    noteEndSec: number, 
    config: ADSRParams
): number {
    const { attack, decay, sustain, release } = config;
    const timeFromStart = currentTimeSec - noteStartSec;

    if (timeFromStart < 0) return 0; // Before note start

    // Attack phase
    if (timeFromStart < attack) {
        return attack > 0 ? Math.min(1.0, timeFromStart / attack) : 1.0;
    }

    // Decay phase
    const decayStartTime = attack;
    if (timeFromStart < decayStartTime + decay) {
        const decayProgress = decay > 0 ? (timeFromStart - decayStartTime) / decay : 1.0;
        const amplitude = 1.0 - ((1.0 - sustain) * decayProgress);
        return Math.max(0, amplitude);
    }

    // Sustain phase (while note is held)
    if (currentTimeSec <= noteEndSec) {
        return sustain;
    }

    // Release phase (after note off)
    const timeIntoRelease = currentTimeSec - noteEndSec;
    if (timeIntoRelease > 0 && timeIntoRelease < release) {
        const amplitude = release > 0 ? (sustain * (1.0 - (timeIntoRelease / release))) : 0;
        return Math.max(0, amplitude);
    }

    return 0; // After release phase
}

class PulseSynth extends Synthesizer {
    // Engine is required by base class, but we won't use it heavily
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        // Instantiate engine - it won't have definitions added in this synth
        this.engine = new VisualObjectEngine(this);
    }

    clone(): this {
        const cloned = new PulseSynth() as this;
        this.properties.forEach((prop, key) => {
            const originalProp = this.properties.get(key);
            if (originalProp) {
                cloned.setPropertyValue(key, originalProp.value);
            }
        });
        return cloned;
    }

    private initializeProperties(): void {
        this.properties.set('pulseTargetScale', new Property<number>(
            'pulseTargetScale', 0.5, { label: 'Pulse Target Scale', uiType: 'slider', min: 0.0, max: 2.0, step: 0.05 }
        ));
        this.properties.set('baseScale', new Property<number>(
            'baseScale', 1.5, { label: 'Base Scale Multiplier', uiType: 'slider', min: 0.0, max: 2.0, step: 0.01 }
        ));
        this.properties.set('attackTime', new Property<number>(
            'attackTime', 0.05, { label: 'Pulse Attack (s)', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('decayTime', new Property<number>(
            'decayTime', 0.1, { label: 'Pulse Decay (s)', uiType: 'slider', min: 0.0, max: 2.0, step: 0.01 }
        ));
        this.properties.set('sustainLevel', new Property<number>(
            'sustainLevel', 0.8, { label: 'Pulse Sustain Level', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('releaseTime', new Property<number>(
            'releaseTime', 0.3, { label: 'Pulse Release (s)', uiType: 'slider', min: 0.0, max: 3.0, step: 0.01 }
        ));
    }

    // This synth doesn't produce its own visuals directly
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return [];
    }

    // The core logic: applies modification to all visuals based on this track's MIDI
    applyGlobalModification(allVisuals: VisualObject3D[], time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject3D[] {
        const adsrParams: ADSRParams = {
            attack: this.getPropertyValue<number>('attackTime') ?? 0.05,
            decay: this.getPropertyValue<number>('decayTime') ?? 0.1,
            sustain: this.getPropertyValue<number>('sustainLevel') ?? 0.8,
            release: this.getPropertyValue<number>('releaseTime') ?? 0.3,
        };
        const pulseTargetScale = this.getPropertyValue<number>('pulseTargetScale') ?? 0.5;
        const baseScale = this.getPropertyValue<number>('baseScale') ?? 1.0;
        
        const secondsPerBeat = 60 / bpm;
        const currentTimeSec = time * secondsPerBeat;
        
        // Calculate combined ADSR amplitude from *this synth's* MIDI triggers
        let combinedAmplitude = 0;
        midiBlocks.forEach(block => {
            const blockAbsoluteStartBeat = block.startBeat;
            block.notes.forEach(note => {
                const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
                const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;
                const noteStartSec = noteAbsoluteStartBeat * secondsPerBeat;
                const noteEndSec = noteAbsoluteEndBeat * secondsPerBeat;

                // Check if the note's ADSR is currently active
                if (currentTimeSec >= noteStartSec - adsrParams.attack && 
                    currentTimeSec < noteEndSec + adsrParams.release) 
                {
                    combinedAmplitude += calculateADSRValue(currentTimeSec, noteStartSec, noteEndSec, adsrParams);
                }
            });
        });
        // Clamp amplitude just in case (e.g., prevent negative from overlapping releases)
        combinedAmplitude = Math.max(0, combinedAmplitude); 
        // Optional: Could cap combinedAmplitude at 1 if overlapping pulses shouldn't exceed max strength
        // combinedAmplitude = Math.min(1, combinedAmplitude); 

        // Calculate the final scale multiplier using the target scale
        // This formula correctly moves from baseScale towards pulseTargetScale based on amplitude
        const targetScaleMult = baseScale + (pulseTargetScale - baseScale) * combinedAmplitude;

        // Apply the scale modification to all incoming visuals
        const modifiedVisuals = allVisuals.map(visual => {
            // Apply multiplicative scale
            const newScale = vec3Scale(visual.scale, targetScaleMult);
            return {
                ...visual,
                scale: newScale
            };
        });

        return modifiedVisuals;
    }
}

export default PulseSynth; 