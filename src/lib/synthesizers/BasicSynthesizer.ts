import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';

// ADSR envelope parameters
interface ADSREnvelope {
  attack: number;  // seconds
  decay: number;   // seconds
  sustain: number; // level (0-1)
  release: number; // seconds
}

class BasicSynthesizer extends Synthesizer {
  private baseSize: number = 2; // Increased base size
  private adsr: ADSREnvelope;

  constructor(baseSize: number = 2) { // Updated default baseSize
    super();
    this.baseSize = baseSize;
    
    // Modified ADSR for a springier feel
    this.adsr = {
      attack: 0.05,  // Faster attack
      decay: 0.3,   // Longer decay
      sustain: 0.5, // Lower sustain
      release: 0.4  // Slightly longer release
    };
  }
  
  // Map MIDI pitch (0-127) and Y-position influence to a color
  private pitchAndYToColor(pitch: number, yInfluence: number): string {
    // Map pitch to hue (0-360)
    const hue = (pitch % 12) * 30; // Each semitone shifts hue by 30 degrees
    
    // Map octave to base lightness
    const octave = Math.floor(pitch / 12);
    const baseLightness = 55 + Math.min(octave * 4, 25); // Increased base brightness (55-80% range)
    
    // Add Y influence to lightness (e.g., +/- 10%)
    const lightness = Math.max(40, Math.min(95, baseLightness + yInfluence * 20)); // Clamp lightness
    
    // Use a fairly saturated color
    const saturation = 80; // Slightly more saturation
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
  
  // Calculate amplitude based on ADSR envelope and note timing
  private calculateAmplitude(currentTime: number, noteStartTime: number, noteEndTime: number, bpm: number): number {
    // Convert beats to seconds
    const secondsPerBeat = 60 / bpm;
    const noteStartSec = noteStartTime * secondsPerBeat;
    const noteEndSec = noteEndTime * secondsPerBeat;
    const currentTimeSec = currentTime * secondsPerBeat;
    
    // Time relative to note start and end
    const timeFromStart = currentTimeSec - noteStartSec;
    const timeToEnd = noteEndSec - currentTimeSec;
    
    // Clamp timeFromStart to avoid issues before attack
    if (timeFromStart < 0) return 0; 

    // Calculate where we are in the ADSR envelope
    // Attack phase
    if (timeFromStart < this.adsr.attack) {
      return (timeFromStart / this.adsr.attack);
    }
    
    // Decay phase
    if (timeFromStart < this.adsr.attack + this.adsr.decay) {
      const decayProgress = (timeFromStart - this.adsr.attack) / this.adsr.decay;
      return 1.0 - ((1.0 - this.adsr.sustain) * decayProgress);
    }
    
    // Sustain phase - check if current time is before the start of the release phase
    const noteDurationSec = (noteEndTime - noteStartTime) * secondsPerBeat;
    if (currentTimeSec <= noteEndSec) { // Still sustaining within the note duration
         // Check if sustain phase duration is positive
        const sustainStartTime = noteStartSec + this.adsr.attack + this.adsr.decay;
        if (currentTimeSec >= sustainStartTime) {
             return this.adsr.sustain;
        } // else, still in attack/decay, handled above
    }
    
    // Release phase - starts *after* the note officially ends
    const timeIntoRelease = currentTimeSec - noteEndSec;
    if (timeIntoRelease > 0 && timeIntoRelease < this.adsr.release) {
         return (this.adsr.sustain * (1.0 - (timeIntoRelease / this.adsr.release)));
    }

    // Outside the envelope
    return 0;
  }

  getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
    const objects: VisualObject[] = [];
    const secondsPerBeat = 60 / bpm;
    
    // Process all MIDI blocks
    midiBlocks.forEach(block => {
      const blockAbsoluteStartBeat = block.startBeat;
      const blockAbsoluteEndBeat = block.endBeat; 

      // Check if the current time is within the block's potential influence range
      if (time >= blockAbsoluteStartBeat && time <= blockAbsoluteEndBeat + (this.adsr.release * bpm / 60)) {
        
        // Process all notes in the block
        block.notes.forEach(note => {
          const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
          const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;
          const noteDurationBeats = note.duration;
          const noteDurationSec = noteDurationBeats * secondsPerBeat;

          // Check if the current time is within the note's active range (start to end + release)
          if (time >= noteAbsoluteStartBeat && time <= noteAbsoluteEndBeat + (this.adsr.release / secondsPerBeat)) {
            
            const amplitude = this.calculateAmplitude(time, noteAbsoluteStartBeat, noteAbsoluteEndBeat, bpm);
            
            // Skip rendering if amplitude is effectively zero
            if (amplitude < 0.001) return;
            
            // --- Visual Property Calculations --- 

            // Y position based on sine wave within the note's duration
            const timeSinceNoteStartBeats = time - noteAbsoluteStartBeat;
            const progressWithinNote = noteDurationBeats > 0 ? Math.max(0, Math.min(1, timeSinceNoteStartBeats / noteDurationBeats)) : 0;
            const yPosition = Math.sin(progressWithinNote * Math.PI) * 2; // Oscillates between 0 and 2

            // Pitch mapping (remains the same)
            const normalizedPitch = ((note.pitch - 60) / 24) * 5;
            
            // Size based on base size, velocity, and amplitude
            const objectSize = this.baseSize * (note.velocity / 127) * amplitude; // Use 127 for velocity max
            
            // Color based on pitch and Y position influence
            const color = this.pitchAndYToColor(note.pitch, yPosition / 2); // Normalize yInfluence to 0-1

            // Opacity based on amplitude
            const opacity = amplitude;
            
            // Create a cube for the note
            objects.push({
              type: 'cube',
              properties: {
                position: [0, yPosition, 0], // Map pitch to X, sine wave to Y
                rotation: [0, 0, 0], // No rotation
                scale: [objectSize, objectSize, objectSize],
                color: color,
                opacity: opacity // Added opacity
              }
            });
          }
        });
      }
    });
    
    return objects;
  }
}

export default BasicSynthesizer; 