import { create } from 'zustand';

// Import Slice types and creators
import { TimeSlice, createTimeSlice } from './timeSlice';
import { AudioSlice, createAudioSlice } from './audioSlice';
import { TrackSlice, createTrackSlice } from './trackSlice';
import { InstrumentSlice, createInstrumentSlice } from './instrumentSlice';
import { UISlice, createUISlice } from './uiSlice';

// Also import any base types needed globally if not already in slices
// (Example: If AppState needed types not covered by slices directly)
// import { Track, MIDIBlock, MIDINote, VisualObject } from '../lib/types'; 

// --- Combined AppState Definition ---

// Combine all slice types into a single AppState type
// This AppState type is exported and used by slices for cross-slice access via get()
export type AppState = TimeSlice & AudioSlice & TrackSlice & InstrumentSlice & UISlice;


// --- Store Creator ---

const useStore = create<AppState>()((...a) => ({
  ...createTimeSlice(...a),
  ...createAudioSlice(...a),
  ...createTrackSlice(...a),
  ...createInstrumentSlice(...a),
  ...createUISlice(...a),
}));

export default useStore; 