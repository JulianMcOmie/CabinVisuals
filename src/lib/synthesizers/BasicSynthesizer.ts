import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
// Import Engine and related components
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

// ADSR envelope parameters are now managed by properties
// interface ADSREnvelope { ... } // No longer needed here

class BasicSynthesizer extends Synthesizer {
  // No need for private members like baseSize, adsr anymore
  // private baseSize: number = 2;
  // private adsr: ADSREnvelope;

  constructor() {
    super();
    this.initializeProperties();
    // Initialize the engine *after* properties are set up
    this.engine = new VisualObjectEngine(this);
    this.initializeEngine(); // Define engine rules
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
       // Add a property for Y Range if desired
       ['yRange', new Property<number>('yRange', 10, {
        uiType: 'slider', label: 'Y Range', min: 1, max: 20, step: 0.5
       })],
       ['yMin', new Property<number>('yMin', -5, {
           uiType: 'slider', label: 'Y Min', min: -10, max: 0, step: 0.5
       })],
    ]);
  }

  // Define object generation rules using the engine
  private initializeEngine(): void {
    const MUtils = MappingUtils; // Alias for convenience

    this.engine.defineObject('cube') // Initial object type is 'cube'
      .applyADSR((noteCtx: NoteContext) => ({ // Added type: NoteContext
        attack: this.getPropertyValue<number>('attack') ?? 0.01,
        decay: this.getPropertyValue<number>('decay') ?? 0.1,
        sustain: this.getPropertyValue<number>('sustain') ?? 0.5,
        release: this.getPropertyValue<number>('release') ?? 0.1,
      }))
      .withPosition((ctx: MappingContext) => { // Added type: MappingContext
        const yRange = this.getPropertyValue<number>('yRange') ?? 10;
        const yMin = this.getPropertyValue<number>('yMin') ?? -5;
        const pitchFraction = ctx.note.pitch / 127;
        const yPosition = yMin + pitchFraction * yRange;
        const xPosition = 0;
        const zPosition = 0;
        return [xPosition, yPosition, zPosition];
      })
      .withScale((ctx: MappingContext) => { // Added type: MappingContext
        const baseSize = this.getPropertyValue<number>('baseSize') ?? 1;
        const amplitude = ctx.adsrAmplitude ?? 0; // ADSR amplitude from context
        const noteMod12 = ctx.note.pitch % 12;
        const heightFactor = 0.5 + (noteMod12 / 11) * 1.0; // Apply height factor based on note
        const baseObjectSize = baseSize * (ctx.note.velocity / 127) * amplitude;

        // Return scale [sx, sy, sz]
        return [
            baseObjectSize,
            baseObjectSize * heightFactor, // Apply height factor to Y scale
            baseObjectSize
        ];
      })
      .withColor((ctx: MappingContext) => { // Added type: MappingContext
         // Replicate the HSL calculation from the old pitchAndYToColor
         const pitch = ctx.note.pitch;
         const yRange = this.getPropertyValue<number>('yRange') ?? 10;
         const yMin = this.getPropertyValue<number>('yMin') ?? -5;

         // Recalculate yPosition (as calculated in withPosition mapper)
         const pitchFraction = pitch / 127;
         const yPosition = yMin + pitchFraction * yRange;

         const hue = (pitch % 12) * 30;
         const octave = Math.floor(pitch / 12);
         const baseLightness = 55 + Math.min(octave * 4, 25); // 55-80% range

         // Map calculated yPosition to influence lightness (-1 to 1 influence approx)
         const yInfluence = MUtils.mapValue(yPosition, yMin, yMin + yRange, -1, 1, true);
         const lightness = Math.max(40, Math.min(95, baseLightness + yInfluence * 20)); // Clamp 40-95%
         const saturation = 80;

         return `hsl(${hue.toFixed(0)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%)`;
      })
      .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 0); // Added type: MappingContext
  }


  // No longer needed - logic moved to engine definition
  // private pitchAndYToColor(pitch: number, yInfluence: number): string { ... }

  // No longer needed - ADSR handled by engine
  // private calculateAmplitude(currentTime: number, noteStartTime: number, noteEndTime: number, bpm: number): number { ... }


  // getObjectsAtTime now simply delegates to the engine
  getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
    return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
  }

  // --- Implementation of clone method ---
  clone(): this {
    // Create a new instance - constructor will re-initialize properties and engine
    const cloned = new BasicSynthesizer() as this;

    // Deep copy the *current* property values from the original to the clone
    this.properties.forEach((property, name) => {
       // Get the corresponding property on the clone (which was initialized with defaults)
       const clonedProperty = cloned.properties.get(name);
       if (clonedProperty) {
           // Set the clone's property value to the original's current value
           clonedProperty.value = property.value;
       }
    });

    // The clone's engine is already initialized in its constructor with the correct 'this' context
    // and the default property values. The loop above updates the property values to match the original.
    // The engine definitions (closures) in the clone correctly reference the clone's 'this.properties'.

    return cloned;
  }
}

export default BasicSynthesizer; 