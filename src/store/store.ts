import { create } from 'zustand';

// Import Slice types and creators
import { TimeSlice, createTimeSlice } from './timeSlice';
import { AudioSlice, createAudioSlice } from './audioSlice';
import { TrackSlice, createTrackSlice } from './trackSlice';
import { InstrumentSlice, createInstrumentSlice } from './instrumentSlice';
import { EffectSlice, createEffectSlice } from './effectSlice';
import { UISlice, createUISlice } from './uiSlice';

// --- Combined AppState Definition ---

// Combine all slice types into a single AppState type
// This AppState type is exported and used by slices for cross-slice access via get()
export type AppState = TimeSlice & AudioSlice & TrackSlice & InstrumentSlice & EffectSlice & UISlice;


// --- Store Creator ---

const useStore = create<AppState>()((...a) => ({
  ...createTimeSlice(...a),
  ...createAudioSlice(...a),
  ...createTrackSlice(...a),
  ...createInstrumentSlice(...a),
  ...createEffectSlice(...a),
  ...createUISlice(...a),
}));

export default useStore; 