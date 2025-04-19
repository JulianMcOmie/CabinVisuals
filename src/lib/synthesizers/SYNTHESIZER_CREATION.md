# Creating a New Synthesizer

This guide outlines the steps to create a new visual synthesizer for the application.

## Core Steps

1.  **Subclass `Synthesizer`**:
    *   Create a new `.ts` file in `src/lib/synthesizers/`.
    *   Define a class that extends `Synthesizer` (from `../Synthesizer`).
    *   Make sure the `engine` property is `protected` to match the base class.

    ```typescript
    import Synthesizer from '../Synthesizer';
    import { MIDIBlock, VisualObject } from '../types';
    import { Property } from '../properties/Property';
    import VisualObjectEngine, { MappingContext, NoteContext, MappingUtils } from '../VisualObjectEngine';

    class MyNewSynth extends Synthesizer {
        protected engine: VisualObjectEngine; // Must be protected

        constructor() {
            super();
            this.initializeProperties();
            this.engine = new VisualObjectEngine(this);
            this.initializeEngine();
        }

        // Required methods
        clone(): this {
             // Implement cloning logic
             const cloned = new MyNewSynth() as this;
             this.properties.forEach((prop, key) => {
                 const originalProp = this.properties.get(key);
                 if (originalProp) {
                     cloned.setPropertyValue(key, originalProp.value);
                 }
             });
             return cloned;
        }

        getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
             return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
        }

        // Helper for defining properties
        private initializeProperties(): void {
            // Define properties here (see step 2)
        }

        // Helper for defining engine rules
        private initializeEngine(): void {
            // Define engine rules here (see step 3)
        }
    }

    export default MyNewSynth;
    ```

2.  **Define Properties (`initializeProperties`)**:
    *   Use the `Property` class (from `../properties/Property`) and its subclasses (e.g., `ColorProperty`, `SliderProperty`) to define configurable parameters.
    *   Store these properties in the `this.properties` map within the `initializeProperties` method.
    *   Properties are accessed within mappers using `this.getPropertyValue('propertyName')`.

    ```typescript
    // Inside initializeProperties method:
    this.properties.set('baseColor', new Property<string>(
        'baseColor',
        '#ffffff',
        { label: 'Base Color', uiType: 'color' } 
    ));
    this.properties.set('sizeMultiplier', new Property<number>(
        'sizeMultiplier',
        1.0, 
        { label: 'Size Multiplier', uiType: 'slider', min: 0.1, max: 5, step: 0.1 } 
    ));
    ```

3.  **Configure `VisualObjectEngine` (`initializeEngine`)**:
    *   In `initializeEngine`, use `this.engine.defineObject()` to start defining how MIDI notes map to visual objects.
    *   Chain methods like `.withPosition`, `.withColor`, `.withScale`, etc., providing *mapper functions*.
    *   Mapper functions receive a `MappingContext` (import from `../VisualObjectEngine`) and return the calculated value for the property. They run with the `Synthesizer` instance as `this`.
    *   Access utility functions via `MappingUtils` (import from `../VisualObjectEngine`).

    ```typescript
    // Inside initializeEngine method:
    this.engine.defineObject('sphere')
        .withPosition((ctx: MappingContext) => [
            MappingUtils.mapPitchToRange(ctx.note.pitch, -5, 5), 
            0,
            0
        ])
        .withColor((ctx: MappingContext) => this.getPropertyValue('baseColor') ?? '#ff0000') 
        .withScale((ctx: MappingContext) => {
            const baseSize = this.getPropertyValue('sizeMultiplier') ?? 1;
            // Example: Simple scaling with note velocity
            const scale = baseSize * MappingUtils.mapValue(ctx.note.velocity, 0, 127, 0.5, 1.5); 
            return [scale, scale, scale];
        })
        // Example: Simple opacity fade over note duration
        .withOpacity((ctx: MappingContext) => {
            return 1.0 - ctx.noteProgressPercent; // Fades from 1 to 0
        });
    ```

4.  **Register in `instrumentSlice.ts`**:
    *   Import your new synth class in `src/store/instrumentSlice.ts`.
    *   Add an entry to the `availableInstrumentsData` object under the appropriate category.

    ```typescript
    // In src/store/instrumentSlice.ts
    import MyNewSynth from '../lib/synthesizers/MyNewSynth'; // Import Step

    export const availableInstrumentsData: InstrumentCategories = {
      Melodic: [
        // ... other synths
        { id: 'MyNewSynth', name: 'My New Synth', constructor: MyNewSynth }, // Add Step
      ],
      Percussive: [
        // ... other synths
      ],
    };
    ```

## `VisualObjectEngine` Tips

*   **Implicit Instance**: By default, `defineObject` creates *one* visual object per triggering MIDI note.
*   **`.when(conditionFn)`**: Use this *before* defining mappings if the entire object definition should only apply to notes meeting specific criteria (e.g., certain pitch range). Rarely needed.
*   **`.forEachInstance(generatorFn)`**: Use this to create *multiple* visual objects from a *single* MIDI note. 
    *   The `generatorFn` runs *after* the parent level's mappers are calculated. It receives the parent's `MappingContext` as its argument (let's call it `parentCtx`).
    *   Inside the generator, access the parent's calculated properties via `parentCtx.calculatedProperties` (e.g., `parentCtx.calculatedProperties.position`).
    *   It should return an array of `InstanceData` objects (`{ [key: string]: any }`). Each object represents one new instance, and the data within is passed to the child level.
    *   Mappings defined *after* `.forEachInstance` apply to these new child instances and receive their own `MappingContext` (let's call it `childCtx`), which contains the corresponding `instanceData` via `childCtx.instanceData`.
*   **Modifiers (`applyADSR`, `applyPhysicsEnvelope`)**: These apply modifications based on note timing or physics simulations.
    *   `applyADSR`: Takes an `ADSRConfig` or a function returning one (`ADSRConfigFn`). Provides `ctx.adsrAmplitude` (0-1) and `ctx.adsrPhase` in subsequent mapping functions. Useful for controlling properties like opacity or scale based on a traditional envelope.
    *   `applyPhysicsEnvelope`: **Note:** The current implementation runs a **damped harmonic oscillator** simulation (`PhysicsUtils.calculateDampedOscillator`). It takes a `PhysicsEnvelopeConfig` (or function returning one) with `tension`, `friction`, and `initialVelocity`. The cumulative result of this simulation across all triggering notes is available in `ctx.physicsValue`. This is useful for springy/oscillating effects, but **not** for simple gravity/lifetime simulations.
        *   **For simple fades or motion:** It's often easier to implement these directly in mappers (e.g., `withOpacity`, `withPosition`) using `ctx.timeSinceNoteStart`, `ctx.noteProgressPercent`, and synthesizer properties (like a custom `lifetime` property), rather than using `applyPhysicsEnvelope`.

*   **Note on Object Properties:** The engine provides common `.with...` methods. Not all potential `VisualObject` properties (like `emissiveIntensity`) have dedicated methods. Setting these requires post-processing.

*   **Post-Processing for Complex Properties:** For properties not handled by the engine's built-in mappers (e.g., `emissive`, `emissiveIntensity`), override the `getObjectsAtTime` method in your synthesizer:
    1.  Call `this.engine.getObjectsAtTime(...)` to get the base visual objects.
    2.  Iterate over the returned objects.
    3.  For each object, calculate and add/modify the missing properties (e.g., setting `emissive` based on `color`, and `emissiveIntensity` based on a synth property and `opacity`).
    4.  Return the modified array.

    ```typescript
    // Example overriding getObjectsAtTime for emissive glow
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        const baseObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    
        const processedObjects = baseObjects.map(obj => {
            // Ensure required base properties exist
            if (!obj.properties || obj.properties.opacity === undefined || !obj.properties.color) {
                return obj; 
            }
    
            const baseIntensity = this.getPropertyValue<number>('glowIntensityProp') ?? 1.0;
            // Prevent glow when opacity is effectively zero
            const effectiveOpacity = obj.properties.opacity < 0.01 ? 0 : obj.properties.opacity;
            const intensity = baseIntensity * effectiveOpacity;
    
            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    emissive: obj.properties.color, // Use object color for glow
                    emissiveIntensity: intensity    // Scale glow with opacity
                }
            };
        });
    
        return processedObjects;
    }
    ```

### Dynamic Pitch Range Mapping

If you need mapping based on the lowest/highest notes *currently* being processed, calculate min/max pitch in `getObjectsAtTime` and use them in your mapper, as `MappingUtils.mapPitchToRange` assumes a fixed range.

```typescript
// -- Inside MyNewSynth class --
private _minPitch: number | null = null;
private _maxPitch: number | null = null;

getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
    // 1. Find min/max pitch from active notes in midiBlocks at 'time'
    let minP: number | null = null;
    let maxP: number | null = null;
    const secondsPerBeat = 60 / bpm;
    midiBlocks.forEach(block => {
        const blockStartSec = block.startBeat * secondsPerBeat;
        block.notes.forEach(note => {
            const noteStartSec = (block.startBeat + note.startBeat) * secondsPerBeat;
            const noteEndSec = noteStartSec + (note.duration * secondsPerBeat);
            const currentSec = time * secondsPerBeat;
            // Check if note is active at the current time
            if (currentSec >= noteStartSec && currentSec < noteEndSec) {
                if (minP === null || note.pitch < minP) minP = note.pitch;
                if (maxP === null || note.pitch > maxP) maxP = note.pitch;
            }
        });
    });
    this._minPitch = minP;
    this._maxPitch = maxP;

    // 2. Call the engine (which will use the updated _minPitch, _maxPitch in mappers)
    const visualObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);

    // 3. Optional: Post-process if needed (like the emissive example)
    // ...

    return visualObjects; 
}

// In initializeEngine:
this.engine.defineObject('someObject')
    .withPosition((ctx: MappingContext) => {
        const targetMinY = -5; 
        const targetMaxY = 5;
        let yPos = (targetMinY + targetMaxY) / 2; // Default to center

        if (this._minPitch !== null && this._maxPitch !== null && this._minPitch !== this._maxPitch) {
            const pitch = ctx.note.pitch;
            const normalizedPitch = (pitch - this._minPitch) / (this._maxPitch - this._minPitch);
            yPos = targetMinY + normalizedPitch * (targetMaxY - targetMinY);
        } 
        // Clamp yPos just in case
        yPos = Math.max(targetMinY, Math.min(targetMaxY, yPos));
        
        return [0, yPos, 0]; 
    })
    // ... other mappers ...
```    