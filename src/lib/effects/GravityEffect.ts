import Effect from '../Effect';
import { VisualObject } from '../types';
import { Property, NumericMetadata } from '../properties/Property';

/**
 * An effect that applies a constant directional acceleration (gravity-like) to objects,
 * modifying their velocity and position over time.
 */
class GravityEffect extends Effect {
  constructor() {
    super();
    this.properties.set('gravityX', new Property<number>(
      'gravityX', 0, 
      { 
        label: 'Gravity X', description: 'X component of the gravity vector',
        min: -5, max: 5, step: 0.1, uiType: 'slider'
      } as NumericMetadata & { uiType: 'slider' }
    ));
    this.properties.set('gravityY', new Property<number>(
      'gravityY', -1.0, 
      { 
        label: 'Gravity Y', description: 'Y component of the gravity vector',
        min: -5, max: 5, step: 0.1, uiType: 'slider'
      } as NumericMetadata & { uiType: 'slider' }
    ));
    this.properties.set('gravityZ', new Property<number>(
      'gravityZ', 0, 
      { 
        label: 'Gravity Z', description: 'Z component of the gravity vector',
        min: -5, max: 5, step: 0.1, uiType: 'slider'
      } as NumericMetadata & { uiType: 'slider' }
    ));
    // Renamed from acceleration to gravityStrength for clarity
    this.properties.set('gravityStrength', new Property<number>(
      'gravityStrength', 0.05, 
      { 
        label: 'Gravity Strength', description: 'Scales the acceleration applied per step',
        min: 0, max: 1, step: 0.01, uiType: 'slider'
      } as NumericMetadata & { uiType: 'slider' }
    ));
  }

  /**
   * Applies the gravity acceleration effect.
   * @param objects The incoming array of VisualObjects.
   * @param time The current time (unused).
   * @param bpm The current bpm (unused).
   * @returns An array of objects with potentially modified positions and velocities.
   */
  applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
    const gx = this.getPropertyValue<number>('gravityX') ?? 0;
    const gy = this.getPropertyValue<number>('gravityY') ?? -1.0;
    const gz = this.getPropertyValue<number>('gravityZ') ?? 0;
    const strength = this.getPropertyValue<number>('gravityStrength') ?? 0.05;

    // If strength is zero, no effect
    if (strength === 0) {
      return objects;
    }

    // Calculate acceleration vector to apply this step
    const accelStepX = gx * strength;
    const accelStepY = gy * strength;
    const accelStepZ = gz * strength;

    return objects.map(originalObject => {
      // Shallow clone
      const clone: VisualObject = {
        ...originalObject,
        properties: { ...originalObject.properties }
      };

      const currentPos = clone.properties.position ?? [0, 0, 0];
      const currentVel = clone.properties.velocity ?? [0, 0, 0]; // Default velocity to [0,0,0]
      
      // Calculate new velocity
      const newVelX = currentVel[0] + accelStepX;
      const newVelY = currentVel[1] + accelStepY;
      const newVelZ = currentVel[2] + accelStepZ;

      // Calculate new position using new velocity (Euler integration)
      const newPosX = currentPos[0] + newVelX;
      const newPosY = currentPos[1] + newVelY;
      const newPosZ = currentPos[2] + newVelZ;

      // Update clone's properties
      clone.properties.velocity = [newVelX, newVelY, newVelZ];
      clone.properties.position = [newPosX, newPosY, newPosZ];

      return clone;
    });
  }

  /**
   * Creates a clone of the GravityEffect instance.
   * @returns A new instance with the same property values.
   */
  clone(): this {
    const newInstance = new GravityEffect() as this;
    this.properties.forEach((prop, key) => {
      newInstance.properties.set(key, prop.clone());
    });
    return newInstance;
  }
}

export default GravityEffect; 