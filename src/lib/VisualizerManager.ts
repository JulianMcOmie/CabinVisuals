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
    const time = this.timeManager.getCurrentBeat();
    const bpm = this.timeManager.getBPM();
    const finalObjects: VisualObject3D[] = []; // Renamed to avoid conflict

    const isAnyTrackSoloed = this.tracks.some(track => track.isSoloed);

    this.tracks.forEach(track => {
      const shouldIncludeTrack = isAnyTrackSoloed
        ? track.isSoloed
        : !track.isMuted;
      if (!shouldIncludeTrack) return;
      
      if (track.synthesizer) {
        // 1. Get initial objects from synthesizer
        let currentVisuals: VisualObject[] = track.synthesizer.getObjectsAtTime(
          time,
          track.midiBlocks,
          bpm
        );

        // 2. Apply effects chain if effects exist
        if (track.effects && track.effects.length > 0) {
          for (const effect of track.effects) {
            // Pass the current visuals through the effect
            currentVisuals = effect.applyEffect(currentVisuals, time, bpm);
          }
        }

        // 3. Convert the final processed VisualObjects to VisualObject3D
        if (currentVisuals && Array.isArray(currentVisuals)) {
          currentVisuals.forEach((obj, index) => {
            // Check if object is null or undefined after effects processing
            if (!obj) return; 
            
            const props = obj.properties;
            if (!props) return; // Check if properties exist

            // Extract properties, providing defaults
            const position: [number, number, number] = props.position ?? [0, 0, 0];
            const rotation: [number, number, number] = props.rotation ?? [0, 0, 0];
            let scale: [number, number, number] = props.scale ?? [1, 1, 1];
            const color: string = props.color ?? '#ffffff';
            const opacity: number = props.opacity ?? 1.0;

            if (props.size !== undefined && !props.scale) {
              const size = props.size;
              scale = [size, size, size];
            }

            // Ensure opacity is within valid range [0, 1] after effects
            const clampedOpacity = Math.max(0, Math.min(1, opacity));

            // Only add objects with positive opacity
            if (clampedOpacity > 0) { 
              finalObjects.push({
                id: `obj-${track.id}-${obj.type}-${index}`,
                type: obj.type,
                position,
                rotation,
                scale,
                color,
                opacity: clampedOpacity // Use clamped opacity
              });
            }
          });
        }
      }
    });

    return finalObjects;
  }
  
}

export default VisualizerManager; 