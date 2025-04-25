import Synthesizer, { ProcessedTrackVisuals } from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import { VisualObject3D } from '../VisualizerManager';
import VisualObjectEngine from '../VisualObjectEngine';
import * as THREE from 'three'; // Import THREE for vector math

class VelocityRotateSynth extends Synthesizer {
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this); // Required by base class
    }

    clone(): this {
        const cloned = new VelocityRotateSynth() as this;
        this.properties.forEach((prop, key) => {
            const originalProp = this.properties.get(key);
            if (originalProp) {
                cloned.setPropertyValue(key, originalProp.value);
            }
        });
        return cloned;
    }

    private initializeProperties(): void {
        // Rotation Axis
        this.properties.set('axisX', new Property<number>('axisX', 0, { label: 'Axis X', uiType: 'slider', min: -1, max: 1, step: 0.1 }));
        this.properties.set('axisY', new Property<number>('axisY', 1, { label: 'Axis Y', uiType: 'slider', min: -1, max: 1, step: 0.1 }));
        this.properties.set('axisZ', new Property<number>('axisZ', 0, { label: 'Axis Z', uiType: 'slider', min: -1, max: 1, step: 0.1 }));
        // Velocity Sensitivity
        this.properties.set('velocitySensitivity', new Property<number>(
            'velocitySensitivity', 0.2, { label: 'Velocity Sensitivity (Rot/Beat @ max)', uiType: 'slider', min: 0, max: 2, step: 0.05 }
        ));
        // Target Tracks
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

    applyGlobalModification(
        processedTracks: ProcessedTrackVisuals[], 
        time: number, // Time in beats
        midiBlocks: MIDIBlock[], 
        bpm: number
    ): ProcessedTrackVisuals[] { 
        const axisX = this.getPropertyValue<number>('axisX') ?? 0;
        const axisY = this.getPropertyValue<number>('axisY') ?? 1;
        const axisZ = this.getPropertyValue<number>('axisZ') ?? 0;
        const velocitySensitivity = this.getPropertyValue<number>('velocitySensitivity') ?? 0.2;
        const targetIds = this.getPropertyValue<string[]>('targetTrackIds') ?? [];
        const targetAll = targetIds.length === 0;

        const secondsPerBeat = 60 / bpm;
        const currentTimeSec = time * secondsPerBeat;

        // --- Find Max Velocity and Start Beat of the Trigger Note --- 
        let maxVelocity = 0;
        let triggerNoteStartBeat: number | null = null; // Store start beat of the note with max velocity

        midiBlocks.forEach(block => {
            const blockAbsoluteStartBeat = block.startBeat;
            block.notes.forEach(note => {
                const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
                const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;
                const noteStartSec = noteAbsoluteStartBeat * secondsPerBeat;
                const noteEndSec = noteAbsoluteEndBeat * secondsPerBeat;
                
                if (currentTimeSec >= noteStartSec && currentTimeSec < noteEndSec) {
                    // Use the note with the highest velocity as the trigger
                    if (note.velocity > maxVelocity) {
                        maxVelocity = note.velocity;
                        triggerNoteStartBeat = noteAbsoluteStartBeat; // Record this note's start time
                    } 
                    // Optional: Handle ties in velocity (e.g., use most recent note)? 
                    // Current logic uses the first one found with max velocity.
                }
            });
        });
        
        // --- Calculate Speed and Angle --- 
        const velocityFactor = maxVelocity / 127.0;
        const effectiveRotationsPerBeat = velocitySensitivity * velocityFactor;

        // If no active notes (maxVelocity is 0), no rotation needed
        if (maxVelocity === 0 || triggerNoteStartBeat === null || Math.abs(effectiveRotationsPerBeat) < 0.001) {
            return processedTracks;
        }

        const axis = new THREE.Vector3(axisX, axisY, axisZ).normalize();
        if (axis.lengthSq() === 0) {
             console.warn('VelocityRotateSynth: Invalid rotation axis [0, 0, 0]');
             return processedTracks;
        }
        
        // Calculate angle based on time SINCE the trigger note started
        const timeSinceTriggerStart = time - triggerNoteStartBeat;
        const totalAngle = effectiveRotationsPerBeat * 2 * Math.PI * timeSinceTriggerStart;
        
        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, totalAngle);

        // --- Apply Modifications --- 
        const modifiedProcessedTracks = processedTracks.map(trackData => {
            if (!targetAll && !targetIds.includes(trackData.trackId)) {
                return trackData; 
            }

            const modifiedVisuals = trackData.visuals.map(visual => {
                if (!visual.position || visual.position.length !== 3) {
                    return visual;
                }
                try {
                    const currentPosition = new THREE.Vector3(...visual.position);
                    const rotatedPosition = currentPosition.clone().applyQuaternion(quaternion);
                    return {
                        ...visual,
                        position: [rotatedPosition.x, rotatedPosition.y, rotatedPosition.z] as [number, number, number]
                    };
                } catch (error) {
                    console.error("Error applying rotation:", error, visual);
                    return visual; 
                }
            });
            return { ...trackData, visuals: modifiedVisuals };
        });
        return modifiedProcessedTracks;
    }
}

export default VelocityRotateSynth; 