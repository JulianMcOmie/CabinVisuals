import { MIDIBlock, VisualObject } from './types';
import { Property } from './properties/Property';
import VisualObjectEngine from './VisualObjectEngine';
import { VisualObject3D } from './VisualizerManager';

// Data structure for passing track-specific visuals to global modification
export interface ProcessedTrackVisuals {
  trackId: string;
  visuals: VisualObject3D[];
}

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

  // Update signature and default implementation for applyGlobalModification
  public applyGlobalModification(
    processedTracks: ProcessedTrackVisuals[], 
    time: number, 
    midiBlocks: MIDIBlock[], // Own MIDI blocks
    bpm: number
  ): ProcessedTrackVisuals[] { // Return the same type
    // Default behavior: do nothing, pass through the track visuals data
    return processedTracks;
  }
}

export default Synthesizer; 