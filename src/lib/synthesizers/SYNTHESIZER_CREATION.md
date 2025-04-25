# Creating a New Visual Synthesizer

This guide outlines the steps to create a new visual synthesizer for the application.

## Core Steps

1.  **Subclass `Synthesizer`**:
    *   Create a new `.ts` file in `src/lib/synthesizers/`.
    *   Define a class that extends `Synthesizer` (from `../Synthesizer`).
    *   Make sure the `engine` property is `protected` to match the base class.
    *   Include a `clone()` method to duplicate the synthesizer state.

    ```typescript
    import Synthesizer from '../Synthesizer';
    import { MIDIBlock, VisualObject, MIDINote } from '../types';
    import { Property, PropertyMetadata } from '../properties/Property';
    import VisualObjectEngine, { 
        MappingContext, 
        NoteContext, 
        MappingUtils, 
        InstanceData, 
        ADSRConfig 
    } from '../VisualObjectEngine';

    // Optional: Define simple vector helpers if needed
    type Vec3Tuple = [number, number, number];
    const vec3Scale = (v: Vec3Tuple, s: number): Vec3Tuple => [v[0] * s, v[1] * s, v[2] * s];

    class MyNewSynth extends Synthesizer {
        protected engine: VisualObjectEngine; // Must be protected

        constructor() {
            super();
            this.initializeProperties();
            this.engine = new VisualObjectEngine(this);
            this.initializeEngine();
        }

        // Required method: Implement cloning logic for properties
        clone(): this {
             const cloned = new MyNewSynth() as this;
             this.properties.forEach((prop, key) => {
                 const originalProp = this.properties.get(key);
                 if (originalProp) {
                     cloned.setPropertyValue(key, originalProp.value);
                 }
             });
             return cloned;
        }

        // Required method: Let the engine handle object generation
        getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
             // ALWAYS delegate to the engine
             const baseObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);
             
             // OPTIONAL: Post-process baseObjects if needed (e.g., for emissive)
             // ... see Post-Processing section ...
             return baseObjects; 
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
    *   Use the base `Property<T>` class (from `../properties/Property`) for all properties.
    *   Provide the correct generic type (`Property<number>`, `Property<string>`).
    *   Pass a `PropertyMetadata` object as the third argument, ensuring you specify the `uiType` ('slider', 'color', 'numberInput', etc.) and other relevant fields (like `min`, `max`, `step` for sliders).
    *   Store these properties in the `this.properties` map.

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
    *   In `initializeEngine`, use `this.engine.defineObject('objectType')` to start defining a mapping.
    *   Chain methods like `.withPosition`, `.withOpacity`, `.withScale`, etc., providing *mapper functions*.
    *   **Mapper Functions (`(ctx: MappingContext) => Value`)**: 
        *   Receive a `MappingContext` object.
        *   Use `ctx` properties (see **MappingContext Details** below) and synthesizer properties (`this.getPropertyValue('propName')`) to calculate values.
        *   **Return simple types**: `string` for color, `number` for opacity, `[number, number, number]` tuples for position, scale, rotation. **Do NOT use `THREE.Vec3`**. Perform vector math manually or with helpers.
        *   The `this` keyword inside mappers refers to the `Synthesizer` instance.
    *   **Context Functions (`(noteCtx: NoteContext) => Config`)**: 
        *   Functions passed to modifiers like `applyADSR`, `applyPhysicsEnvelope`, or conditions like `when` receive a simpler `NoteContext` (containing just `note: MIDINote`).
        *   These determine *how* or *if* the modifier/condition applies to a specific note.
        *   `this` also refers to the `Synthesizer` instance here.
    *   Use utility functions via `MappingUtils` (e.g., `MappingUtils.mapValue`).

    ```typescript
    // Inside initializeEngine method:

    // Example: ADSR configuration function (uses NoteContext)
    const adsrConfigFn = (noteCtx: NoteContext): ADSRConfig => ({
        attack: this.getPropertyValue<number>('attackTime') ?? 0.01,
        decay: this.getPropertyValue<number>('decayTime') ?? 0.2,
        sustain: this.getPropertyValue<number>('sustainLevel') ?? 0.5,
        release: this.getPropertyValue<number>('releaseTime') ?? 0.5,
    });

    this.engine.defineObject('sphere') // Or 'cube', 'line', etc.
        .applyADSR(adsrConfigFn) // Apply modifier (uses NoteContext function)
        .withPosition((ctx: MappingContext): [number, number, number] => { // Mapper (uses MappingContext)
            // Access MappingContext properties
            const yPos = MappingUtils.mapPitchToRange(ctx.note.pitch, -5, 5); 
            // Access Synthesizer properties via `this`
            const zOffset = this.getPropertyValue<number>('depth') ?? 0;
            // Return a tuple
            return [0, yPos, zOffset * ctx.noteProgressPercent]; 
        })
        .withColor((ctx: MappingContext): string => { // Example color mapper
            return this.getPropertyValue<string>('baseColor') ?? '#ff0000';
        }) 
        .withScale((ctx: MappingContext): [number, number, number] => { // Example scale mapper
            const baseSize = this.getPropertyValue<number>('sizeMultiplier') ?? 1;
            const scale = baseSize * MappingUtils.mapValue(ctx.note.velocity, 0, 127, 0.5, 1.5);
            // Access ADSR value from context
            const adsrScale = ctx.adsrAmplitude !== undefined ? (0.1 + ctx.adsrAmplitude * 0.9) : 1.0; 
            const finalScale = scale * adsrScale;
            return [finalScale, finalScale, finalScale]; // Return a tuple
        })
        .withOpacity((ctx: MappingContext): number => {
            // Fade using ADSR amplitude from context
            return ctx.adsrAmplitude ?? 1.0; 
        });
    ```

4.  **Register in `instrumentSlice.ts`**:
    *   Import your new synth class in `src/store/instrumentSlice.ts`.
    *   Add an entry to the `availableInstrumentsData` object under the appropriate category ('Melodic' or 'Percussive').

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

## `VisualObjectEngine` Deep Dive

### Coordinate System Note

*   By convention in this application, the **XY plane** is generally aligned with the camera view.
*   **X** typically represents horizontal movement.
*   **Y** typically represents vertical movement.
*   **Z** typically represents depth (positive Z away from camera, negative Z towards camera).
*   Keep this in mind when defining `withPosition`, `withScale`, etc., returning `[x, y, z]` tuples.

### Context Objects

*   **`MappingContext` (for Mappers & Generators)**: Passed to functions defining *how* an object looks/behaves at a specific time.
    *   `note: MIDINote`: The original MIDI note triggering this object.
    *   `time: number`: Current global time (in beats).
    *   `bpm: number`: Current tempo.
    *   `noteAbsoluteStartBeat: number`: Absolute start beat of the note.
    *   `timeSinceNoteStart: number`: Time elapsed in seconds since the note started (can be negative during approach/lookahead phases).
    *   `noteProgressPercent: number`: Note duration progress (0 to 1), only valid when `timeSinceNoteStart >= 0`.
    *   `noteDurationSeconds: number`: Total duration of the note in seconds.
    *   `level: number`: Nesting depth (for `forEachInstance`).
    *   `instanceData: InstanceData`: Custom data passed from the `forEachInstance` generator.
    *   `parentContext?: MappingContext`: Context of the parent level (if nested).
    *   `adsrAmplitude?: number`: Current ADSR value (0-1), if `applyADSR` is used.
    *   `adsrPhase?: 'attack' | ... | 'idle'`: Current ADSR phase.
    *   `physicsValue?: number`: Current value from `applyPhysicsEnvelope`.
    *   `timeUntilNoteStart?: number`: Seconds *until* the note starts (used with `applyApproachEnvelope`).
    *   `calculatedProperties?: VisualObjectProperties`: Read-only view of properties calculated *before* the current mapper.
*   **`NoteContext` (for Modifier Configs & Conditions)**: Passed to functions determining *if* or *how* a modifier/condition applies per-note.
    *   `note: MIDINote`: The specific MIDI note being considered.

### Key Engine Methods

*   **`.defineObject(type: string)`**: Starts a new definition for a visual object type.
*   **`.when(conditionFn: (noteCtx: NoteContext) => boolean)`**: Conditionally applies the entire definition chain based on the note.
*   **`.applyADSR(config: ADSRConfig | ((noteCtx: NoteContext) => ADSRConfig))`**: Applies an Attack-Decay-Sustain-Release envelope. Makes `adsrAmplitude` and `adsrPhase` available in subsequent `MappingContext`.
*   **`.applyPhysicsEnvelope(...)`**: Applies a damped harmonic oscillator simulation. Makes `physicsValue` available. Often complex; consider manual animation in mappers for simpler effects.
*   **`.applyApproachEnvelope(...)`**: Allows objects to appear before the note starts. Makes `timeUntilNoteStart` available in `MappingContext` when `timeSinceNoteStart < 0`.
*   **`.forEachInstance(generatorFn: (parentCtx: MappingContext) => InstanceData[])`**: Creates multiple child objects from one parent/note trigger.
    *   `generatorFn` receives the parent `MappingContext`.
    *   It returns an array of `InstanceData` objects (e.g., `[{ id: 0, angle: 0 }, { id: 1, angle: Math.PI }]`).
    *   Mappers defined *after* `.forEachInstance` apply to the child instances.
    *   Child mappers receive their own `MappingContext`, which includes the corresponding `instanceData` from the generator.
*   **`.withPosition(mapperFn: (ctx: MappingContext) => [number, number, number])`**: Defines position.
*   **`.withScale(mapperFn: (ctx: MappingContext) => [number, number, number] | number)`**: Defines scale (tuple or uniform number).
*   **`.withRotation(mapperFn: (ctx: MappingContext) => [number, number, number])`**: Defines rotation (Euler angles in radians).
*   **`.withColor(mapperFn: (ctx: MappingContext) => string)`**: Defines color (e.g., hex string `#ffffff`).
*   **`.withOpacity(mapperFn: (ctx: MappingContext) => number)`**: Defines opacity (0-1).
*   **`.setType(type: string)`**: Changes the object type for the current level (overrides initial type or parent type).

### Post-Processing (`getObjectsAtTime` override)

*   The engine doesn't have built-in mappers for every possible `VisualObject` property (e.g., `emissive`, `emissiveIntensity`).
*   To set these, override `getObjectsAtTime` in your synthesizer:
    1.  Call `const baseObjects = this.engine.getObjectsAtTime(...)`.
    2.  Map over `baseObjects`: For each `obj`, calculate and add/modify the desired properties (e.g., `obj.properties.emissive = obj.properties.color; obj.properties.emissiveIntensity = intensity;`).
    3.  Return the modified array.

```typescript
// Example overriding getObjectsAtTime for emissive glow
getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
    const baseObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    const glowIntensity = this.getPropertyValue<number>('glowIntensityProp') ?? 1.0;

    const processedObjects = baseObjects.map(obj => {
        if (!obj.properties || obj.properties.opacity === undefined || !obj.properties.color) {
            return obj; 
        }
        const effectiveOpacity = Math.max(0, obj.properties.opacity);
        const intensity = glowIntensity * effectiveOpacity;

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

If mapping needs to adapt to the currently playing notes (e.g., map pitch across the *actual* range of active notes), you must calculate this range *before* calling the engine:

1.  In `getObjectsAtTime`, before calling `this.engine.getObjectsAtTime`, iterate through `midiBlocks` to find the min/max pitch of notes active at the current `time`.
2.  Store these min/max values in private class members (e.g., `this._minPitch`, `this._maxPitch`).
3.  In your relevant mapper function (e.g., `withPosition`), access these stored min/max values (`this._minPitch`) to perform the dynamic normalization/mapping.

(See original `SYNTHESIZER_CREATION.md` for a code example of dynamic pitch range calculation if needed).