import TimeManager from './TimeManager';

// Define interface for visual objects to be rendered
export interface VisualObject3D {
  id: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
}

class VisualizerManager {
  private timeManager: TimeManager;
  
  constructor(timeManager: TimeManager) {
    this.timeManager = timeManager;
  }
  
  // Get all visual objects to render at current time
  getVisualObjects(): VisualObject3D[] {
    const time = this.timeManager.getCurrentBeat();
    const objects: VisualObject3D[] = [];
    
    // Create a cube with oscillating properties
    const cubeSize = Math.sin(time) * 0.5 + 1; // Oscillate between 0.5 and 1.5
    
    // Oscillate color between red and blue
    const r = Math.floor((Math.sin(time * 0.5) * 0.5 + 0.5) * 255);
    const b = Math.floor((Math.cos(time * 0.5) * 0.5 + 0.5) * 255);
    const colorHex = `#${r.toString(16).padStart(2, '0')}00${b.toString(16).padStart(2, '0')}`;
    
    objects.push({
      id: 'cube-1',
      type: 'cube',
      position: [0, 0, 0],
      rotation: [time * 0.5, time, 0],
      scale: [cubeSize, cubeSize, cubeSize],
      color: colorHex
    });
    
    return objects;
  }
  
  // Get the current beat
  getCurrentBeat(): number {
    return this.timeManager.getCurrentBeat();
  }
}

export default VisualizerManager; 