import Synthesizer, { ProcessedTrackVisuals } from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import { VisualObject3D } from '../VisualizerManager'; 
import VisualObjectEngine from '../VisualObjectEngine'; 

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

class PositionPulseSynth extends Synthesizer {
    // Engine is required by base class, but we won't use it directly for visuals
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        // Instantiate engine - it won't have definitions added in this synth
        this.engine = new VisualObjectEngine(this);
    }

    clone(): this {
        const cloned = new PositionPulseSynth() as this;
        this.properties.forEach((prop, key) => {
            const originalProp = this.properties.get(key);
            if (originalProp) {
                cloned.setPropertyValue(key, originalProp.value);
            }
        });
        return cloned;
    }

    private initializeProperties(): void {
        // ADAPTED: Property for target position scale during pulse
        this.properties.set('positionScaleTarget', new Property<number>(
            'positionScaleTarget', 0.5, { label: 'Position Scale Target', uiType: 'slider', min: 0.0, max: 5.0, step: 0.05 }
        ));
        // KEPT: ADSR properties
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
        // KEPT: Target track selection
        this.properties.set('targetTrackIds', new Property<string[]>(
            'targetTrackIds', 
            [],
            { label: 'Target Tracks', uiType: 'trackSelector' }
        ));
    }

    // This synth doesn't produce its own visuals directly
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return [];
    }

    // ADAPTED: Applies position modification to all visuals based on this track's MIDI
    applyGlobalModification(
        processedTracks: ProcessedTrackVisuals[], 
        time: number, 
        midiBlocks: MIDIBlock[], 
        bpm: number
    ): ProcessedTrackVisuals[] {
        const adsrParams: ADSRParams = {
            attack: this.getPropertyValue<number>('attackTime') ?? 0.05,
            decay: this.getPropertyValue<number>('decayTime') ?? 0.1,
            sustain: this.getPropertyValue<number>('sustainLevel') ?? 0.8,
            release: this.getPropertyValue<number>('releaseTime') ?? 0.3,
        };
        // ADAPTED: Get target position scale
        const positionScaleTarget = this.getPropertyValue<number>('positionScaleTarget') ?? 1.5;
        
        const targetIds = this.getPropertyValue<string[]>('targetTrackIds') ?? [];
        const targetAll = targetIds.length === 0;

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

                if (currentTimeSec >= noteStartSec && 
                    currentTimeSec < noteEndSec + adsrParams.release) 
                {
                    combinedAmplitude += calculateADSRValue(currentTimeSec, noteStartSec, noteEndSec, adsrParams);
                }
            });
        });
        combinedAmplitude = Math.max(0, combinedAmplitude); 
        // combinedAmplitude = Math.min(1, combinedAmplitude); // Optional cap

        // CORRECTED: Calculate the final position scale multiplier by interpolating between 1.0 and the target
        const targetPositionScaleMult = 1.0 + (positionScaleTarget - 1.0) * combinedAmplitude;

        // Apply modification only to targeted tracks
        const modifiedProcessedTracks = processedTracks.map(trackData => {
            if (targetAll || targetIds.includes(trackData.trackId)) {
                // ADAPTED: Apply position modification
                const modifiedVisuals = trackData.visuals.map(visual => {
                    // Ensure position is defined and is a Vec3Tuple
                    if (!visual.position || !Array.isArray(visual.position) || visual.position.length !== 3) {
                         // Handle cases where position might not be set yet or has unexpected format
                         console.warn("Visual object missing or has invalid position:", visual);
                         return visual; 
                    }
                    const newPosition = vec3Scale(visual.position as Vec3Tuple, targetPositionScaleMult);
                    return {
                        ...visual,
                        position: newPosition // Modify position instead of scale
                    };
                });
                return { ...trackData, visuals: modifiedVisuals };
            } else {
                return trackData;
            }
        });

        return modifiedProcessedTracks;
    }
}

export default PositionPulseSynth; 