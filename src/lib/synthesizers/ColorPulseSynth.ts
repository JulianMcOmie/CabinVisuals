import Synthesizer, { ProcessedTrackVisuals } from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import { VisualObject3D } from '../VisualizerManager';
import VisualObjectEngine from '../VisualObjectEngine';

// --- Color Conversion Helpers (Implementations) --- 

interface HSLColor { h: number; s: number; l: number; }
interface RGBColor { r: number; g: number; b: number; }

function hexToRgb(hex: string): RGBColor | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHsl({ r, g, b }: RGBColor): HSLColor {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSLColor): RGBColor {
    s /= 100; l /= 100;
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        h /= 360;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHex({ r, g, b }: RGBColor): string {
    const toHex = (c: number) => {
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Updated main conversion functions
function colorStringToHsl(colorStr: string): HSLColor | null {
    if (!colorStr) return null;
    if (colorStr.startsWith('#')) {
        const rgb = hexToRgb(colorStr);
        return rgb ? rgbToHsl(rgb) : null;
    } 
    // TODO: Add parsing for rgb() strings if needed
    console.warn('Only hex color strings supported currently', colorStr);
    return null;
}

function hslToHexString(hsl: HSLColor): string {
    const rgb = hslToRgb(hsl);
    return rgbToHex(rgb);
}

// --- ADSR Calculation Helper (Copied from PulseSynth - Can be moved to utils) ---
interface ADSRParams { attack: number; decay: number; sustain: number; release: number; }
function calculateADSRValue(currentTimeSec: number, noteStartSec: number, noteEndSec: number, config: ADSRParams): number {
    const { attack, decay, sustain, release } = config;
    const timeFromStart = currentTimeSec - noteStartSec;
    if (timeFromStart < 0) return 0;
    if (timeFromStart < attack) return attack > 0 ? Math.min(1.0, timeFromStart / attack) : 1.0;
    const decayStartTime = attack;
    if (timeFromStart < decayStartTime + decay) {
        const decayProgress = decay > 0 ? (timeFromStart - decayStartTime) / decay : 1.0;
        return Math.max(0, 1.0 - ((1.0 - sustain) * decayProgress));
    }
    const noteDurationSec = noteEndSec - noteStartSec;
    // Check if currentTime is still within note duration for sustain
     if (timeFromStart <= noteDurationSec) { // Use duration check
        return sustain;
    }
    const timeIntoRelease = currentTimeSec - noteEndSec;
    if (timeIntoRelease > 0 && timeIntoRelease < release) {
        return Math.max(0, release > 0 ? (sustain * (1.0 - (timeIntoRelease / release))) : 0);
    }
    return 0;
}
// --- End ADSR Helper ---

class ColorPulseSynth extends Synthesizer {
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
    }

    clone(): this {
        const cloned = new ColorPulseSynth() as this;
        this.properties.forEach((prop, key) => {
            const originalProp = this.properties.get(key);
            if (originalProp) {
                cloned.setPropertyValue(key, originalProp.value);
            }
        });
        return cloned;
    }

    private initializeProperties(): void {
        this.properties.set('hueRotationStrength', new Property<number>(
            'hueRotationStrength', 90.0, { label: 'Hue Rotation Strength (°)', uiType: 'slider', min: -360, max: 360, step: 1 }
        ));
        this.properties.set('emissiveBoostStrength', new Property<number>(
            'emissiveBoostStrength', 1.0, { label: 'Emissive Boost Strength', uiType: 'slider', min: 0.0, max: 5.0, step: 0.05 }
        ));
        // ADSR for Emissive Boost
        this.properties.set('attackTime', new Property<number>(
            'attackTime', 0.02, { label: 'Boost Attack (s)', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('decayTime', new Property<number>(
            'decayTime', 0.1, { label: 'Boost Decay (s)', uiType: 'slider', min: 0.0, max: 2.0, step: 0.01 }
        ));
        this.properties.set('sustainLevel', new Property<number>(
            'sustainLevel', 0.7, { label: 'Boost Sustain Level', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('releaseTime', new Property<number>(
            'releaseTime', 0.4, { label: 'Boost Release (s)', uiType: 'slider', min: 0.0, max: 3.0, step: 0.01 }
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
        time: number, 
        midiBlocks: MIDIBlock[], 
        bpm: number
    ): ProcessedTrackVisuals[] { 
        // --- Get properties and calculate time --- 
        const hueRotationStrength = this.getPropertyValue<number>('hueRotationStrength') ?? 90.0;
        const emissiveBoostStrength = this.getPropertyValue<number>('emissiveBoostStrength') ?? 1.0;
        const adsrParams: ADSRParams = {
            attack: this.getPropertyValue<number>('attackTime') ?? 0.02,
            decay: this.getPropertyValue<number>('decayTime') ?? 0.1,
            sustain: this.getPropertyValue<number>('sustainLevel') ?? 0.7,
            release: this.getPropertyValue<number>('releaseTime') ?? 0.4,
        };
        const targetIds = this.getPropertyValue<string[]>('targetTrackIds') ?? [];
        const targetAll = targetIds.length === 0;
        const secondsPerBeat = 60 / bpm;
        const currentTimeSec = time * secondsPerBeat;

        // --- Find Highest Active Note for Hue Target --- 
        let highestActivePitch: number | null = null;
        midiBlocks.forEach(block => {
            const blockAbsoluteStartBeat = block.startBeat;
            block.notes.forEach(note => {
                const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
                const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;
                const noteStartSec = noteAbsoluteStartBeat * secondsPerBeat;
                const noteEndSec = noteAbsoluteEndBeat * secondsPerBeat;
                if (currentTimeSec >= noteStartSec && currentTimeSec < noteEndSec) {
                    if (highestActivePitch === null || note.pitch > highestActivePitch) {
                        highestActivePitch = note.pitch;
                    }
                }
            });
        });
        
        // --- Calculate Combined ADSR Amplitude (for both effects) --- 
        let combinedAmplitude = 0;
        midiBlocks.forEach(block => {
            const blockAbsoluteStartBeat = block.startBeat;
            block.notes.forEach(note => {
                const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
                const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;
                const noteStartSec = noteAbsoluteStartBeat * secondsPerBeat;
                const noteEndSec = noteAbsoluteEndBeat * secondsPerBeat;
                if (currentTimeSec >= noteStartSec - adsrParams.attack && 
                    currentTimeSec < noteEndSec + adsrParams.release) 
                {
                    combinedAmplitude += calculateADSRValue(currentTimeSec, noteStartSec, noteEndSec, adsrParams);
                }
            });
        });
        combinedAmplitude = Math.max(0, combinedAmplitude); // Clamp >= 0
        // Optional: Cap amplitude to 1? 
        // combinedAmplitude = Math.min(1, combinedAmplitude);

        // --- Calculate Actual Effect Values based on Amplitude --- 
        let actualHueShift = 0;
        if (highestActivePitch !== null) {
            const pitchClass = highestActivePitch % 12; // 0-11
            const pitchHueMultiplier = pitchClass / 12.0; // 0.0 to < 1.0
            const maxShiftForNote = hueRotationStrength * pitchHueMultiplier;
            actualHueShift = maxShiftForNote * combinedAmplitude; // Modulate amount by ADSR
        }
        const addedEmissiveIntensity = emissiveBoostStrength * combinedAmplitude;
        const applyHueShift = highestActivePitch !== null && combinedAmplitude > 0.001; // Only shift if note active and envelope has value

        // --- Apply Modifications --- 
        const modifiedProcessedTracks = processedTracks.map(trackData => {
            if (!targetAll && !targetIds.includes(trackData.trackId)) {
                return trackData;
            }

            const modifiedVisuals = trackData.visuals.map(visual => {
                let finalColor = visual.color;
                let finalEmissiveColor = visual.color;

                // Apply Hue Rotation if applicable
                if (applyHueShift) {
                    const originalHsl = colorStringToHsl(visual.color);
                    if (originalHsl) {
                        const newHue = (originalHsl.h + actualHueShift) % 360;
                        const finalHsl: HSLColor = {
                            ...originalHsl,
                            h: newHue < 0 ? newHue + 360 : newHue
                        };
                        finalColor = hslToHexString(finalHsl);
                        finalEmissiveColor = finalColor; 
                    } else {
                         // console.warn("Could not parse color:", visual.color); // Reduced logging
                         finalEmissiveColor = finalColor;
                    }
                } else {
                     finalEmissiveColor = finalColor; // Default emissive to current color if no shift
                }

                // Apply Emissive Boost
                const originalIntensity = visual.emissiveIntensity ?? 0;
                const newEmissiveIntensity = Math.max(0, originalIntensity + addedEmissiveIntensity);

                return {
                    ...visual,
                    color: finalColor,
                    emissive: finalEmissiveColor,
                    emissiveIntensity: newEmissiveIntensity
                };
            });

            return { ...trackData, visuals: modifiedVisuals };
        });

        return modifiedProcessedTracks;
    }
}

export default ColorPulseSynth; 