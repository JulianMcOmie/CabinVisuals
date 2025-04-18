import Effect from '../Effect';
import { VisualObject } from '../types';
import { Property, NumericMetadata } from '../properties/Property';

// Interface for items stored in the buffer
interface BufferItem {
  object: VisualObject;
  emissionTime: number;
}

/**
 * A delay effect that creates time-delayed, fading copies of visual objects.
 */
class DelayEffect extends Effect {
  // Buffer to store objects that need to potentially generate echoes
  private objectBuffer: BufferItem[] = [];
  // A small time threshold to check for echo emission
  private timeThreshold = 0.01; // This might need tuning or a different approach

  constructor() {
    super();
    this.properties.set('delayTime', new Property<number>(
      'delayTime', 1.0, 
      { 
        label: 'Delay Time (beats)',
        description: 'Time between each echo in beats',
        min: 0.1, max: 10, step: 0.1,
        uiType: 'slider'
      } as NumericMetadata & { uiType: 'slider' }
    ));
    this.properties.set('feedback', new Property<number>(
      'feedback', 0.5, 
      { 
        label: 'Feedback',
        description: 'Opacity multiplier per echo (0=no echoes, 1=full opacity)',
        min: 0.0, max: 0.99, step: 0.05, // Max slightly below 1 to avoid infinite full opacity
        uiType: 'slider'
      } as NumericMetadata & { uiType: 'slider' }
    ));
    this.properties.set('maxCopies', new Property<number>(
      'maxCopies', 5, 
      { 
        label: 'Max Echoes',
        description: 'Maximum number of echoes per object',
        min: 1, max: 20, step: 1, // Integer steps
        uiType: 'slider'
      } as NumericMetadata & { uiType: 'slider' }
    ));
  }

  /**
   * Applies the delay effect.
   * Takes incoming objects, stores them, and generates echoes for buffered objects based on time.
   * @param objects The incoming array of VisualObjects.
   * @param time The current time (in beats).
   * @param bpm The current bpm (unused for now, but could adjust timeThreshold).
   * @returns An array including original objects and any generated echo objects.
   */
  applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
    const delayTime = this.getPropertyValue<number>('delayTime') ?? 1.0;
    const feedback = this.getPropertyValue<number>('feedback') ?? 0.5;
    const maxCopies = Math.floor(this.getPropertyValue<number>('maxCopies') ?? 5); // Ensure integer

    const outputObjects: VisualObject[] = [...objects]; // Start with the original objects

    // Add clones of new incoming objects to the buffer
    const newEntries: BufferItem[] = objects.map(o => ({
      // Create a shallow clone for the buffer
      object: { ...o, properties: { ...o.properties } },
      emissionTime: time
    }));
    this.objectBuffer.push(...newEntries);

    const generatedEchoes: VisualObject[] = [];

    // Iterate through the buffer to generate echoes
    this.objectBuffer.forEach(item => {
      for (let copyNum = 1; copyNum <= maxCopies; copyNum++) {
        const echoTime = item.emissionTime + copyNum * delayTime;

        // Check if the current time is within the threshold for this echo
        if (Math.abs(time - echoTime) < this.timeThreshold) {
          // Create a clone for the echo
          const echoObject: VisualObject = {
            ...item.object,
            properties: { ...item.object.properties }
          };

          // Calculate opacity
          const opacityMultiplier = Math.pow(feedback, copyNum);
          const originalOpacity = echoObject.properties.opacity ?? 1.0;
          echoObject.properties.opacity = originalOpacity * opacityMultiplier;
          
          // Ensure opacity doesn't go below zero
          if (echoObject.properties.opacity < 0) echoObject.properties.opacity = 0;

          generatedEchoes.push(echoObject);
          // Only generate one echo per buffer item per time step check
          break; 
        }
      }
    });

    outputObjects.push(...generatedEchoes);

    // Prune the buffer: Remove items whose last possible echo is far in the past
    this.objectBuffer = this.objectBuffer.filter(item => {
      const lastPossibleEchoTime = item.emissionTime + maxCopies * delayTime;
      return lastPossibleEchoTime >= time - this.timeThreshold;
    });

    return outputObjects;
  }

  /**
   * Creates a clone of the DelayEffect instance.
   * @returns A new DelayEffect instance with the same property values but an empty buffer.
   */
  clone(): this {
    const newInstance = new DelayEffect() as this;
    // Clone properties
    this.properties.forEach((prop, key) => {
      newInstance.properties.set(key, prop.clone());
    });
    // Reset the buffer for the new instance
    newInstance.objectBuffer = [];
    return newInstance;
  }
}

export default DelayEffect; 