// Updated TimeManager with proper state management and animation frame handling
class TimeManager {
  private bpm: number = 120;
  private isPlaying: boolean = false;
  private currentBeat: number = 0;
  private numMeasures: number = 8;
  private lastUpdateTime: number | null = null;
  private animationFrameId: number | null = null;
  private onUpdateCallbacks: ((beat: number) => void)[] = [];

  constructor(initialBpm: number = 120) {
    this.bpm = initialBpm;
  }

  // Register a callback to be called when the beat updates
  onUpdate(callback: (beat: number) => void): () => void {
    this.onUpdateCallbacks.push(callback);
    return () => {
      this.onUpdateCallbacks = this.onUpdateCallbacks.filter(cb => cb !== callback);
    };
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

  getNumMeasures(): number {
    return this.numMeasures;
  }

  play(): void {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.lastUpdateTime = performance.now();
    this.startAnimationLoop();
  }

  pause(): void {
    this.isPlaying = false;
    this.stopAnimationLoop();
  }

  stop(): void {
    this.isPlaying = false;
    this.stopAnimationLoop();
    this.seekTo(0);
  }

  seekTo(beat: number): void {
    this.currentBeat = beat;
    this.notifyUpdateCallbacks();
  }

  isPlaybackActive(): boolean {
    return this.isPlaying;
  }

  // Initialize animation loop for timing updates
  private startAnimationLoop(): void {
    if (this.animationFrameId !== null) return;
    
    const updateLoop = (timestamp: number) => {
      if (!this.isPlaying || this.lastUpdateTime === null) {
        this.lastUpdateTime = timestamp;
        this.animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      const elapsed = (timestamp - this.lastUpdateTime) / 1000; // Convert to seconds
      this.lastUpdateTime = timestamp;
      
      // Calculate beat increment based on elapsed time and BPM
      // BPM = beats per minute, so divide by 60 to get beats per second
      const beatIncrement = (this.bpm / 60) * elapsed;
      this.currentBeat += beatIncrement;
      
      this.notifyUpdateCallbacks();
      
      this.animationFrameId = requestAnimationFrame(updateLoop);
    };
    
    this.animationFrameId = requestAnimationFrame(updateLoop);
  }

  // Stop animation loop
  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // Notify all registered callbacks of the current beat
  private notifyUpdateCallbacks(): void {
    for (const callback of this.onUpdateCallbacks) {
      callback(this.currentBeat);
    }
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
}

export default TimeManager; 