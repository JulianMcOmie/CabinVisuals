import Effect from '../Effect';
import { VisualObject } from '../types';
import { Property, NumericMetadata } from '../properties/Property';

/**
 * An effect that creates radial duplicates of incoming objects.
 */
class RadialDuplicateEffect extends Effect {
  constructor() {
    super();
    this.properties.set('numCopies', new Property<number>(
      'numCopies',
      3, // defaultValue
      {
        label: 'Copies',
        description: 'Number of duplicates to create',
        min: 1,
        max: 24,
        step: 1,
        uiType: 'slider'
      } as NumericMetadata & { uiType: 'slider' }
    ));
    this.properties.set('radius', new Property<number>(
      'radius',
      1.0, // defaultValue
      {
        label: 'Radius',
        description: 'Distance of duplicates from the original',
        min: 0.0,
        max: 10.0,
        step: 0.1,
        uiType: 'slider'
      } as NumericMetadata & { uiType: 'slider' }
    ));
  }

  /**
   * Applies the radial duplication effect.
   * @param objects The incoming array of VisualObjects.
   * @param time The current time (unused in this effect).
   * @param bpm The current bpm (unused in this effect).
   * @returns An array including original objects and their radial duplicates.
   */
  applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
    const numCopies = Math.floor(this.getPropertyValue<number>('numCopies') ?? 3);
    const radius = this.getPropertyValue<number>('radius') ?? 1.0;

    // If no copies or radius, return originals only
    if (numCopies <= 0 || radius <= 0) {
      return objects;
    }

    const outputObjects: VisualObject[] = [...objects]; // Start with originals

    objects.forEach(originalObject => {
      const originalPos = originalObject.properties.position ?? [0, 0, 0];

      for (let i = 0; i < numCopies; i++) {
        const angle = (i / numCopies) * 2 * Math.PI;
        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius;
        
        // Create a shallow clone for the duplicate
        const duplicate: VisualObject = {
          ...originalObject,
          properties: { ...originalObject.properties }
        };
        
        // Set the new position
        duplicate.properties.position = [
          originalPos[0] + offsetX,
          originalPos[1] + offsetY,
          originalPos[2]
        ];
        
        outputObjects.push(duplicate);
      }
    });

    return outputObjects;
  }

  /**
   * Creates a clone of the RadialDuplicateEffect instance.
   * @returns A new instance with the same property values.
   */
  clone(): this {
    const newInstance = new RadialDuplicateEffect() as this;
    this.properties.forEach((prop, key) => {
      newInstance.properties.set(key, prop.clone());
    });
    return newInstance;
  }
}

export default RadialDuplicateEffect; 