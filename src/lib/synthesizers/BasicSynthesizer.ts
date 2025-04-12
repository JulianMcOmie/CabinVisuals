import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';

// ADSR envelope parameters are now managed by properties
// interface ADSREnvelope { ... } // No longer needed here

class BasicSynthesizer extends Synthesizer {
  // No need for private members like baseSize, adsr anymore
  // private baseSize: number = 2;
  // private adsr: ADSREnvelope;

  constructor() {
    super();
    this.initializeProperties();
  }

  private initializeProperties(): void {
    this.properties = new Map<string, Property<any>>([
      ['baseSize', new Property<number>('baseSize', 2, {
        uiType: 'slider', label: 'Base Size', min: 0.1, max: 10, step: 0.1
      })],
      ['attack', new Property<number>('attack', 0.05, {
        uiType: 'slider', label: 'Attack (s)', min: 0.001, max: 2, step: 0.001
      })],
      ['decay', new Property<number>('decay', 0.3, {
        uiType: 'slider', label: 'Decay (s)', min: 0.001, max: 2, step: 0.001
      })],
      ['sustain', new Property<number>('sustain', 0.5, {
        uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01
      })],
      ['release', new Property<number>('release', 0.4, {
        uiType: 'slider', label: 'Release (s)', min: 0.001, max: 5, step: 0.001
      })],
    ]);
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
    const attack = this.getPropertyValue<number>('attack') ?? 0.01;
    const decay = this.getPropertyValue<number>('decay') ?? 0.1;
    const sustain = this.getPropertyValue<number>('sustain') ?? 0.5;
    const release = this.getPropertyValue<number>('release') ?? 0.1;

    const secondsPerBeat = 60 / bpm;
    const noteStartSec = noteStartTime * secondsPerBeat;
    const noteEndSec = noteEndTime * secondsPerBeat;
    const currentTimeSec = currentTime * secondsPerBeat;
    
    const timeFromStart = currentTimeSec - noteStartSec;
    
    if (timeFromStart < 0) return 0; 

    // Attack phase
    if (timeFromStart < attack) {
      // Avoid division by zero if attack is extremely small
      return attack > 0 ? (timeFromStart / attack) : 1.0;
    }
    
    // Decay phase
    const decayStartTime = attack;
    if (timeFromStart < decayStartTime + decay) {
      const decayProgress = decay > 0 ? (timeFromStart - decayStartTime) / decay : 1.0;
      return 1.0 - ((1.0 - sustain) * decayProgress);
    }
    
    // Sustain phase
    if (currentTimeSec <= noteEndSec) {
      const sustainStartTime = decayStartTime + decay;
      if (currentTimeSec >= sustainStartTime) {
           return sustain;
      } // else, still in attack/decay, handled above
    }
    
    // Release phase
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
    const baseSize = this.getPropertyValue<number>('baseSize') ?? 1;
    const releaseTime = this.getPropertyValue<number>('release') ?? 0.1;
    
    const yRange = 1; // Keep this fixed for now
    const yMin = -5;

    midiBlocks.forEach(block => {
      const blockAbsoluteStartBeat = block.startBeat;
      const blockAbsoluteEndBeat = block.endBeat; // Assume endBeat exists
      const blockEndTimeWithRelease = blockAbsoluteEndBeat + (releaseTime * bpm / 60);

      if (time >= blockAbsoluteStartBeat && time <= blockEndTimeWithRelease) {
        block.notes.forEach(note => {
          const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
          const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;
          const noteEndTimeWithRelease = noteAbsoluteEndBeat + (releaseTime / secondsPerBeat);

          if (time >= noteAbsoluteStartBeat && time <= noteEndTimeWithRelease) {
            const amplitude = this.calculateAmplitude(time, noteAbsoluteStartBeat, noteAbsoluteEndBeat, bpm);
            if (amplitude < 0.001) return;
            
            const xPosition = 0;
            const pitchFraction = note.pitch / 127;
            const yPosition = yMin + pitchFraction * yRange;

            const noteMod12 = note.pitch % 12;
            const heightFactor = 0.5 + (noteMod12 / 11) * 1.0;
            const baseObjectSize = baseSize * (note.velocity / 127) * amplitude;
            
            const objectScale: [number, number, number] = [
                baseObjectSize,
                baseObjectSize * heightFactor,
                baseObjectSize
            ];
            
            const color = this.pitchAndYToColor(note.pitch, yPosition); // Use calculated yPosition
            const opacity = amplitude;
            
            objects.push({
              type: 'cube',
              properties: {
                position: [xPosition, yPosition, 0],
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
    // Create a new instance of the same class
    const cloned = new BasicSynthesizer() as this;
    
    // Deep copy the properties map
    cloned.properties = new Map();
    this.properties.forEach((property, name) => {
      cloned.properties.set(name, property.clone());
    });

    return cloned;
  }
}

export default BasicSynthesizer; 