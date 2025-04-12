import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';

// ADSR envelope parameters - tuned for drums
interface ADSREnvelope {
  attack: number;  // seconds
  decay: number;   // seconds
  sustain: number; // level (0-1)
  release: number; // seconds
}

class DrumSynthesizer extends Synthesizer {
  private baseZ: number = -15; // Base distance (further back)
  private zRange: number = 10;  // How much pitch affects distance (e.g., -15 +/- 5)
  private baseScaleMultiplier: number = 4; // Base size multiplier (larger spheres)
  private scaleRange: number = 2; // How much pitch affects size (e.g., 4 +/- 1)
  private adsr: ADSREnvelope;

  constructor() {
    super();

    // ADSR tuned for a percussive feel (quick attack, fast decay, short release)
    this.adsr = {
      attack: 0.01,
      decay: 0.1,
      sustain: 0.1, // Low sustain for percussive hits
      release: 0.15
    };
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
    const secondsPerBeat = 60 / bpm;
    const noteStartSec = noteStartTime * secondsPerBeat;
    const noteEndSec = noteEndTime * secondsPerBeat;
    const currentTimeSec = currentTime * secondsPerBeat;

    const timeFromStart = currentTimeSec - noteStartSec;
    const timeToEnd = noteEndSec - currentTimeSec;

    if (timeFromStart < 0) return 0;

    if (timeFromStart < this.adsr.attack) {
      return (timeFromStart / this.adsr.attack);
    }

    if (timeFromStart < this.adsr.attack + this.adsr.decay) {
      const decayProgress = (timeFromStart - this.adsr.attack) / this.adsr.decay;
      return 1.0 - ((1.0 - this.adsr.sustain) * decayProgress);
    }

    const noteDurationSec = (noteEndTime - noteStartTime) * secondsPerBeat;
     if (currentTimeSec <= noteEndSec) { // Still sustaining within the note duration
         // Check if sustain phase duration is positive
        const sustainStartTime = noteStartSec + this.adsr.attack + this.adsr.decay;
        if (currentTimeSec >= sustainStartTime) {
             return this.adsr.sustain;
        } // else, still in attack/decay, handled above
    }

    const timeIntoRelease = currentTimeSec - noteEndSec;
    if (timeIntoRelease > 0 && timeIntoRelease < this.adsr.release) {
         // Ensure sustain level is used for release calculation start point
         return (this.adsr.sustain * (1.0 - (timeIntoRelease / this.adsr.release)));
    }

    return 0;
  }

  getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
    const objects: VisualObject[] = [];
    const secondsPerBeat = 60 / bpm;

    // Process all MIDI blocks
    midiBlocks.forEach(block => {
      const blockAbsoluteStartBeat = block.startBeat;
      const blockAbsoluteEndBeat = block.endBeat; // Assuming MIDIBlock has endBeat

      // Check if the current time is within the block's potential influence range
       const blockEndTimeWithRelease = blockAbsoluteEndBeat + (this.adsr.release * bpm / 60);
      if (time >= blockAbsoluteStartBeat && time <= blockEndTimeWithRelease) {

        // Process all notes in the block
        block.notes.forEach(note => {
          const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
          const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;

           // Check if the current time is within the note's active range (start to end + release)
           const noteEndTimeWithRelease = noteAbsoluteEndBeat + (this.adsr.release / secondsPerBeat);
          if (time >= noteAbsoluteStartBeat && time <= noteEndTimeWithRelease) {

            const amplitude = this.calculateAmplitude(time, noteAbsoluteStartBeat, noteAbsoluteEndBeat, bpm);

            // Skip rendering if amplitude is effectively zero
            if (amplitude < 0.001) return;

            // --- Visual Property Calculations ---

            // Map pitch (0-127) to a fraction (0-1)
            const pitchFraction = note.pitch / 127;

            // Z position: Maps pitch (0-1) to a range around baseZ.
            // Lower pitch = more negative Z (further away)
            const zPosition = this.baseZ - (this.zRange / 2) + (pitchFraction * this.zRange);

            // Scale: Maps pitch (0-1) to a range around baseScaleMultiplier.
            // Lower pitch = larger size.
            // Modulated by velocity and ADSR amplitude.
            const pitchScaleFactor = this.baseScaleMultiplier + (this.scaleRange / 2) - (pitchFraction * this.scaleRange);
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
}

export default DrumSynthesizer;
