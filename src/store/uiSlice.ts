import { StateCreator } from 'zustand';
import { AppState } from './store';
import * as SupabasePersist from './persistStore/supabase/persistProjectSettings';

export type SelectedWindowType = 'midiEditor' | 'timelineView' | 'instrumentsView' |null;
export type DetailViewModeType = "instrument" | "midi" | "effects";

export interface UIState {
    isInstrumentSidebarVisible: boolean;
    selectedWindow: SelectedWindowType;
    detailViewMode: DetailViewModeType;
}

export interface UIActions {
    toggleInstrumentSidebar: () => void;
    setSelectedWindow: (window: SelectedWindowType) => void;
    setDetailViewMode: (mode: DetailViewModeType) => void;
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
  detailViewMode: "instrument",
  toggleInstrumentSidebar: () => {
    set((state) => ({ 
      isInstrumentSidebarVisible: !state.isInstrumentSidebarVisible 
    }));
    void SupabasePersist.persistProjectSettings(get);
  },
  setSelectedWindow: (window: SelectedWindowType) => {
    set({ selectedWindow: window });
    void SupabasePersist.persistProjectSettings(get);
  },
  setDetailViewMode: (mode: DetailViewModeType) => {
    set({ detailViewMode: mode });
    void SupabasePersist.persistProjectSettings(get);
  },
}); 