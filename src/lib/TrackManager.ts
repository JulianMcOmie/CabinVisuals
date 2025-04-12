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
    this.tracks.push(track);
  }

  removeTrack(trackId: string): void {
    this.tracks = this.tracks.filter(track => track.id !== trackId);
  }

  getTrack(trackId: string): Track | undefined {
    return this.tracks.find(track => track.id === trackId);
  }

  updateTrack(trackId: string, updatedProperties: Partial<Track>): void {
    const track = this.getTrack(trackId);
    if (track) {
      Object.assign(track, updatedProperties);
    }
  }

  getObjectsAtTime(time: number, bpm: number): VisualObject[] {
    let objects: VisualObject[] = [];
    
    // Collect visual objects from all tracks
    this.tracks.forEach(track => {
      // Get visual objects from each track's synthesizer
      const trackObjects = track.synthesizer.getObjectsAtTime(time, track.midiBlocks, bpm);
      objects = [...objects, ...trackObjects];
    });
    
    return objects;
  }
}

export default TrackManager; 