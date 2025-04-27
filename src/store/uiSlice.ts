import { StateCreator } from 'zustand';
import { AppState } from './store';
import { persistProjectSettings } from './persistStore/persistProjectSettings';

export type SelectedWindowType = 'midiEditor' | 'timelineView' | 'instrumentsView' |null;
export type DetailViewModeType = "instrument" | "midi" | "effects";

export interface UIState {
    isInstrumentSidebarVisible: boolean;
    selectedWindow: SelectedWindowType;
    detailViewMode: DetailViewModeType;
    isExportViewOpen: boolean;
}

export interface UIActions {
    toggleInstrumentSidebar: () => void;
    setSelectedWindow: (window: SelectedWindowType) => void;
    setDetailViewMode: (mode: DetailViewModeType) => void;
    openExportView: () => void;
    closeExportView: () => void;
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
  isExportViewOpen: false,
  toggleInstrumentSidebar: () => {
    set((state) => ({ 
      isInstrumentSidebarVisible: !state.isInstrumentSidebarVisible 
    }));
    persistProjectSettings(get);
  },
  setSelectedWindow: (window: SelectedWindowType) => {
    set({ selectedWindow: window });
    persistProjectSettings(get);
  },
  setDetailViewMode: (mode: DetailViewModeType) => {
    set({ detailViewMode: mode });
    persistProjectSettings(get);
  },
  openExportView: () => {
    console.log("UI Slice: openExportView action executing.");
    set({ isExportViewOpen: true });
    setTimeout(() => console.log("UI Slice: State after openExportView:", get().isExportViewOpen), 0);
  },
  closeExportView: () => {
    console.log("UI Slice: Closing Export View");
    set({ isExportViewOpen: false });
    setTimeout(() => console.log("UI Slice: State after closeExportView:", get().isExportViewOpen), 0);
  },
}); 