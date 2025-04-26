// NodeTimeManager: A TimeManager variant for server-side use without browser dependencies.
class NodeTimeManager {
  private bpm: number = 120;
  private currentBeat: number = 0;

  constructor(initialBpm: number = 120) {
    this.bpm = initialBpm;
  }

  getBPM(): number {
    return this.bpm;
  }

  setBPM(bpm: number): void {
    this.bpm = bpm;
  }

  getCurrentBeat(): number {
    return this.currentBeat;
  }

  // In a non-real-time context, seekTo directly sets the beat.
  // No update callbacks are needed as there's no continuous playback.
  seekTo(beat: number): void {
    this.currentBeat = beat;
  }

  // Convert a beat number to time in seconds based on current BPM
  public beatToTime(beat: number): number {
    if (this.bpm <= 0) return 0; // Avoid division by zero or negative BPM
    const secondsPerBeat = 60.0 / this.bpm;
    return beat * secondsPerBeat;
  }

  // Convert time in seconds to a beat number based on current BPM
  public timeToBeat(time: number): number {
    if (this.bpm <= 0 || time <= 0) return 0;
    const beatsPerSecond = this.bpm / 60.0;
    return time * beatsPerSecond;
  }

  // Get the current time in seconds
  public getCurrentTime(): number {
    return this.beatToTime(this.currentBeat);
  }
}

export default NodeTimeManager; 