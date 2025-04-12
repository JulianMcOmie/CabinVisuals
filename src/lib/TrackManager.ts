import { Track, VisualObject } from './types';

class TrackManager {
  private tracks: Track[] = [];

  constructor(initialTracks: Track[] = []) {
    this.tracks = initialTracks;
  }

  getTracks(): Track[] {
    return this.tracks;
  }

  addTrack(track: Track): void {
    // TODO: Implement track addition logic
    this.tracks.push(track);
  }

  removeTrack(trackId: string): void {
    // TODO: Implement track removal logic
    this.tracks = this.tracks.filter(track => track.id !== trackId);
  }

  getTrack(trackId: string): Track | undefined {
    // TODO: Implement track retrieval logic
    return this.tracks.find(track => track.id === trackId);
  }

  updateTrack(updatedTrack: Track): void {
    const index = this.tracks.findIndex(track => track.id === updatedTrack.id);
    if (index !== -1) {
      this.tracks[index] = updatedTrack;
    }
  }

  getObjectsAtTime(time: number, bpm: number): VisualObject[] {
    // TODO: Implement logic to get all visual objects from all tracks at the current time
    let objects: VisualObject[] = [];
    
    // Collect visual objects from all tracks
    this.tracks.forEach(track => {
      // Call each track's synthesizer to get visual objects
      const trackObjects = track.synthesizer.getObjectsAtTime(time, track.midiBlocks, bpm);
      objects = [...objects, ...trackObjects];
    });
    
    return objects;
  }
}

export default TrackManager; 