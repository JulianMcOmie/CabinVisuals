import TimeManager from './TimeManager';
// Remove TrackManager import if unused elsewhere, keep types
import { VisualObject, Track, VisualObjectProperties, MIDINote } from './types'; // Add Track type

// Define interface for visual objects to be rendered
export interface VisualObject3D {
  id: string; // Changed: This will now be the persistent stateKey
  type: string;
  sourceTrackId?: string; // <-- Add optional source track ID
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

  // Constructor takes TimeManager and initial tracks
  constructor(timeManager: TimeManager, initialTracks: Track[]) {
    this.timeManager = timeManager;
    this.tracks = initialTracks;
    // Initialize object states from initial tracks if needed (e.g., loading a saved state)
  }

  getTimeManager(): TimeManager {
    return this.timeManager;
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
    // Use a map to store visuals per track initially
    const processedTrackVisuals: Map<string, VisualObject3D[]> = new Map();
    
    this.activeStateKeysThisFrame.clear();
    const isAnyTrackSoloed = this.tracks.some(track => track.isSoloed);

    // ------ PASS 1: Generate visuals per track ------
    this.tracks.forEach(track => {
      if (!processedTrackVisuals.has(track.id)) {
        processedTrackVisuals.set(track.id, []); // Ensure entry for track
      }

      const shouldIncludeTrack = isAnyTrackSoloed
        ? track.isSoloed
        : !track.isMuted;
      if (!shouldIncludeTrack || !track.synthesizer) return; // Skip processing if muted/not soloed
      
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
          const currentProperties = { ...synthVisObj.properties }; 
          if (previousState) {
            currentProperties.velocity = previousState.velocity ?? [0, 0, 0];
            currentProperties.positionOffset = previousState.positionOffset ?? [0, 0, 0];
          } else {
            currentProperties.velocity = currentProperties.velocity ?? [0, 0, 0];
            currentProperties.positionOffset = currentProperties.positionOffset ?? [0, 0, 0];
          }
          statefulVisualsForEffects.push({ 
            ...synthVisObj, 
            properties: currentProperties 
          });
        } else {
           // If no sourceNoteId, maybe it's a transient effect - handle differently?
           // For now, let's allow it through effects but not store state
           console.warn('VisualObject missing sourceNoteId, skipping state tracking.');
           statefulVisualsForEffects.push(synthVisObj); // Pass it to effects
        }
      });

      let finalVisualsAfterEffects = statefulVisualsForEffects;
      if (track.effects && track.effects.length > 0) {
        for (const effect of track.effects) {
          finalVisualsAfterEffects = effect.applyEffect(finalVisualsAfterEffects, time, bpm);
        }
      }

      // Add processed visuals to the map, converting to VisualObject3D
      const trackVisualsList = processedTrackVisuals.get(track.id) || [];
      finalVisualsAfterEffects.forEach((finalVisObj, index) => {
        if (!finalVisObj || !finalVisObj.properties) return; 
        const stateKey = finalVisObj.sourceNoteId ? `${track.id}-${finalVisObj.sourceNoteId}` : null;
        if (stateKey) {
            this.objectStates.set(stateKey, finalVisObj.properties);
        }
        const props = finalVisObj.properties;
        // Ensure defaults result in valid Vec3Tuple type
        const basePosition = props.position ?? [0, 0, 0] as [number, number, number]; 
        const offset = props.positionOffset ?? [0, 0, 0] as [number, number, number];
        const finalPosition = [
          basePosition[0] + offset[0],
          basePosition[1] + offset[1],
          basePosition[2] + offset[2]
        ] as [number, number, number]; // Explicit cast for safety
        const rotation = props.rotation ?? [0, 0, 0] as [number, number, number];
        let scale = typeof props.scale === 'number' 
                        ? [props.scale, props.scale, props.scale] as [number, number, number] 
                        : props.scale ?? [1, 1, 1] as [number, number, number];
        const color = props.color ?? '#ffffff';
        const opacity = props.opacity ?? 1.0;
        const clampedOpacity = Math.max(0, Math.min(1, opacity));
        const emissive = props.emissive;
        const emissiveIntensity = props.emissiveIntensity;

        if (clampedOpacity > 0) { 
           const renderId = stateKey
             ? `${stateKey}-${index}`
             : `transient-${track.id}-${finalVisObj.type}-${index}`;
           // Add the sourceTrackId here
           trackVisualsList.push({
            id: renderId, 
            type: finalVisObj.type,
            sourceTrackId: track.id, // Add source track ID
            position: finalPosition, 
            rotation,
            scale,
            color,
            opacity: clampedOpacity,
            emissive: emissive,                 
            emissiveIntensity: emissiveIntensity 
          });
        }
      });
      processedTrackVisuals.set(track.id, trackVisualsList);
    }); // End initial track loop

    // Convert map to array format for global modifications
    let finalProcessedTracks: { trackId: string; visuals: VisualObject3D[] }[] = 
        Array.from(processedTrackVisuals.entries()).map(([trackId, visuals]) => ({ trackId, visuals }));

    // ------ PASS 2: Apply global modifications ------
    this.tracks.forEach(track => {
      const shouldApplyGlobalMod = isAnyTrackSoloed
        ? track.isSoloed
        : !track.isMuted;

      if (shouldApplyGlobalMod && track.synthesizer) { 
        // Pass the structured data, get modified structure back
        finalProcessedTracks = track.synthesizer.applyGlobalModification(
          finalProcessedTracks, 
          time, 
          track.midiBlocks, 
          bpm 
        );
      }
    });
    
    // ------ FINAL: Flatten the result ------
    const finalRenderObjects: VisualObject3D[] = finalProcessedTracks.flatMap(trackData => trackData.visuals);

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