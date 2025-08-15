import Synthesizer, { ProcessedTrackVisuals } from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote, ColorRange } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingUtils } from '../VisualObjectEngine';
import { VisualObject3D } from '../VisualizerManager';

// Helper function to parse HSL string and extract components
function parseHSL(hslString: string): { h: number, s: number, l: number } {
    const match = hslString.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
    if (!match) {
        return { h: 0, s: 50, l: 50 }; // Default fallback
    }
    return {
        h: parseFloat(match[1]),
        s: parseFloat(match[2]),
        l: parseFloat(match[3])
    };
}

// Helper function to convert HSL components back to string
function hslToString(h: number, s: number, l: number): string {
    return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
}

class GlobalColorSynth extends Synthesizer {
    protected engine: VisualObjectEngine;
    private affectedNoteIds: Set<string> = new Set(); // Track notes that started during color shift periods
    private lastFrameTime: number = -1; // Track the previous frame time to detect note starts

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
    }

    clone(): this {
        const cloned = new GlobalColorSynth() as this;
        this.properties.forEach((prop, key) => {
            cloned.setPropertyValue(key, prop.value);
        });
        // Clone the affected notes set and last frame time
        cloned.affectedNoteIds = new Set(this.affectedNoteIds);
        cloned.lastFrameTime = this.lastFrameTime;
        return cloned;
    }

    // This synth doesn't produce its own visuals
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return [];
    }

    private initializeProperties(): void {
        this.properties.set('hueRange', new Property<ColorRange>(
            'hueRange',
            { startHue: 0, endHue: 360 },
            { label: 'Global Hue Range', uiType: 'colorRange' }
        ));
        this.properties.set('colorIntensity', new Property<number>(
            'colorIntensity',
            0.5,
            { label: 'Color Override Intensity', uiType: 'slider', min: 0.0, max: 1.0, step: 0.05 }
        ));
        this.properties.set('saturationBoost', new Property<number>(
            'saturationBoost',
            20,
            { label: 'Saturation Boost', uiType: 'slider', min: -50, max: 50, step: 5 }
        ));
        this.properties.set('brightnessBoost', new Property<number>(
            'brightnessBoost',
            10,
            { label: 'Brightness Boost', uiType: 'slider', min: -50, max: 50, step: 5 }
        ));
        this.properties.set('velocityEffect', new Property<number>(
            'velocityEffect',
            30,
            { label: 'Velocity Color Effect', uiType: 'slider', min: 0, max: 100, step: 5 }
        ));
        this.properties.set('targetTrackIds', new Property<string[]>(
            'targetTrackIds', 
            [],
            { label: 'Target Tracks', uiType: 'trackSelector' }
        ));
    }

    // The core logic: applies color modification to all visuals based on this track's MIDI
    applyGlobalModification(
        processedTracks: ProcessedTrackVisuals[], 
        time: number, 
        midiBlocks: MIDIBlock[], 
        bpm: number
    ): ProcessedTrackVisuals[] {
        const colorIntensity = this.getPropertyValue<number>('colorIntensity') ?? 0.5;
        
        // If intensity is 0, don't modify anything
        if (colorIntensity === 0) {
            return processedTracks;
        }

        const range = this.getPropertyValue<ColorRange>('hueRange') ?? { startHue: 0, endHue: 360 };
        const saturationBoost = this.getPropertyValue<number>('saturationBoost') ?? 20;
        const brightnessBoost = this.getPropertyValue<number>('brightnessBoost') ?? 10;
        const velocityEffect = this.getPropertyValue<number>('velocityEffect') ?? 30;
        
        // Get target track IDs array
        const targetIds = this.getPropertyValue<string[]>('targetTrackIds') ?? [];
        const targetAll = targetIds.length === 0;

        // Calculate current dominant pitch and velocity from active notes
        let dominantPitch = 60; // Default middle C
        let dominantVelocity = 64; // Default medium velocity
        let activeNoteCount = 0;
        let totalPitch = 0;
        let totalVelocity = 0;

        const secondsPerBeat = 60 / bpm;
        const currentTimeSec = time * secondsPerBeat;
        
        // Track which color shift notes are currently active
        let hasActiveColorShiftNote = false;

        midiBlocks.forEach(block => {
            const blockAbsoluteStartBeat = block.startBeat;
            block.notes.forEach(note => {
                const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
                const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;
                const noteStartSec = noteAbsoluteStartBeat * secondsPerBeat;
                const noteEndSec = noteAbsoluteEndBeat * secondsPerBeat;

                // Check if note is currently active
                if (currentTimeSec >= noteStartSec && currentTimeSec <= noteEndSec) {
                    hasActiveColorShiftNote = true;
                    totalPitch += note.pitch;
                    totalVelocity += note.velocity;
                    activeNoteCount++;
                }
            });
        });
        
        // If no color shift notes are active, don't modify colors but keep the affected notes set
        if (!hasActiveColorShiftNote) {
            this.lastFrameTime = time;
            return processedTracks;
        }
        
        // Track notes from other tracks that started during this color shift period
        if (hasActiveColorShiftNote) {
            processedTracks.forEach(trackData => {
                if (targetAll || targetIds.includes(trackData.trackId)) {
                    trackData.visuals.forEach(visual => {
                        if (visual.id) {
                            // Extract note ID from visual ID (format is typically trackId-noteId or trackId-noteId-index)
                            const parts = visual.id.split('-');
                            if (parts.length >= 2) {
                                const noteId = parts[1];
                                
                                // Check if this note just started (appeared this frame) while color shift is active
                                // We'll add all visible notes during color shift periods
                                // In a more sophisticated implementation, we'd track note start times
                                this.affectedNoteIds.add(noteId);
                            }
                        }
                    });
                }
            });
        }

        if (activeNoteCount > 0) {
            dominantPitch = totalPitch / activeNoteCount;
            dominantVelocity = totalVelocity / activeNoteCount;
        }

        // Calculate target hue based on dominant pitch
        const pitchClass = dominantPitch % 12;
        const normalizedPitchClass = pitchClass / 11;
        
        let targetHue: number;
        const rangeSize = range.endHue - range.startHue;
        
        if (rangeSize >= 0) {
            targetHue = range.startHue + normalizedPitchClass * rangeSize;
        } else {
            const wrappedRangeSize = 360 + rangeSize;
            targetHue = range.startHue + normalizedPitchClass * wrappedRangeSize;
        }
        
        targetHue = ((targetHue % 360) + 360) % 360;

        // Velocity affects the color shift intensity
        const velocityMultiplier = MappingUtils.mapValue(dominantVelocity, 0, 127, 0.3, 1.0);
        const effectiveIntensity = colorIntensity * velocityMultiplier;

        // Apply modification to targeted tracks
        const modifiedProcessedTracks = processedTracks.map(trackData => {
            // Check if this track is targeted
            if (targetAll || targetIds.includes(trackData.trackId)) {
                // Apply color modification to visuals of this track
                const modifiedVisuals = trackData.visuals.map(visual => {
                    // Check if this visual corresponds to a note that started during a color shift period
                    let shouldApplyColorShift = false;
                    if (visual.id) {
                        const parts = visual.id.split('-');
                        if (parts.length >= 2) {
                            const noteId = parts[1];
                            shouldApplyColorShift = this.affectedNoteIds.has(noteId);
                        }
                    }
                    
                    // If this visual shouldn't be affected, return it unchanged
                    if (!shouldApplyColorShift) {
                        return visual;
                    }
                    
                    // Parse current color
                    const currentHSL = parseHSL(visual.color);
                    
                    // Blend hue towards target hue
                    let newHue = currentHSL.h;
                    const hueDiff = targetHue - currentHSL.h;
                    const shortestHueDiff = ((hueDiff + 180) % 360) - 180;
                    newHue = currentHSL.h + (shortestHueDiff * effectiveIntensity);
                    newHue = ((newHue % 360) + 360) % 360;
                    
                    // Apply saturation and brightness boosts
                    let newSaturation = currentHSL.s + saturationBoost;
                    let newLightness = currentHSL.l + brightnessBoost;
                    
                    // Add velocity-based brightness variation
                    const velocityBrightness = MappingUtils.mapValue(dominantVelocity, 0, 127, -velocityEffect/2, velocityEffect/2);
                    newLightness += velocityBrightness * effectiveIntensity;
                    
                    // Clamp values
                    newSaturation = Math.max(0, Math.min(100, newSaturation));
                    newLightness = Math.max(0, Math.min(100, newLightness));
                    
                    const newColor = hslToString(newHue, newSaturation, newLightness);
                    
                    // Also modify emissive color if it exists
                    let newEmissive = visual.emissive;
                    if (visual.emissive) {
                        const emissiveHSL = parseHSL(visual.emissive);
                        let emissiveHue = emissiveHSL.h;
                        const emissiveHueDiff = targetHue - emissiveHSL.h;
                        const emissiveShortestHueDiff = ((emissiveHueDiff + 180) % 360) - 180;
                        emissiveHue = emissiveHSL.h + (emissiveShortestHueDiff * effectiveIntensity);
                        emissiveHue = ((emissiveHue % 360) + 360) % 360;
                        
                        newEmissive = hslToString(emissiveHue, emissiveHSL.s, emissiveHSL.l);
                    }

                    return {
                        ...visual,
                        color: newColor,
                        emissive: newEmissive
                    };
                });
                
                return { ...trackData, visuals: modifiedVisuals };
            } else {
                return trackData;
            }
        });

        // Update last frame time
        this.lastFrameTime = time;
        
        return modifiedProcessedTracks;
    }
}

export default GlobalColorSynth;