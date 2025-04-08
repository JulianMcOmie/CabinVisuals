class DummyTimeManager {
  private time: number = 0;
  private bpm: number = 120;
  
  constructor(initialTime: number = 0, initialBpm: number = 120) {
    this.time = initialTime;
    this.bpm = initialBpm;
  }
  
  getTime(): number {
    // Increment time by a small amount each call to simulate time passing
    this.time += 0.016; // roughly 60fps
    return this.time;
  }
  
  getBPM(): number {
    return this.bpm;
  }
  
  // Convert time to beats
  getBeats(): number {
    return (this.time * this.bpm) / 60;
  }
  
  // Get beats at current time
  getCurrentBeat(): number {
    return this.getBeats();
  }
  
  // Reset the time to 0
  reset(): void {
    this.time = 0;
  }
}

export default DummyTimeManager; 