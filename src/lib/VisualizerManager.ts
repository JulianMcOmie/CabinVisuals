import TimeManager from './TimeManager';
// Remove TrackManager import if unused elsewhere, keep types
import { VisualObject, Track } from './types'; // Add Track type

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
  // Store tracks directly
  private tracks: Track[] = []; 

  // Constructor takes TimeManager and initial tracks
  constructor(timeManager: TimeManager, initialTracks: Track[]) {
    this.timeManager = timeManager;
    this.tracks = initialTracks;
  }

  // Method to update tracks
  setTracks(newTracks: Track[]): void {
    this.tracks = newTracks;
  }
  
  // Get all visual objects to render at current time
  getVisualObjects(): VisualObject3D[] {
    const time = this.timeManager.getCurrentBeat(); // Use seconds time
    const bpm = this.timeManager.getBPM();
    const objects: VisualObject3D[] = [];
    const secondsPerBeat = 60 / bpm;

    // Implement logic from trackSlice.getVisualObjectsAtTime
    this.tracks.forEach(track => {
      // Call synthesizer's getObjectsAtTime once per track
      if (track.synthesizer) {
        const trackVisuals: VisualObject[] = track.synthesizer.getObjectsAtTime(
          time, // Current time in seconds
          track.midiBlocks, // All blocks for this track
          bpm // Current BPM
        );

        // Convert returned VisualObjects to VisualObject3D
        if (trackVisuals && Array.isArray(trackVisuals)) {
          trackVisuals.forEach((obj, index) => {
            const props = obj.properties;

            // Extract properties, providing defaults
            const position: [number, number, number] = props.position ?? [0, 0, 0];
            const rotation: [number, number, number] = props.rotation ?? [0, 0, 0];
            let scale: [number, number, number] = props.scale ?? [1, 1, 1]; // Use let for potential modification
            const color: string = props.color ?? '#ffffff'; // Default color white
            const opacity: number = props.opacity ?? 1.0; // Default opacity 1

            // Handle legacy objects that only have size - keep this logic if needed
            if (props.size !== undefined && !props.scale) {
              const size = props.size;
              scale = [size, size, size]; // Assign new array
            }

            objects.push({
              // Generate ID based on track and visual object index
              id: `obj-${track.id}-${obj.type}-${index}`,
              type: obj.type,
              position,
              rotation,
              scale,
              color,
              opacity
            });
          });
        }
      }
    });

    return objects;
  }
  
}

export default VisualizerManager; 