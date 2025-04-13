import { MIDIBlock, VisualObject } from './types';
import { Property } from './properties/Property';
import VisualObjectEngine from './VisualObjectEngine';

abstract class Synthesizer {
  // Map to store configurable properties
  public properties: Map<string, Property<any>> = new Map();
  protected engine!: VisualObjectEngine; // Non-null assertion, initialized in subclass

  // Abstract method for getting visual objects
  abstract getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[];

  // Abstract method for cloning the synthesizer instance
  abstract clone(): this;

  // Method to set a property value (used on clones)
  public setPropertyValue<T>(name: string, value: T): void {
    const property = this.properties.get(name) as Property<T> | undefined;
    if (property) {
      property.value = value;
    } else {
      console.warn(`Property "${name}" not found on synthesizer.`);
    }
  }
  
  // Helper to get a property value safely
  protected getPropertyValue<T>(name: string): T | undefined {
    const property = this.properties.get(name) as Property<T> | undefined;
    return property?.value;
  }
}

export default Synthesizer; 