import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property, PropertyMap } from '../properties/Property';

// ADSR envelope parameters are now managed by properties
// interface ADSREnvelope { ... } // No longer needed here

class DrumSynthesizer extends Synthesizer {
  // No longer need these private members
  // private baseZ: number = -15;
  // private zRange: number = 10;
  // private baseScaleMultiplier: number = 4;
  // private scaleRange: number = 2;
  // private adsr: ADSREnvelope;

  constructor() {
    super();
    this.initializeProperties();
  }

  private initializeProperties(): void {
    this.properties = new Map<string, Property<any>>([
      ['baseZ', new Property<number>('baseZ', -15, {
        uiType: 'slider', label: 'Base Distance (Z)', min: -50, max: 0, step: 0.5
      })],
      ['zRange', new Property<number>('zRange', 10, {
        uiType: 'slider', label: 'Distance Range (Pitch Mod)', min: 0, max: 30, step: 0.5
      })],
      ['baseScaleMultiplier', new Property<number>('baseScaleMultiplier', 4, {
        uiType: 'slider', label: 'Base Size Multiplier', min: 0.1, max: 20, step: 0.1
      })],
      ['scaleRange', new Property<number>('scaleRange', 2, {
        uiType: 'slider', label: 'Size Range (Pitch Mod)', min: 0, max: 10, step: 0.1
      })],
      ['attack', new Property<number>('attack', 0.01, {
        uiType: 'slider', label: 'Attack (s)', min: 0.001, max: 1, step: 0.001
      })],
      ['decay', new Property<number>('decay', 0.1, {
        uiType: 'slider', label: 'Decay (s)', min: 0.001, max: 2, step: 0.001
      })],
      ['sustain', new Property<number>('sustain', 0.1, {
        uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01
      })],
      ['release', new Property<number>('release', 0.15, {
        uiType: 'slider', label: 'Release (s)', min: 0.001, max: 3, step: 0.001
      })],
    ]);
  }

  // Map MIDI pitch to a color (can be simpler for drums if needed)
  private pitchToColor(pitch: number): string {
    // Simple mapping: Hue cycles through octaves, fixed saturation/lightness
    const hue = (pitch % 12) * 30;
    const saturation = 70;
    const lightness = 60;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  // Calculate amplitude based on ADSR envelope and note timing (same as BasicSynthesizer)
  private calculateAmplitude(currentTime: number, noteStartTime: number, noteEndTime: number, bpm: number): number {
    const attack = this.getPropertyValue<number>('attack') ?? 0.01;
    const decay = this.getPropertyValue<number>('decay') ?? 0.1;
    const sustain = this.getPropertyValue<number>('sustain') ?? 0.1;
    const release = this.getPropertyValue<number>('release') ?? 0.15;

    const secondsPerBeat = 60 / bpm;
    const noteStartSec = noteStartTime * secondsPerBeat;
    const noteEndSec = noteEndTime * secondsPerBeat;
    const currentTimeSec = currentTime * secondsPerBeat;

    const timeFromStart = currentTimeSec - noteStartSec;

    if (timeFromStart < 0) return 0;

    if (timeFromStart < attack) {
        return attack > 0 ? (timeFromStart / attack) : 1.0;
    }

    const decayStartTime = attack;
    if (timeFromStart < decayStartTime + decay) {
      const decayProgress = decay > 0 ? (timeFromStart - decayStartTime) / decay : 1.0;
      return 1.0 - ((1.0 - sustain) * decayProgress);
    }

    if (currentTimeSec <= noteEndSec) {
        const sustainStartTime = decayStartTime + decay;
        if (currentTimeSec >= sustainStartTime) {
            return sustain;
        }
    }

    const timeIntoRelease = currentTimeSec - noteEndSec;
    const releaseDuration = release;
    if (timeIntoRelease > 0 && timeIntoRelease < releaseDuration) {
        return releaseDuration > 0 ? (sustain * (1.0 - (timeIntoRelease / releaseDuration))) : 0;
    }

    return 0;
  }

  getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
    const objects: VisualObject[] = [];
    const secondsPerBeat = 60 / bpm;

    // Get properties
    const baseZ = this.getPropertyValue<number>('baseZ') ?? -15;
    const zRange = this.getPropertyValue<number>('zRange') ?? 10;
    const baseScaleMultiplier = this.getPropertyValue<number>('baseScaleMultiplier') ?? 4;
    const scaleRange = this.getPropertyValue<number>('scaleRange') ?? 2;
    const releaseTime = this.getPropertyValue<number>('release') ?? 0.15;

    // Process all MIDI blocks
    midiBlocks.forEach(block => {
      const blockAbsoluteStartBeat = block.startBeat;
      const blockAbsoluteEndBeat = block.endBeat; // Assuming MIDIBlock has endBeat

      // Check if the current time is within the block's potential influence range
       const blockEndTimeWithRelease = blockAbsoluteEndBeat + (releaseTime * bpm / 60);
      if (time >= blockAbsoluteStartBeat && time <= blockEndTimeWithRelease) {

        // Process all notes in the block
        block.notes.forEach(note => {
          const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
          const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;

           // Check if the current time is within the note's active range (start to end + release)
           const noteEndTimeWithRelease = noteAbsoluteEndBeat + (releaseTime / secondsPerBeat);
          if (time >= noteAbsoluteStartBeat && time <= noteEndTimeWithRelease) {

            const amplitude = this.calculateAmplitude(time, noteAbsoluteStartBeat, noteAbsoluteEndBeat, bpm);

            // Skip rendering if amplitude is effectively zero
            if (amplitude < 0.001) return;

            // --- Visual Property Calculations ---

            // Map pitch (0-127) to a fraction (0-1)
            const pitchFraction = note.pitch / 127;

            // Z position: Maps pitch (0-1) to a range around baseZ.
            // Lower pitch = more negative Z (further away)
            const zPosition = baseZ - (zRange / 2) + (pitchFraction * zRange);

            // Scale: Maps pitch (0-1) to a range around baseScaleMultiplier.
            // Lower pitch = larger size.
            // Modulated by velocity and ADSR amplitude.
            const pitchScaleFactor = baseScaleMultiplier + (scaleRange / 2) - (pitchFraction * scaleRange);
            const baseObjectSize = pitchScaleFactor * (note.velocity / 127) * amplitude;

            const objectScale: [number, number, number] = [
                baseObjectSize,
                baseObjectSize, // Sphere: Uniform scale
                baseObjectSize
            ];

            // Color based on pitch
            const color = this.pitchToColor(note.pitch);

            // Opacity based on amplitude
            const opacity = amplitude;

            // Create a sphere for the note
            objects.push({
              type: 'sphere', // Use sphere
              properties: {
                position: [0, 0, zPosition], // Fixed Y=0, pitch-based Z
                rotation: [0, 0, 0],
                scale: objectScale,
                color: color,
                opacity: opacity
              }
            });
          }
        });
      }
    });

    return objects;
  }

  // --- Implementation of clone method ---
  clone(): this {
    const cloned = new DrumSynthesizer() as this;
    cloned.properties = new Map();
    this.properties.forEach((property, name) => {
      cloned.properties.set(name, property.clone());
    });
    return cloned;
  }
}

export default DrumSynthesizer;
