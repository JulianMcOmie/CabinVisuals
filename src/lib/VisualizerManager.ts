import TimeManager from './TimeManager';
import TrackManager from './TrackManager';
import { VisualObject } from './types';

// Define interface for visual objects to be rendered
export interface VisualObject3D {
  id: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  opacity: number;
}

class VisualizerManager {
  private timeManager: TimeManager;
  // Store the function directly instead of the TrackManager instance
  private getObjectsAtTime: (time: number, bpm: number) => VisualObject[];

  constructor(timeManager: TimeManager, getObjectsAtTime: (time: number, bpm: number) => VisualObject[]) {
    this.timeManager = timeManager;
    this.getObjectsAtTime = getObjectsAtTime;
  }
  
  // Get all visual objects to render at current time
  getVisualObjects(): VisualObject3D[] {
    const time = this.timeManager.getCurrentBeat();
    const bpm = this.timeManager.getBPM();
    const objects: VisualObject3D[] = [];
    
    // Get visual objects using the function from the store
    const trackObjects = this.getObjectsAtTime(time, bpm);
    
    // Convert VisualObject to VisualObject3D
    trackObjects.forEach((obj, index) => {
      const props = obj.properties;
      
      // Extract properties, providing defaults
      const position: [number, number, number] = props.position ?? [0, 0, 0];
      const rotation: [number, number, number] = props.rotation ?? [0, 0, 0];
      const scale: [number, number, number] = props.scale ?? [1, 1, 1];
      const color: string = props.color ?? '#ffffff'; // Default color white
      const opacity: number = props.opacity ?? 1.0; // Default opacity 1
      
      // Handle legacy objects that only have size
      if (props.size !== undefined && !props.scale) {
        const size = props.size;
        scale[0] = size;
        scale[1] = size;
        scale[2] = size;
      }
      
      objects.push({
        id: `obj-${obj.type}-${index}`,
        type: obj.type,
        position,
        rotation,
        scale,
        color,
        opacity
      });
    });
    
    return objects;
  }
  
  // Get the current beat
  getCurrentBeat(): number {
    return this.timeManager.getCurrentBeat();
  }
}

export default VisualizerManager; 