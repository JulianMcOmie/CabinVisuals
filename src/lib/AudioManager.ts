export class AudioManager {
    private audioContext: AudioContext | null = null;
    private audioBuffer: AudioBuffer | null = null;
    private sourceNode: AudioBufferSourceNode | null = null;
    private isLoaded: boolean = false;
    private duration: number | null = null;
    private startTime: number = 0; // AudioContext time when playback started relative to context timeline
    private startOffset: number = 0; // Offset within the buffer where playback started (in seconds)
    private pausedAt: number | null = null; // AudioContext time when pause() was called
    private fileName: string | null = null; // Store the file name
    private progressCallback: ((progress: number) => void) | null = null; // Callback for progress updates

    constructor() {
        if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            console.log("AudioContext initialized.");
        } else {
            console.warn("Web Audio API not available in this environment. Audio playback disabled.");
        }
    }

    get context(): AudioContext | null {
        return this.audioContext;
    }

    get isAudioLoaded(): boolean {
        return this.isLoaded;
    }

    get audioDuration(): number | null {
        return this.duration;
    }

    get audioFileName(): string | null {
        return this.fileName;
    }

    setProgressCallback(callback: (progress: number) => void): void {
        this.progressCallback = callback;
    }

    private updateProgress(progress: number): void {
        if (this.progressCallback) {
            // Ensure progress is between 0-100
            const boundedProgress = Math.max(0, Math.min(100, progress));
            this.progressCallback(boundedProgress);
        }
    }

    async loadAudio(audioData: ArrayBuffer, fileName: string = ''): Promise<{ duration: number }> {
        if (!this.audioContext) { throw new Error("AudioContext is not initialized."); }
        
        // Initial progress: starting
        this.updateProgress(0);
        
        // Stop and clear any existing playback/state before loading new audio
        if (this.sourceNode) {
            try {
                this.sourceNode.stop();
            } catch { /* Ignore if already stopped */ }
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        
        // Progress: 10% - Clean up complete
        this.updateProgress(10);
        
        this.audioBuffer = null;
        this.isLoaded = false;
        this.duration = null;
        this.pausedAt = null;
        this.startOffset = 0;
        this.startTime = 0;
        this.fileName = fileName;

        try {
            // Progress: 20% - File read, starting decoding
            this.updateProgress(20);
            
            // Resume context if suspended (often required after user interaction)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                // Progress: 25% - Context resumed
                this.updateProgress(25);
            }
            
            // Create a custom promise for decodeAudioData to track progress
            const decodePromise = new Promise<AudioBuffer>((resolve, reject) => {
                // For large files, this shows intent to process
                this.updateProgress(30);
                
                this.audioContext!.decodeAudioData(
                    audioData,
                    (buffer) => {
                        // Progress: 80% - Decoding complete
                        this.updateProgress(80);
                        resolve(buffer);
                    },
                    (error) => {
                        reject(error);
                    }
                );
                
                // Use setTimeout to simulate progress during decoding
                // since the Web Audio API doesn't expose decode progress
                setTimeout(() => this.updateProgress(40), 100);
                setTimeout(() => this.updateProgress(50), 200);
                setTimeout(() => this.updateProgress(60), 300);
                setTimeout(() => this.updateProgress(70), 500);
            });
            
            // Wait for decoding to complete
            this.audioBuffer = await decodePromise;
            
            // Progress: 90% - Processing decoded audio
            this.updateProgress(90);
            
            this.isLoaded = true;
            this.duration = this.audioBuffer.duration;
            
            // Progress: 100% - Everything complete
            this.updateProgress(100);
            
            console.log(`AudioManager: Audio loaded successfully. File: ${this.fileName}, Duration: ${this.duration.toFixed(2)}s`);
            return { duration: this.duration };
        } catch (error) {
            console.error("AudioManager: Error decoding audio data:", error);
            this.isLoaded = false;
            this.duration = null;
            this.audioBuffer = null;
            this.fileName = null;
            
            // Reset progress on error
            this.updateProgress(0);
            
            throw new Error(`Failed to decode audio: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // when: context time to start playback (AudioContext.currentTime + delay)
    // offset: position within the audio buffer to start (in seconds)
    play(when: number, offset: number): void {
        if (!this.audioContext || !this.audioBuffer || !this.isLoaded) {
            console.warn("AudioManager: Cannot play - audio not loaded or context unavailable.");
            return;
        }

        const startPlayback = (scheduledWhen: number) => {
            // Stop existing node if playing
            if (this.sourceNode) {
                try {
                    this.sourceNode.stop(0); // Stop immediately
                    this.sourceNode.disconnect();
                } catch { /* ignore errors if already stopped */ }
                this.sourceNode = null;
            }

            // Determine the correct starting offset
            let effectiveOffset = offset;
            if (this.pausedAt !== null && this.duration !== null) {
                // Resuming from pause
                effectiveOffset = (this.pausedAt - this.startTime + this.startOffset) % this.duration;
            }

            // Ensure offset is within valid range [0, duration]
            const validOffset = Math.max(0, Math.min(effectiveOffset, this.duration ?? Infinity));

            this.sourceNode = this.audioContext!.createBufferSource();
            this.sourceNode.buffer = this.audioBuffer!;
            this.sourceNode.connect(this.audioContext!.destination!);

            this.startTime = scheduledWhen; // Record scheduled start time from context perspective
            this.startOffset = validOffset; // Record where in the buffer we started
            this.pausedAt = null; // Clear pause state

            console.log(`AudioManager: Starting playback at context time ${scheduledWhen.toFixed(3)} with buffer offset ${validOffset.toFixed(3)}`);
            this.sourceNode.start(scheduledWhen, validOffset);

            this.sourceNode.onended = () => {
                 // Only log/handle if it wasn't manually stopped (i.e., not paused)
                 if (this.pausedAt === null && this.sourceNode) {
                     console.log("AudioManager: Playback ended naturally or was stopped externally.");
                     this.sourceNode.disconnect();
                     this.sourceNode = null;
                    // Maybe notify store that playback stopped? Handled by timeManager for now.
                 }
            };
        };

        if (this.audioContext.state === 'suspended') {
             console.warn("AudioManager: AudioContext is suspended. Attempting to resume before playback.");
             this.audioContext.resume()
                 .then(() => {
                     // After resuming, ensure `when` is not in the past
                     const now = this.audioContext!.currentTime;
                     const adjustedWhen = when <= now ? now + 0.01 : when;
                     startPlayback(adjustedWhen);
                 })
                 .catch(err => console.error("Failed to resume context:", err));
             return;
        }

        startPlayback(when);
    }

    // Returns the playback time (in seconds) where pause occurred
    pause(): number {
        if (!this.audioContext || !this.sourceNode || this.pausedAt !== null) {
             // Cannot pause if not playing, or already paused
            return this.getCurrentPlaybackTime();
        }

        this.pausedAt = this.audioContext.currentTime; // Record precise pause time

        try {
            this.sourceNode.stop(0); // Stop immediately
            this.sourceNode.disconnect();
            console.log(`AudioManager: Paused at context time ${this.pausedAt.toFixed(3)}`);
        } catch (e) {
            console.warn("AudioManager: Error stopping node during pause:", e);
        }
        // Don't nullify sourceNode here if we might want info, but we recalculate on resume anyway
        this.sourceNode = null;
        return this.getCurrentPlaybackTime(); // Return the calculated pause position
    }

    stop(): void {
        if (!this.audioContext) return;

        if (this.sourceNode) {
             try {
                 this.sourceNode.stop(0); // Stop immediately
                 this.sourceNode.disconnect();
                 console.log("AudioManager: Stopped playback.");
             } catch (e) {
                 console.warn("AudioManager: Error stopping node:", e);
             }
             this.sourceNode = null;
        }
        // Reset playback state fully on stop
        this.pausedAt = null;
        this.startTime = 0;
        this.startOffset = 0; // Reset seek position to the beginning
    }

    // Used for seeking while *not* playing.
    // If playing, the store should handle stop -> seek -> play.
    seek(offset: number): void {
        if (!this.isLoaded || this.duration === null) {
            console.warn("AudioManager: Cannot seek - audio not loaded.");
            return;
        }
        if (this.sourceNode && this.pausedAt === null) {
            console.warn("AudioManager: Should not call seek directly while playing. Use store actions (stop/seek/play).");
            // To be safe, stop playback if seek is called while technically playing
             this.stop();
        }

        const validOffset = Math.max(0, Math.min(offset, this.duration));
        this.startOffset = validOffset; // Set the offset for the *next* play call
        this.pausedAt = null; // Seeking while paused/stopped means we are no longer paused at a specific time
        this.startTime = this.audioContext?.currentTime ?? 0; // Reset relative start time
        console.log(`AudioManager: Seeked to offset ${validOffset.toFixed(3)}. Ready for next play.`);
    }

    // Calculates the current position within the audio buffer in seconds
    getCurrentPlaybackTime(): number {
        if (!this.audioContext || !this.isLoaded || this.duration === null) {
            return 0;
        }

        if (this.pausedAt !== null) {
            // We are paused, calculate position based on when pause happened
            return (this.pausedAt - this.startTime + this.startOffset) % this.duration;
        } else if (this.sourceNode) {
            // We are actively playing (or scheduled to play)
             // Ensure we don't calculate negative time if context time hasn't reached startTime yet
             const elapsedTime = Math.max(0, this.audioContext.currentTime - this.startTime);
            return (elapsedTime + this.startOffset) % this.duration;
        } else {
            // We are stopped, return the last set startOffset (seek position)
            return this.startOffset;
        }
    }
} 