import TimeManager from './TimeManager';
// Remove TrackManager import if unused elsewhere, keep types
import { VisualObject, Track, VisualObjectProperties, MIDINote } from './types'; // Add Track type

// Define interface for visual objects to be rendered
export interface VisualObject3D {
  id: string; // Changed: This will now be the persistent stateKey
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
  // State map: Key = `${track.id}-${note.id}`, Value = last frame's properties
  private objectStates: Map<string, VisualObjectProperties> = new Map();
  // Set to track active state keys this frame for cleanup
  private activeStateKeysThisFrame: Set<string> = new Set();

  // Constructor takes TimeManager and initial tracks
  constructor(timeManager: TimeManager, initialTracks: Track[]) {
    this.timeManager = timeManager;
    this.tracks = initialTracks;
    // Initialize object states from initial tracks if needed (e.g., loading a saved state)
  }

  // Method to update tracks
  setTracks(newTracks: Track[]): void {
    // TODO: Consider merging state if tracks change mid-playback, 
    // or potentially clearing state. For now, just update the track list.
    this.tracks = newTracks;
    // Maybe clear state on full track replace? 
    // this.objectStates.clear(); 
  }
  
  // Get all visual objects to render at current time
  getVisualObjects(): VisualObject3D[] {
    const time = this.timeManager.getCurrentBeat();
    const bpm = this.timeManager.getBPM();
    const finalRenderObjects: VisualObject3D[] = [];
    
    // 1. Reset active keys for this frame
    this.activeStateKeysThisFrame.clear();

    const isAnyTrackSoloed = this.tracks.some(track => track.isSoloed);

    this.tracks.forEach(track => {
      const shouldIncludeTrack = isAnyTrackSoloed
        ? track.isSoloed
        : !track.isMuted;
      if (!shouldIncludeTrack || !track.synthesizer) return;
      
      // 2. Get "raw" objects from synthesizer (must include sourceNoteId)
      const synthVisuals: VisualObject[] = track.synthesizer.getObjectsAtTime(
        time,
        track.midiBlocks,
        bpm
      );

      // 3. Prepare stateful objects for effect processing
      const statefulVisualsForEffects: VisualObject[] = [];
      synthVisuals.forEach(synthVisObj => {
        if (synthVisObj.sourceNoteId) {
          const stateKey = `${track.id}-${synthVisObj.sourceNoteId}`;
          this.activeStateKeysThisFrame.add(stateKey);

          const previousState = this.objectStates.get(stateKey);
          const currentProperties = { ...synthVisObj.properties }; // Start with synth properties

          // Restore position and velocity from previous state if it exists
          if (previousState) {
            currentProperties.position = previousState.position ?? currentProperties.position;
            currentProperties.velocity = previousState.velocity ?? currentProperties.velocity;
            // Potentially restore other stateful props if effects modify them
          }
          
          statefulVisualsForEffects.push({ 
            ...synthVisObj, 
            properties: currentProperties 
          });
        } else {
          // Handle objects without sourceNoteId (e.g., background elements?)
          // For now, pass them through non-statefully, won't be stored
          // statefulVisualsForEffects.push(synthVisObj); 
           console.warn('VisualObject missing sourceNoteId, skipping state tracking.');
        }
      });

      // 4. Apply effects chain to stateful objects
      let finalVisualsAfterEffects = statefulVisualsForEffects; // Start with the state-restored objects
      if (track.effects && track.effects.length > 0) {
        for (const effect of track.effects) {
          finalVisualsAfterEffects = effect.applyEffect(finalVisualsAfterEffects, time, bpm);
        }
      }

      // 5. Update state map and prepare render objects
      finalVisualsAfterEffects.forEach((finalVisObj, index) => {
         // Check if object is null or undefined after effects processing
        if (!finalVisObj || !finalVisObj.properties) return; 

        const stateKey = finalVisObj.sourceNoteId ? `${track.id}-${finalVisObj.sourceNoteId}` : null;
        
        // Update state map for objects with IDs
        if (stateKey) {
            this.objectStates.set(stateKey, finalVisObj.properties);
        }

        // Convert to VisualObject3D for rendering
        const props = finalVisObj.properties;
        const position: [number, number, number] = props.position ?? [0, 0, 0];
        const rotation: [number, number, number] = props.rotation ?? [0, 0, 0];
        let scale: [number, number, number] = props.scale ?? [1, 1, 1];
        const color: string = props.color ?? '#ffffff';
        const opacity: number = props.opacity ?? 1.0;

        if (props.size !== undefined && !props.scale) {
          scale = [props.size, props.size, props.size];
        }
        const clampedOpacity = Math.max(0, Math.min(1, opacity));

        if (clampedOpacity > 0) { 
           // Use the persistent stateKey as the render ID
           const renderId = stateKey ?? `transient-${track.id}-${finalVisObj.type}-${index}`; 
          finalRenderObjects.push({
            id: renderId, 
            type: finalVisObj.type,
            position,
            rotation,
            scale,
            color,
            opacity: clampedOpacity
          });
        }
      });
    }); // End track loop

    // 6. Cleanup stale states
    const currentKeys = Array.from(this.objectStates.keys());
    currentKeys.forEach(key => {
      if (!this.activeStateKeysThisFrame.has(key)) {
        this.objectStates.delete(key);
      }
    });

    return finalRenderObjects;
  }
  
}

export default VisualizerManager; 