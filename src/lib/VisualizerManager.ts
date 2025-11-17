import TimeManager from './TimeManager';
// Remove TrackManager import if unused elsewhere, keep types
import { VisualObject, Track, VisualObjectProperties } from './types'; // Add Track type

// Define interface for visual objects to be rendered
export interface VisualObject3D {
  id: string; // Changed: This will now be the persistent stateKey
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  opacity: number;
  emissive?: string;         // Add emissive color
  emissiveIntensity?: number; // Add emissive intensity
}

class VisualizerManager {
  private timeManager: TimeManager;
  // Store tracks directly
  private tracks: Track[] = []; 
  // State map: Key = `${track.id}-${note.id}`, Value = last frame's properties
  private objectStates: Map<string, VisualObjectProperties> = new Map();
  // Set to track active state keys this frame for cleanup
  private activeStateKeysThisFrame: Set<string> = new Set();
  // Throttled warning state for missing sourceNoteId
  private missingNoteWarnCount: number = 0;
  private lastMissingNoteWarnTs: number = 0;

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
  
  // Method to reset the internal state (e.g., on playback start/loop)
  resetState(): void {
    this.objectStates.clear();
    // Potentially reset effect states here too if they hold internal state
    this.tracks.forEach(track => {
      track.effects?.forEach(effect => {
        if (typeof (effect as any).reset === 'function') {
          (effect as any).reset();
        }
      });
      // Reset synth state if needed
      // if (typeof (track.synthesizer as any).reset === 'function') {
      //   (track.synthesizer as any).reset();
      // }
    });
    console.log("VisualizerManager state reset.");
  }

  // Get all visual objects to render at current time
  getVisualObjects(): VisualObject3D[] {
    const time = this.timeManager.getCurrentBeat();
    const bpm = this.timeManager.getBPM();
    const finalRenderObjects: VisualObject3D[] = [];
    
    this.activeStateKeysThisFrame.clear();

    const isAnyTrackSoloed = this.tracks.some(track => track.isSoloed);

    this.tracks.forEach(track => {
      const shouldIncludeTrack = isAnyTrackSoloed
        ? track.isSoloed
        : !track.isMuted;
      if (!shouldIncludeTrack || !track.synthesizer) return;
      
      const synthVisuals: VisualObject[] = track.synthesizer.getObjectsAtTime(
        time,
        track.midiBlocks,
        bpm
      );

      const statefulVisualsForEffects: VisualObject[] = [];
      synthVisuals.forEach(synthVisObj => {
        if (synthVisObj.sourceNoteId) {
          const stateKey = `${track.id}-${synthVisObj.sourceNoteId}`;
          this.activeStateKeysThisFrame.add(stateKey);

          const previousState = this.objectStates.get(stateKey);
          // Start with synth properties (including its base position)
          const currentProperties = { ...synthVisObj.properties }; 

          // Restore stateful properties from previous frame if it exists
          if (previousState) {
            currentProperties.velocity = previousState.velocity ?? [0, 0, 0];
            currentProperties.positionOffset = previousState.positionOffset ?? [0, 0, 0];
            // Restore other stateful props here (e.g., maybe internal effect states?)
          } else {
            // Ensure defaults if no previous state
            currentProperties.velocity = currentProperties.velocity ?? [0, 0, 0];
            currentProperties.positionOffset = currentProperties.positionOffset ?? [0, 0, 0];
          }
          
          statefulVisualsForEffects.push({ 
            ...synthVisObj, 
            properties: currentProperties 
          });
        } else {
           // Throttle noisy warnings (many visuals per frame)
           this.missingNoteWarnCount += 1;
           const now = Date.now();
           if (now - this.lastMissingNoteWarnTs > 2000) {
             console.warn(`[Visualizer] ${this.missingNoteWarnCount} visuals missing sourceNoteId in last 2s; skipping state tracking.`);
             this.missingNoteWarnCount = 0;
             this.lastMissingNoteWarnTs = now;
           }
        }
      });

      let finalVisualsAfterEffects = statefulVisualsForEffects;
      if (track.effects && track.effects.length > 0) {
        for (const effect of track.effects) {
          finalVisualsAfterEffects = effect.applyEffect(finalVisualsAfterEffects, time, bpm);
        }
      }

      finalVisualsAfterEffects.forEach((finalVisObj, index) => {
        if (!finalVisObj || !finalVisObj.properties) return; 

        const stateKey = finalVisObj.sourceNoteId ? `${track.id}-${finalVisObj.sourceNoteId}` : null;
        
        // Update state map with the latest full properties
        if (stateKey) {
            this.objectStates.set(stateKey, finalVisObj.properties);
        }

        // Convert to VisualObject3D for rendering
        const props = finalVisObj.properties;
        const basePosition: [number, number, number] = props.position ?? [0, 0, 0];
        const offset: [number, number, number] = props.positionOffset ?? [0, 0, 0];
        const finalPosition: [number, number, number] = [
          basePosition[0] + offset[0],
          basePosition[1] + offset[1],
          basePosition[2] + offset[2]
        ];

        const rotation: [number, number, number] = props.rotation ?? [0, 0, 0];
        let scale: [number, number, number] = props.scale ?? [1, 1, 1];
        const color: string = props.color ?? '#ffffff';
        const opacity: number = props.opacity ?? 1.0;

        if (props.size !== undefined && !props.scale) {
          scale = [props.size, props.size, props.size];
        }
        const clampedOpacity = Math.max(0, Math.min(1, opacity));

        // ---> Extract emissive properties <---
        const emissive = props.emissive;
        const emissiveIntensity = props.emissiveIntensity;

        if (clampedOpacity > 0) { 
           // Ensure unique ID even if multiple objects derive from the same note in one frame
           const renderId = stateKey
             ? `${stateKey}-${index}` // Append index for uniqueness
             : `transient-${track.id}-${finalVisObj.type}-${index}`;
          finalRenderObjects.push({
            id: renderId, 
            type: finalVisObj.type,
            position: finalPosition, // Use calculated final position
            rotation,
            scale,
            color,
            opacity: clampedOpacity,
            emissive: emissive,                 // Pass emissive color
            emissiveIntensity: emissiveIntensity // Pass emissive intensity
          });
        }
      });
    }); // End track loop

    // Cleanup stale states
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