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
    // Change to let to allow modification by meta-synths
    let finalRenderObjects: VisualObject3D[] = []; 
    
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
           console.warn('VisualObject missing sourceNoteId, skipping state tracking.');
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
        
        if (stateKey) {
            this.objectStates.set(stateKey, finalVisObj.properties);
        }

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

        const emissive = props.emissive;
        const emissiveIntensity = props.emissiveIntensity;

        if (clampedOpacity > 0) { 
           const renderId = stateKey
             ? `${stateKey}-${index}`
             : `transient-${track.id}-${finalVisObj.type}-${index}`;
          finalRenderObjects.push({
            id: renderId, 
            type: finalVisObj.type,
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
    }); // End initial track loop

    // <<<<<<< SIMPLIFIED META-SYNTH PROCESSING >>>>>>>
    // Apply global modifications from ALL Synths (most will do nothing)
    this.tracks.forEach(track => {
      // Determine if this track should apply its global effect based on mute/solo
      const shouldApplyGlobalMod = isAnyTrackSoloed
        ? track.isSoloed // Only apply if this track is soloed
        : !track.isMuted; // Apply if not muted when nothing is soloed

      // Directly call applyGlobalModification only if active and synth exists
      if (shouldApplyGlobalMod && track.synthesizer) { 
        finalRenderObjects = track.synthesizer.applyGlobalModification(
          finalRenderObjects, 
          time, // Current time in beats
          track.midiBlocks, // Pass the synth's own MIDI data
          bpm // Current BPM
        );
      }
    });
    // <<<<<<< END SIMPLIFIED META-SYNTH PROCESSING >>>>>>>

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