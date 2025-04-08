// Helper function to generate a unique ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

// Helper function to convert beats to time in seconds
export const beatsToSeconds = (beat: number, bpm: number): number => {
  // TODO: Implement actual conversion logic
  return (beat * 60) / bpm;
};

// Helper function to convert time in seconds to beats
export const secondsToBeats = (seconds: number, bpm: number): number => {
  // TODO: Implement actual conversion logic
  return (seconds * bpm) / 60;
};

// Helper function to format time as mm:ss
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}; 