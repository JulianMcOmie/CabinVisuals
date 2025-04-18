import Effect from '../Effect';
import { VisualObject } from '../types';
import { Property, NumericMetadata } from '../properties/Property';
// Assuming VisualObject.scale is compatible with something like THREE.Vector3
// import { Vector3 } from 'three'; // Uncomment if Vector3 type check is needed

/**
 * An effect that scales visual objects uniformly.
 */
class ScaleEffect extends Effect {
  constructor() {
    super();
    // Initialize the 'scale' property
    this.properties.set('scale', new Property<number>(
      'scale', // name
      1.0,    // defaultValue
      {       // metadata
        label: 'Scale', 
        description: 'Uniform scaling factor',
        min: 0.1,
        max: 10,
        step: 0.1,
        uiType: 'slider' // Specify uiType
      } as NumericMetadata & { uiType: 'slider' } // Type assertion for metadata
    ));
  }

  /**
   * Applies the scaling effect to each visual object.
   * @param objects The incoming array of VisualObjects.
   * @param time The current time (unused in this effect).
   * @param bpm The current bpm (unused in this effect).
   * @returns An array of scaled VisualObjects.
   */
  applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
    const scaleValue = this.getPropertyValue<number>('scale') ?? 1.0;

    if (scaleValue === 1.0) {
      return objects;
    }

    return objects.map(object => {
      // Perform a shallow clone of the object and its properties
      const clone: VisualObject = { 
        ...object, 
        properties: { ...object.properties } 
      };

      // Check if scale exists and is an array of 3 numbers
      if (clone.properties.scale && Array.isArray(clone.properties.scale) && clone.properties.scale.length === 3) {
        // Apply scaling to the copied scale array
        clone.properties.scale = [
          clone.properties.scale[0] * scaleValue,
          clone.properties.scale[1] * scaleValue,
          clone.properties.scale[2] * scaleValue
        ];
      } else {
        // Optionally initialize scale if it doesn't exist, or just warn
        // clone.properties.scale = [scaleValue, scaleValue, scaleValue];
        console.warn('ScaleEffect: VisualObject does not have a compatible .properties.scale array.');
      }
      return clone;
    });
  }

  /**
   * Creates a clone of the ScaleEffect instance.
   * @returns A new ScaleEffect instance with the same property values.
   */
  clone(): this {
    const newInstance = new ScaleEffect() as this;
    // Copy property values (cloning properties ensures isolation)
    this.properties.forEach((prop, key) => {
      newInstance.properties.set(key, prop.clone());
    });
    return newInstance;
  }
}

export default ScaleEffect; 