import { StateCreator } from 'zustand';
import { AppState } from './store'; // Import the combined AppState

// UI Slice
export interface UIState {
    isInstrumentSidebarVisible: boolean;
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
  toggleInstrumentSidebar: () => set((state) => ({ 
    isInstrumentSidebarVisible: !state.isInstrumentSidebarVisible 
  })),
}); 