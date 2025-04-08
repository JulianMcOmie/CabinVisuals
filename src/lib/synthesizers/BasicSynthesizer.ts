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
  private size: number = 1;
  private adsr: ADSREnvelope;

  constructor(size: number = 1) {
    super();
    this.size = size;
    
    // Default ADSR envelope values
    this.adsr = {
      attack: 0.1,   // 100ms attack
      decay: 0.2,    // 200ms decay
      sustain: 0.7,  // 70% sustain level
      release: 0.3   // 300ms release
    };
  }
  
  // Map MIDI pitch (0-127) to a color
  private pitchToColor(pitch: number): string {
    // Map pitch to hue (0-360)
    const hue = (pitch % 12) * 30; // Each semitone shifts hue by 30 degrees
    
    // Map octave to lightness (higher octave = brighter)
    const octave = Math.floor(pitch / 12);
    const lightness = 40 + Math.min(octave * 5, 40); // 40-80% lightness range
    
    // Use a fairly saturated color
    const saturation = 75;
    
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
    
    // Calculate where we are in the ADSR envelope
    const noteDuration = noteEndTime - noteStartTime;
    const noteDurationSec = noteDuration * secondsPerBeat;
    
    // Attack phase
    if (timeFromStart < this.adsr.attack) {
      return (timeFromStart / this.adsr.attack);
    }
    
    // Decay phase
    if (timeFromStart < this.adsr.attack + this.adsr.decay) {
      const decayProgress = (timeFromStart - this.adsr.attack) / this.adsr.decay;
      return 1.0 - ((1.0 - this.adsr.sustain) * decayProgress);
    }
    
    // Sustain phase
    if (timeToEnd > this.adsr.release) {
      return this.adsr.sustain;
    }
    
    // Release phase
    return (this.adsr.sustain * (timeToEnd / this.adsr.release));
  }

  getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
    const objects: VisualObject[] = [];
    
    // Process all MIDI blocks
    midiBlocks.forEach(block => {
      if (time >= block.startBeat && time <= block.endBeat) {
        // Process all notes in the block
        block.notes.forEach(note => {
          const noteStartTime = note.startBeat;
          const noteEndTime = note.startBeat + note.duration;
          
          // Check if the current time is within the note (plus release time)
          if (time >= noteStartTime && time <= noteEndTime + (this.adsr.release * bpm / 60)) {
            // Calculate amplitude based on ADSR envelope
            const amplitude = this.calculateAmplitude(time, noteStartTime, noteEndTime, bpm);
            
            // Skip rendering if amplitude is too low
            if (amplitude < 0.01) return;
            
            // Convert MIDI pitch to a position in 3D space
            // Lower notes to the left, higher notes to the right
            // Normalize pitch to a reasonable range (-5 to 5)
            const normalizedPitch = ((note.pitch - 60) / 24) * 5; // 60 = middle C, 24 semitones = 2 octaves
            
            // Map velocity to size
            const objectSize = this.size * (note.velocity / 100) * amplitude;
            
            // Map pitch to color
            const color = this.pitchToColor(note.pitch);
            
            // Create a cube for the note
            objects.push({
              type: 'cube',
              properties: {
                position: [normalizedPitch, 0, 0],
                rotation: [time * 0.2, time * 0.3, 0],
                scale: [objectSize, objectSize, objectSize],
                color: color
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