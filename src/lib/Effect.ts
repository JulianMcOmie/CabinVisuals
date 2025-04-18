import { VisualObject } from './types';
import { Property } from './properties/Property';

/**
 * Abstract base class for all visual effects.
 * Effects take a stream of VisualObjects and modify them based on their properties and the current time/bpm.
 */
abstract class Effect {
  // Map to store configurable properties for the effect
  public properties: Map<string, Property<any>> = new Map();

  /**
   * Abstract method that subclasses must implement to apply the effect logic.
   * @param objects The incoming array of VisualObjects.
   * @param time The current time in the sequence (e.g., in beats or seconds).
   * @param bpm The current tempo of the sequence.
   * @returns An array of modified VisualObjects.
   */
  abstract applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[];

  /**
   * Abstract method for creating a clone of the effect instance.
   * This is crucial for maintaining unique state for each effect instance in the application.
   * @returns A new instance of the effect, typically with the same initial property values.
   */
  abstract clone(): this;

  /**
   * Sets the value of a specific property on this effect instance.
   * @param name The name of the property to set.
   * @param value The new value for the property.
   */
  public setPropertyValue<T>(name: string, value: T): void {
    const property = this.properties.get(name) as Property<T> | undefined;
    if (property) {
      property.value = value;
    } else {
      console.warn(`Property "${name}" not found on effect.`);
    }
  }

  /**
   * Helper method to safely retrieve the current value of a property.
   * @param name The name of the property to get.
   * @returns The current value of the property, or undefined if the property doesn't exist.
   */
  protected getPropertyValue<T>(name: string): T | undefined {
    const property = this.properties.get(name) as Property<T> | undefined;
    return property?.value;
  }
}

export default Effect; 