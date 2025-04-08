// Updated TimeManager with proper state management and animation frame handling
class TimeManager {
  private bpm: number = 120;
  private isPlaying: boolean = false;
  private currentBeat: number = 0;
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

  // Get the current BPM
  getBPM(): number {
    return this.bpm;
  }

  // Set the BPM
  setBPM(bpm: number): void {
    this.bpm = bpm;
  }

  // Get the current beat
  getCurrentBeat(): number {
    return this.currentBeat;
  }

  // Start playback
  play(): void {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.lastUpdateTime = performance.now();
    this.startAnimationLoop();
  }

  // Pause playback
  pause(): void {
    this.isPlaying = false;
    this.stopAnimationLoop();
  }

  // Stop playback and reset position
  stop(): void {
    this.isPlaying = false;
    this.stopAnimationLoop();
    this.seekTo(0);
  }

  // Seek to a specific beat
  seekTo(beat: number): void {
    this.currentBeat = beat;
    this.notifyUpdateCallbacks();
  }

  // Check if playing
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
}

export default TimeManager; 