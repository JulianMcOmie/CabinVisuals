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
  opacity?: number;
  // Custom properties for fractals
  fractalType?: string;
  vertices?: any[];
  complexity?: number;
  // Custom properties for triangle fractals
  trianglePositions?: [number, number, number][];
  triangleSize?: number;
  triangleCount?: number;
}

class VisualizerManager {
  private timeManager: TimeManager;
  private trackManager: TrackManager;
  
  constructor(timeManager: TimeManager, trackManager: TrackManager) {
    this.timeManager = timeManager;
    this.trackManager = trackManager;
  }
  
  // Get all visual objects to render at current time
  getVisualObjects(): VisualObject3D[] {
    const time = this.timeManager.getCurrentBeat();
    const bpm = this.timeManager.getBPM();
    const objects: VisualObject3D[] = [];
    
    // Get visual objects from the track manager
    const trackObjects = this.trackManager.getObjectsAtTime(time, bpm);
    
    // Convert VisualObject to VisualObject3D
    trackObjects.forEach((obj, index) => {
      const props = obj.properties;
      
      // Default values for 3D properties if not provided
      const position: [number, number, number] = props.position || [0, 0, 0];
      const rotation: [number, number, number] = props.rotation || [0, 0, 0];
      const scale: [number, number, number] = props.scale || [1, 1, 1];
      
      // Handle legacy objects that only have size
      if (props.size !== undefined && !props.scale) {
        const size = props.size;
        scale[0] = size;
        scale[1] = size;
        scale[2] = size;
      }
      
      objects.push({
        id: `obj-${index}-${time.toFixed(2)}`,
        type: obj.type,
        position,
        rotation,
        scale,
        color: props.color,
        opacity: props.opacity,
        // Pass through custom fractal properties
        fractalType: props.fractalType,
        vertices: props.vertices,
        complexity: props.complexity,
        // Pass through triangle fractal properties
        trianglePositions: props.trianglePositions,
        triangleSize: props.triangleSize,
        triangleCount: props.triangleCount
      });
    });
    
    // objects.push({
    //   id: 'cube-1',
    //   type: 'cube',
    //   position: [0, 0, 0],
    //   rotation: [time * 0.5, time, 0],
    //   scale: [cubeSize, cubeSize, cubeSize],
    //   color: colorHex
    // });
    
    return objects;
  }
  
  // Get the current beat
  getCurrentBeat(): number {
    return this.timeManager.getCurrentBeat();
  }
}

export default VisualizerManager; 