import { StateCreator } from 'zustand';
import { AppState } from './store';

export type SelectedWindowType = 'midiEditor' | 'playbar' | 'visualizerView' | 'trackTimelineView' | null;
export interface UIState {
    isInstrumentSidebarVisible: boolean;
    selectedWindow: SelectedWindowType;
}

export interface UIActions {
    toggleInstrumentSidebar: () => void;
}

export type UISlice = UIState & UIActions;

export const createUISlice: StateCreator<
  AppState,
  [],
  [],
  UISlice
> = (set, get) => ({
  isInstrumentSidebarVisible: true,
  selectedWindow: null,
  toggleInstrumentSidebar: () => set((state) => ({ 
    isInstrumentSidebarVisible: !state.isInstrumentSidebarVisible 
  })),
  setSelectedWindow: (window: SelectedWindowType) => set({ selectedWindow: window }), // Implement the action
}); 