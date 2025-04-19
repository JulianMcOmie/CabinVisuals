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
    import VisualObjectEngine, { MappingContext, NoteContext, MappingUtils } from '../VisualObjectEngine';

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
        .withColor((ctx: MappingContext) => this.getPropertyValue('baseColor') ?? '#ff0000') // Access property
        .withScale((ctx: MappingContext) => {
            const baseSize = this.getPropertyValue('sizeMultiplier') ?? 1;
            const scale = baseSize * (ctx.adsrAmplitude ?? 1); // Use ADSR if applied
            return [scale, scale, scale];
        })
        .applyADSR((noteCtx: NoteContext) => ({ 
            attack: 0.01, 
            decay: 0.2, 
            sustain: 0.5, 
            release: 0.5 
        }));
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

*   **Note on Object Properties:** The engine provides common `.with...` methods (e.g., `.withPosition`, `.withScale`, `.withColor`, `.withOpacity`). Not all potential `VisualObject` properties (like `emissiveIntensity`) have dedicated methods. Setting these might require using `.forEachInstance` and manually constructing parts of the object data, or potentially modifying the `VisualObjectEngine` itself.

*   **Post-Processing for Complex Properties:** For properties not handled by the engine's built-in mappers (e.g., `emissive`, `emissiveIntensity`), a common pattern is to override the `getObjectsAtTime` method in your synthesizer. Inside the override:
    1.  Call `this.engine.getObjectsAtTime(...)` to get the base visual objects processed by your defined mappers.
    2.  Iterate over the returned objects.
    3.  For each object, calculate and add the missing properties (e.g., setting `emissive` based on the object's `color`, and `emissiveIntensity` based on a synth property and the object's `opacity`).
    4.  Return the modified array of visual objects.

    ```typescript
    // Example overriding getObjectsAtTime
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        // (Optional: calculate min/max pitch here if needed for dynamic mapping)
        // ... 
    
        // Get base objects from the engine
        const baseObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    
        // Post-process to add emissive properties
        const processedObjects = baseObjects.map(obj => {
            if (!obj.properties || obj.properties.opacity === undefined || !obj.properties.color) {
                return obj; // Skip if essential properties are missing
            }
    
            const baseIntensity = this.getPropertyValue<number>('myGlowIntensityProp') ?? 1.0;
            const intensity = baseIntensity * obj.properties.opacity; 
    
            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    emissive: obj.properties.color, // Set emissive color based on object color
                    emissiveIntensity: intensity > 0.01 ? intensity : 0 // Set intensity based on property & opacity
                }
            };
        });
    
        return processedObjects;
    }
    ```

### Dynamic Pitch Range Mapping

If you need the position (or another property) to map dynamically based on the lowest and highest notes *currently* being processed, `MappingUtils.mapPitchToRange` might not suffice as it likely assumes a fixed input range (e.g., 0-127). In this case, you need to:

1.  Calculate the min/max pitch of the notes in the current `midiBlocks` within the `getObjectsAtTime` method and store them (e.g., in private class members `_minPitch`, `_maxPitch`).
2.  Implement the range mapping logic manually within your mapper function using these calculated min/max values.

```typescript
// In getObjectsAtTime method:
// ... calculate and store this._minPitch, this._maxPitch from midiBlocks ...

// In initializeEngine:
this.engine.defineObject('someObject')
    .withPosition((ctx: MappingContext) => {
        const targetMinY = -5; // Example target range
        const targetMaxY = 5;
        let yPos = 0; // Default position

        if (this._minPitch !== null && this._maxPitch !== null && this._minPitch !== this._maxPitch) {
            const pitch = ctx.note.pitch;
            const minPitch = this._minPitch;
            const maxPitch = this._maxPitch;
            // Normalize pitch within the calculated dynamic range (0 to 1)
            const normalizedPitch = (pitch - minPitch) / (maxPitch - minPitch);
            // Map normalized pitch to the target Y range
            yPos = targetMinY + normalizedPitch * (targetMaxY - targetMinY);
        } else if (this._minPitch !== null) {
            // Handle case with only one unique pitch (e.g., place at center)
            yPos = (targetMinY + targetMaxY) / 2;
        }
        // Clamp yPos just in case
        yPos = Math.max(targetMinY, Math.min(targetMaxY, yPos));
        
        return [0, yPos, 0]; // Return calculated position
    })
    // ... other mappers ...
```    