import Synthesizer, { ProcessedTrackVisuals } from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import { VisualObject3D } from '../VisualizerManager'; // Import the type for applyGlobalModification
import VisualObjectEngine, { MappingUtils } from '../VisualObjectEngine'; // Engine needed + MappingUtils

// Simple Vector Math Helpers (using tuples)
type Vec3Tuple = [number, number, number];
const vec3Add = (v1: Vec3Tuple, v2: Vec3Tuple): Vec3Tuple => [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];

class VelocityOffsetDuplicateSynth extends Synthesizer {
    // Engine is required by base class, but we won't use it directly
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        // Instantiate engine - it won't have definitions added in this synth
        this.engine = new VisualObjectEngine(this);
    }

    clone(): this {
        const cloned = new VelocityOffsetDuplicateSynth() as this;
        this.properties.forEach((prop, key) => {
            const originalProp = this.properties.get(key);
            if (originalProp) {
                cloned.setPropertyValue(key, originalProp.value);
            }
        });
        return cloned;
    }

    private initializeProperties(): void {
        this.properties.set('maxOffset', new Property<number>(
            'maxOffset', 5.0, { label: 'Max Initial Offset (Velocity)', uiType: 'slider', min: 0.0, max: 20.0, step: 0.1 }
        ));
        this.properties.set('opacityMultiplier', new Property<number>(
            'opacityMultiplier', 0.5, { label: 'Duplicate Opacity Mult', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('glideSpeed', new Property<number>(
            'glideSpeed', 1.0, { label: 'Offset Glide Speed (units/sec)', uiType: 'slider', min: 0.0, max: 10.0, step: 0.1 }
        ));
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

    // The core logic: creates duplicates based on this track's MIDI
    applyGlobalModification(
        processedTracks: ProcessedTrackVisuals[], 
        time: number, 
        midiBlocks: MIDIBlock[], // MIDI blocks for *this* synth's track
        bpm: number
    ): ProcessedTrackVisuals[] {
        // --- Get Property Values ---
        const maxOffset = this.getPropertyValue<number>('maxOffset') ?? 5.0;
        const opacityMultiplier = this.getPropertyValue<number>('opacityMultiplier') ?? 0.5;
        const glideSpeed = this.getPropertyValue<number>('glideSpeed') ?? 1.0;
        const targetIds = this.getPropertyValue<string[]>('targetTrackIds') ?? [];
        const targetAll = targetIds.length === 0;

        const secondsPerBeat = 60 / bpm;
        const currentTimeSec = time * secondsPerBeat;

        // --- Determine Max Effect from Active Notes ---
        let maxVelocityFactor = 0;
        let maxTimeSinceNoteStart = 0; // For glide calculation

        midiBlocks.forEach(block => {
            const blockAbsoluteStartBeat = block.startBeat;
            block.notes.forEach(note => {
                const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
                const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;
                const noteStartSec = noteAbsoluteStartBeat * secondsPerBeat;
                const noteEndSec = noteAbsoluteEndBeat * secondsPerBeat;

                // Check if note is currently held down
                if (currentTimeSec >= noteStartSec && currentTimeSec < noteEndSec) {
                    const velocityFactor = MappingUtils.mapValue(note.velocity ?? 100, 0, 127, 0, 1);
                    const timeSinceStart = currentTimeSec - noteStartSec;

                    maxVelocityFactor = Math.max(maxVelocityFactor, velocityFactor);
                    maxTimeSinceNoteStart = Math.max(maxTimeSinceNoteStart, timeSinceStart);
                }
            });
        });

        // --- Calculate Final Offset ---
        // Only apply offset if there's an active note contributing
        const currentBaseOffset = maxVelocityFactor > 0 ? maxOffset * maxVelocityFactor : 0;
        const currentGlideOffset = maxVelocityFactor > 0 ? glideSpeed * maxTimeSinceNoteStart : 0;
        const totalOffset = currentBaseOffset + currentGlideOffset;

        // If no active notes are driving the effect, no offset is applied
        if (totalOffset <= 0) {
            return processedTracks; // Return original tracks unchanged
        }

        // --- Apply Duplication to Targeted Tracks ---
        const modifiedProcessedTracks = processedTracks.map(trackData => {
            // Check if this track is targeted
            if (targetAll || targetIds.includes(trackData.trackId)) {
                const newVisuals: VisualObject3D[] = []; // Use VisualObject3D for consistency if needed

                trackData.visuals.forEach(originalVisual => {
                    // 1. Add the original visual
                    newVisuals.push(originalVisual);

                    // Ensure properties exist for safety (though type suggests they should)
                    const originalPos = originalVisual.position ?? [0,0,0];
                    const originalOpacity = originalVisual.opacity ?? 1.0;

                    // 2. Create Left Duplicate
                    const leftDuplicate: VisualObject3D = {
                        ...originalVisual, // Shallow copy properties
                        position: [originalPos[0] - totalOffset, originalPos[1], originalPos[2]],
                        opacity: originalOpacity * opacityMultiplier,
                        // Potentially add a unique identifier or flag later if needed
                    };
                    newVisuals.push(leftDuplicate);

                    // 3. Create Right Duplicate
                    const rightDuplicate: VisualObject3D = {
                        ...originalVisual,
                        position: [originalPos[0] + totalOffset, originalPos[1], originalPos[2]],
                        opacity: originalOpacity * opacityMultiplier,
                    };
                    newVisuals.push(rightDuplicate);
                });
                
                // Return track data with modified visuals (original + duplicates)
                return { ...trackData, visuals: newVisuals };
            } else {
                // Return unmodified track data
                return trackData;
            }
        });

        return modifiedProcessedTracks;
    }
}

export default VelocityOffsetDuplicateSynth; 