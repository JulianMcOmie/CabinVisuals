import BasicSynthesizer from './BasicSynthesizer';
import { VisualObject, MIDINote, VisualObjectProperties } from '../types';

// Define a scale factor for vertical movement per semitone
const VERTICAL_SCALE_FACTOR = 0.2;
// Define the interval for wrapping (2 octaves = 24 semitones)
const WRAPPING_INTERVAL = 24;

class PitchModulatedSynth extends BasicSynthesizer {
  constructor(options: any = {}) {
    // Pass options to the base class, potentially setting defaults if needed
    super({
      objectType: 'sphere', // Default to spheres for this synth
      baseSize: 0.4,       // Slightly smaller spheres
      color: '#ff88cc',     // Default pinkish color
      ...options // Allow overriding defaults
    });
  }

  /**
   * Generates visual objects for a specific MIDI note at a given time.
   * Overrides the base method to add pitch-based vertical modulation.
   * @param note The MIDI note being processed.
   * @param noteStartTime The start time of the note in beats.
   * @param noteDuration The duration of the note in beats.
   * @param currentTime The current time in beats.
   * @param bpm The current beats per minute.
   * @returns An array of VisualObject representing the note, or null if inactive.
   */
  getObjectsForNote(
    note: MIDINote,
    noteStartTime: number,
    noteDuration: number,
    currentTime: number,
    bpm: number
  ): VisualObject[] | null {
    // Get the base visual object(s) from the BasicSynthesizer
    const baseObjects = super.getObjectsForNote(note, noteStartTime, noteDuration, currentTime, bpm);

    if (!baseObjects || baseObjects.length === 0) {
      return null; // Note is not active or base class returned nothing
    }

    // We assume the base class returns one object per note for this synth
    const baseObject = baseObjects[0];
    if (!baseObject || !baseObject.properties) {
        console.warn("PitchModulatedSynth: Base object or properties missing.");
        return baseObjects; // Return base if structure is unexpected
    }

    // Calculate the vertical offset based on pitch, wrapped every WRAPPING_INTERVAL semitones
    const pitch = note.midiNote;
    // Use modulo to wrap the pitch within the interval
    const wrappedPitch = pitch % WRAPPING_INTERVAL;
    // Calculate the Y position based on the wrapped pitch and scale factor
    // We add this to the base position's Y calculated by the superclass
    const pitchBasedYOffset = wrappedPitch * VERTICAL_SCALE_FACTOR;

    // Get the base position calculated by BasicSynthesizer (handles X-axis movement)
    const basePosition = baseObject.properties.position ?? [0, 0, 0];

    // Create new properties with updated Y position
    const modulatedProperties: VisualObjectProperties = {
      ...baseObject.properties,
      position: [
        basePosition[0], // Keep X from base
        basePosition[1] + pitchBasedYOffset, // Add pitch offset to base Y
        basePosition[2]  // Keep Z from base
      ],
      // Ensure color is maintained (can be overridden by options)
      color: this.options.color || baseObject.properties.color || '#ffffff',
    };

    // Return a new VisualObject array with the modified properties
    return [
      {
        ...baseObject, // Spread other base object properties (like id, type, sourceNoteId)
        properties: modulatedProperties,
      },
    ];
  }
}

export default PitchModulatedSynth; 