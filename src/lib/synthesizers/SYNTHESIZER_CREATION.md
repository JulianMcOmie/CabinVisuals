# Creating a New Synthesizer

This guide outlines the steps to create a new visual synthesizer for the application.

## Core Steps

1.  **Subclass `Synthesizer`**:
    *   Create a new `.ts` file in `src/lib/synthesizers/`.
    *   Define a class that extends `Synthesizer` (from `../Synthesizer`).

    ```typescript
    import Synthesizer from '../Synthesizer';
    import { MIDIBlock, VisualObject } from '../types';
    import { Property } from '../properties/Property';
    import VisualObjectEngine from '../VisualObjectEngine';

    class MyNewSynth extends Synthesizer {
        constructor() {
            super();
            this.initializeProperties();
            this.engine = new VisualObjectEngine(this);
            this.initializeEngine();
        }

        // Required methods (even if empty initially)
        clone(): this {
             // Implement cloning logic, typically creating a new instance
             // and copying property values.
             const cloned = new MyNewSynth() as this;
             this.properties.forEach((prop, key) => {
                 cloned.setPropertyValue(key, prop.value);
             });
             return cloned;
        }

        getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
             // This is where the VisualObjectEngine is typically used
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
    *   Use the `Property` class (from `../properties/Property`) to define configurable parameters.
    *   Store these properties in the `this.properties` map within the `initializeProperties` method.
    *   Properties are accessed within mappers using `this.getPropertyValue('propertyName')`.

    ```typescript
    // Inside initializeProperties method:
    this.properties.set('baseColor', new Property<string>(
        'baseColor',
        '#ffffff', // Default value
        { label: 'Base Color', uiType: 'color' } // Metadata
    ));
    this.properties.set('sizeMultiplier', new Property<number>(
        'sizeMultiplier',
        1.0, // Default value
        { label: 'Size Multiplier', uiType: 'slider', min: 0.1, max: 5, step: 0.1 } // Metadata
    ));
    ```

3.  **Configure `VisualObjectEngine` (`initializeEngine`)**:
    *   In `initializeEngine`, use `this.engine.defineObject()` to start defining how MIDI notes map to visual objects.
    *   Chain methods like `.withPosition`, `.withColor`, `.withScale`, etc., providing *mapper functions*.
    *   Mapper functions receive a `MappingContext` and return the calculated value for the property. They run with the `Synthesizer` instance as `this`.

    ```typescript
    // Inside initializeEngine method:
    this.engine.defineObject('sphere') // Initial object type
        .withPosition(ctx => [
            MappingUtils.mapPitchToRange(ctx.note.pitch, -5, 5), // Use utils or custom logic
            0,
            0
        ])
        .withColor(ctx => this.getPropertyValue('baseColor') ?? '#ff0000') // Access property
        .withScale(ctx => {
            const baseSize = this.getPropertyValue('sizeMultiplier') ?? 1;
            const scale = baseSize * (ctx.adsrAmplitude ?? 1); // Use ADSR if applied
            return [scale, scale, scale];
        })
        .applyADSR({ attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.5 }); // Optional ADSR
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

*   **Implicit Instance**: By default, `defineObject` creates *one* visual object. To make this object change with MIDI notes, use modifiers like applyADSR or applyPhysicsEnvelope, and apply those modifiers to the desired property to be affected (e.g. opacity)
*   **`.when(conditionFn)`**: Use this *before* defining mappings if the entire object definition should only apply to notes meeting specific criteria (e.g., certain pitch range). Rarely needed.
*   **`.forEachInstance(generatorFn)`**: Use this to create *multiple* visual objects from a *single* MIDI note. Do not use this if you don't need this functionality - do NOT pass in a blank array to use this.
    *   The `generatorFn` runs *after* the parent level's mappings are calculated and receives the parent's `MappingContext`.
    *   It should return an array of `InstanceData` objects (`{ [key: string]: any }`). Each object represents one new instance.
    *   Mappings defined *after* `.forEachInstance` apply to these new child instances and can access the `instanceData` via `ctx.instanceData`.
*   **Modifiers (`applyADSR`, `applyPhysicsEnvelope`)**: These apply to the instances generated by the level *immediately preceding* the modifier call.
    *   `ctx.adsrAmplitude` (0-1) becomes available in subsequent mapping functions.
    *   `ctx.physicsValue` becomes available, representing the cumulative output of the physics simulation triggered by *all* notes matching the definition's `.when` condition. 