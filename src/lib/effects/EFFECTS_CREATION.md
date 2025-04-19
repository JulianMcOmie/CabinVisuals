# Creating New Visual Effects

This guide explains how to add a new visual effect to the application.

## Core Concepts

*   **Effects Modify VisualObjects:** Effects are applied sequentially to tracks. Each effect receives an array of `VisualObject` instances from the previous stage (either the synthesizer or the preceding effect) and returns a new array of potentially modified or entirely new `VisualObject` instances.
*   **Immutability:** Effects should treat the incoming objects and their properties as immutable. Always create new objects or new property objects when making changes, rather than modifying the input directly. This prevents unintended side effects between different parts of the processing pipeline.
*   **Properties:** Effects can have configurable parameters defined using the `Property` class, similar to synthesizers. These properties are exposed in the UI.

## Steps

1.  **Create the Effect Class:**
    *   Create a new `.ts` file in the `src/lib/effects/` directory (e.g., `MyNewEffect.ts`).
    *   Define a class that extends `Effect` (from `../Effect`).

    ```typescript
    import Effect from '../Effect';
    import { VisualObject } from '../types';
    import { Property } from '../properties/Property';
    // Import other necessary types or utilities

    class MyNewEffect extends Effect {
        constructor() {
            super();
            this.initializeProperties();
        }

        // Optional: Helper for defining properties
        private initializeProperties(): void {
            // Define properties here (see step 2)
        }

        // Required: Apply the effect logic
        applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
            const outputObjects: VisualObject[] = [];

            // --- Your effect logic here --- 
            // Iterate through input `objects`
            // Create modified/new objects
            // Add them to `outputObjects`
            // Remember IMMUTABILITY!

            return outputObjects;
        }

        // Required: Clone the effect instance
        clone(): this {
             // Implement cloning logic (see step 3)
             const cloned = new MyNewEffect() as this;
             this.properties.forEach((prop, key) => {
                 const clonedProp = cloned.properties.get(key);
                 if (clonedProp) {
                     clonedProp.value = prop.value;
                 }
             });
             return cloned;
        }
    }

    export default MyNewEffect;
    ```

2.  **Define Properties (`initializeProperties` or `constructor`):**
    *   If your effect needs configuration, define `Property` instances in the `constructor` or a helper like `initializeProperties`.
    *   Use `this.properties.set('propertyName', new Property<Type>(...))`.
    *   Provide appropriate metadata (`label`, `uiType`, `min`, `max`, `step`, etc.) for UI generation.
    *   Access property values within `applyEffect` using `this.getPropertyValue<Type>('propertyName')`.

    ```typescript
    // Inside initializeProperties:
    this.properties.set('intensity', new Property<number>(
        'intensity',
        1.0, 
        { label: 'Effect Intensity', uiType: 'slider', min: 0, max: 5, step: 0.1 }
    ));
    ```

3.  **Implement `applyEffect`:**
    *   This is the core logic.
    *   Receive the `objects` array, `time`, and `bpm`.
    *   Get necessary property values using `this.getPropertyValue()`.
    *   **Crucially:** Iterate through the input `objects`. For each object you modify or replace, create a *new* object using the spread operator (`{...obj}`) and a *new* properties object (`properties: {...obj.properties}`). Modify the properties of this *new* object.
    *   **IMPORTANT: If modifying nested mutable properties like `position`, `scale`, or `rotation` (which are arrays), ensure you create *new* arrays for the modified object** (e.g., `position: [newX, newY, newZ]` or `scale: [...originalScale]`). Directly modifying `obj.properties.position[0]` violates immutability.
    *   If creating multiple objects from one input (like duplication), generate the new objects.
    *   Return a *new* array containing the resulting objects.

    ```typescript
    // Inside applyEffect:
    const intensity = this.getPropertyValue<number>('intensity') ?? 1.0;
    
    return objects.map(obj => {
        // Create a new object structure
        const newObj: VisualObject = {
            ...obj,
            // Create a new properties object
            properties: {
                ...obj.properties,
                // Modify a property based on the effect
                opacity: (obj.properties.opacity ?? 1.0) * intensity,
                // Example: If modifying position, create a new array
                position: obj.properties.position ? [...obj.properties.position] : [0, 0, 0] // Clone or default
            }
        };
        // Example: Modify the cloned position 
        if (newObj.properties.position) {
            newObj.properties.position[0] += time; // OK to modify newObj's position array
        }
        return newObj;
    });
    ```

4.  **Implement `clone`:**
    *   This method is vital for ensuring each effect instance on a track has its own state.
    *   Create a new instance of your effect class: `new MyNewEffect() as this`.
    *   Iterate through the `this.properties` of the original instance.
    *   For each property, set the corresponding property value on the `cloned` instance.
    *   Return the `cloned` instance.
    *   *(The example in the Step 1 template shows a typical implementation)*.

5.  **Register in `effectSlice.ts`:**
    *   Import your new effect class at the top of `src/store/effectSlice.ts`.
    *   Add an entry to the `availableEffectsData` object, placing it under a suitable category (`Transform`, `Time`, `Spatial`, `Color`, etc.).

    ```typescript
    // In src/store/effectSlice.ts
    import MyNewEffect from '../lib/effects/MyNewEffect'; // Import Step
    
    export const availableEffectsData: EffectCategories = {
      Transform: [
        // ... other effects
      ],
      MyCategory: [ // Or add to existing category
        // ... other effects
        { id: 'MyNewEffect', name: 'My New Effect', constructor: MyNewEffect }, // Add Step
      ],
      // ... other categories
    };
    ```

Now your effect will be available in the UI to be added to tracks. 