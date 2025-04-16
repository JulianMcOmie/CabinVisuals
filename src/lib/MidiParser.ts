import * as MidiFile from 'midi-file';
import { MIDIBlock, MIDINote } from './types';
import TimeManager from './TimeManager'; // Corrected default import

interface ParsedNote {
    midi: number;
    time: number; // Start time in seconds
    duration: number; // Duration in seconds
    velocity: number; // 0-1 range
}

export class MidiParser {
    static async parse(fileBuffer: ArrayBuffer, timeManager: TimeManager): Promise<MIDIBlock[]> {
        try {
            // Convert ArrayBuffer to Uint8Array for the parser
            const midiData = new Uint8Array(fileBuffer);
            const parsedMidi = MidiFile.parseMidi(midiData);

            const midiBlocks: MIDIBlock[] = [];

            if (!parsedMidi.header || !parsedMidi.tracks) {
                 throw new Error("Invalid MIDI file structure.");
            }

            const ticksPerBeat = parsedMidi.header.ticksPerBeat || 480; // Default if not specified
            const bpm = timeManager.getBPM(); // Get BPM once
            const secondsPerTick = (60.0 / bpm) / ticksPerBeat;

            for (let i = 0; i < parsedMidi.tracks.length; i++) {
                const track = parsedMidi.tracks[i];
                const notes: ParsedNote[] = [];
                let currentTick = 0; // Current time in ticks
                const activeNotes: { [key: number]: { tick: number, velocity: number } } = {};

                track.forEach(event => {
                    currentTick += event.deltaTime;
                    // Calculate current time in seconds manually
                    const currentTimeSeconds = currentTick * secondsPerTick;

                    if (event.type === 'noteOn' && event.velocity > 0) {
                        // Note On event
                        activeNotes[event.noteNumber] = {
                            tick: currentTick,
                            velocity: event.velocity / 127 // Normalize velocity to 0-1
                        };
                    } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
                        // Note Off event or Note On with velocity 0
                        const startNoteData = activeNotes[event.noteNumber];
                        if (startNoteData) {
                            const startNoteTimeSeconds = startNoteData.tick * secondsPerTick;
                            const durationSeconds = currentTimeSeconds - startNoteTimeSeconds;

                            if (durationSeconds > 0) { // Only add notes with positive duration
                                notes.push({
                                    midi: event.noteNumber,
                                    time: startNoteTimeSeconds,
                                    duration: durationSeconds,
                                    velocity: startNoteData.velocity
                                });
                            }
                             delete activeNotes[event.noteNumber]; // Remove from active notes
                        }
                    }
                });

                // If notes were found in this track, create a MIDIBlock
                if (notes.length > 0) {
                    let minStartTime = Infinity;
                    let maxEndTime = 0;

                    const midiNotes: MIDINote[] = notes.map(note => {
                         minStartTime = Math.min(minStartTime, note.time);
                         maxEndTime = Math.max(maxEndTime, note.time + note.duration);

                        const startBeat = timeManager.timeToBeat(note.time);
                        const endBeat = timeManager.timeToBeat(note.time + note.duration);
                        const durationBeat = endBeat - startBeat; // Calculate duration in beats
                        
                        return {
                            id: `note-${note.midi}-${startBeat.toFixed(2)}`,
                            midi: note.midi,
                            pitch: note.midi, // Use midi value for pitch
                            startBeat: startBeat,
                            endBeat: endBeat,
                            duration: durationBeat, // Add duration in beats
                            velocity: note.velocity
                        };
                    });

                    const startBeatOverall = timeManager.timeToBeat(minStartTime);
                    const endBeatOverall = timeManager.timeToBeat(maxEndTime);

                    const block: MIDIBlock = {
                        id: `midi-block-track-${i}-${Date.now()}`,
                        startBeat: startBeatOverall,
                        endBeat: endBeatOverall,
                        notes: midiNotes
                    };
                    midiBlocks.push(block);
                }
            }

            return midiBlocks;
        } catch (error) {
            console.error("Error parsing MIDI file:", error);
            throw new Error(`MIDI parsing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
} 