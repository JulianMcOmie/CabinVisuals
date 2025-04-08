import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, VisualObjectProperties } from '../types';

// Configuration for a single drum sound
interface DrumConfig {
  pitch: number; // The MIDI note number that triggers this drum
  position: [number, number, number]; // Base position in 3D space
  baseScale: [number, number, number]; // Size when not reacting
  color: string; // Base color
  reactionDuration: number; // Duration of the visual reaction in beats
  minScaleFactor: number;   // How much it contracts (e.g., 0.5 = 50% of base size) at the moment of the hit
}

class DrumSynthesizer extends Synthesizer {
  private drumMappings: Map<number, DrumConfig>;

  constructor() {
    super();
    this.drumMappings = new Map();

    // --- Define Drum Mappings ---
    // Add configurations for different drum sounds (MIDI note numbers based on General MIDI standard)

    // Kick Drum (MIDI Note 36)
    this.drumMappings.set(36, {
      pitch: 36,
      position: [0, -2, -15], // Centered, low, moved back on Z axis
      baseScale: [5, 5, 5],   // Very large base size
      color: '#680000',      // Deep red
      reactionDuration: 0.15, // Quick reaction beats
      minScaleFactor: 0.3      // Contracts significantly
    });

    // Snare Drum (MIDI Note 38)
    this.drumMappings.set(38, {
      pitch: 38,
      position: [0, 1, -8],  // Centered, slightly up, further back than hats
      baseScale: [3, 3, 3],   // Medium size
      color: '#EFEFEF',      // Off-white
      reactionDuration: 0.1, // Very quick reaction beats
      minScaleFactor: 0.6      // Contracts less
    });

    // Closed Hi-Hat (MIDI Note 42)
    this.drumMappings.set(42, {
      pitch: 42,
      position: [4, 3, -5],   // To the right, high up, relatively forward
      baseScale: [1, 1, 1],    // Small size
      color: '#C0C0C0',      // Silver/light gray
      reactionDuration: 0.08, // Extremely quick reaction beats
      minScaleFactor: 0.7
    });

    // Open Hi-Hat (MIDI Note 46)
    this.drumMappings.set(46, {
      pitch: 46,
      position: [4.5, 3.5, -5.5], // Slightly different from closed HH
      baseScale: [1.2, 1.2, 1.2], // Slightly larger than closed HH
      color: '#E0E0E0',        // Lighter Silver
      reactionDuration: 0.25,   // Longer reaction beats than closed HH
      minScaleFactor: 0.65
    });

     // Low Tom (MIDI Note 45) - Example
     this.drumMappings.set(45, {
        pitch: 45,
        position: [-3, 0, -10],
        baseScale: [3, 3, 3],
        color: '#003366', // Dark Blue
        reactionDuration: 0.18,
        minScaleFactor: 0.5
      });

    // Crash Cymbal (MIDI Note 49) - Example
    this.drumMappings.set(49, {
      pitch: 49,
      position: [-5, 4, -12],
      baseScale: [4, 4, 0.5], // Thin but wide
      color: '#FFD700', // Gold
      reactionDuration: 0.5, // Long reaction beats
      minScaleFactor: 0.8 // Doesn't contract much, more of a shimmer/wobble visually
    });

    // Add more drum mappings here (e.g., Ride Cymbal: 51, High Tom: 50, etc.)
  }

  getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
    const objects: VisualObject[] = [];

    // Process all MIDI blocks
    midiBlocks.forEach(block => {
      const blockAbsoluteStartBeat = block.startBeat;

      // Process all notes in the block
      block.notes.forEach(note => {
        // Check if this MIDI note pitch corresponds to a configured drum sound
        const config = this.drumMappings.get(note.pitch);
        if (!config) {
          return; // Skip notes not mapped to drums
        }

        const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;

        // Calculate time since the note hit in beats
        const timeSinceHitBeats = time - noteAbsoluteStartBeat;

        // Check if we are within the reaction window for this drum hit
        // The visual reaction starts *exactly* at the note start and lasts for reactionDuration
        if (timeSinceHitBeats >= 0 && timeSinceHitBeats < config.reactionDuration) {

          // Calculate the progress through the reaction animation (0 to 1)
          const progress = timeSinceHitBeats / config.reactionDuration;

          // Calculate the current scale factor using an ease-out curve (e.g., quadratic)
          // Starts at minScaleFactor, quickly grows back towards 1.0
          const easeOutProgress = 1 - Math.pow(1 - progress, 2); // Quadratic ease-out
          const scaleFactor = config.minScaleFactor + (1 - config.minScaleFactor) * easeOutProgress;

          // Calculate the final scale based on base scale and current factor
          const currentScale: [number, number, number] = [
            config.baseScale[0] * scaleFactor,
            config.baseScale[1] * scaleFactor,
            config.baseScale[2] * scaleFactor
          ];

          // Opacity could fade out quickly too
          const opacity = 1.0 - progress; // Linear fade out during reaction

          // Create a sphere VisualObject for this drum hit
          objects.push({
            type: 'sphere', // Use sphere
            properties: {
              position: config.position,
              rotation: [0, 0, 0], // Drums don't rotate
              scale: currentScale,
              color: config.color,
              opacity: opacity
            }
          });
        }
        // --- Optional: Render persistent sphere ---
        // If you want the drum spheres to always be visible (even when not hit),
        // you could add an 'else' block here or a separate loop
        // to render them with baseScale and maybe low opacity when inactive.
        // For now, they only appear briefly when hit.
      });
    });

    return objects;
  }
}

// Need to export the class
export default DrumSynthesizer;
