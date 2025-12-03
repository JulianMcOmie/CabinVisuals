import { StateCreator } from 'zustand';
import { AppState } from './store';
import * as SupabasePersist from './persistStore/supabase/persistProjectSlice';
import type { AppProjectState } from '@/Persistence/supabase-service';
import { deserializeSynth, deserializeEffect } from '@/utils/persistenceUtils';
import type { Track as TrackType } from '@/lib/types';

export interface ProjectMetadata {
  id: string;
  name: string;
}

export interface ProjectSlice {
    projectList: ProjectMetadata[];
    currentLoadedProjectId: string | null;
    isLoadingProject: boolean;
    isLoadingProjectList: boolean;
    loadError: string | null;
    saveError: { itemId: string | null; message: string } | null;
    // Actions that involve persistence:
    loadProjectList: () => Promise<void>;
    switchProject: (projectId: string) => void; // Temporary: kept for compatibility
    loadProject: (projectId: string) => Promise<void>;
    createNewProject: (name: string) => Promise<string | null>; // Renamed for clarity, returns ID
    renameProject: (projectId: string, newName: string) => Promise<void>; // Added
    deleteProject: (projectId: string) => Promise<void>; // Added
}

// --- Project Slice Creator ---

export const createProjectSlice: StateCreator<
    AppState, 
    [],
    [],
    ProjectSlice
> = (set, get) => ({
    projectList: [],
    currentLoadedProjectId: null, // This will be set during initialization
    isLoadingProject: false,
    isLoadingProjectList: false,
    loadError: null,
    saveError: null,
    loadProjectList: async () => {
        set({ isLoadingProjectList: true, loadError: null });
        try {
            const list = await SupabasePersist.persistLoadProjectList();
            set({ projectList: list, isLoadingProjectList: false });
        } catch (error) {
            console.error("Zustand/ProjectSlice: Failed to fetch project list:", error);
            set({ projectList: [], isLoadingProjectList: false, loadError: 'Could not load project list.' });
        }
    },
    switchProject: (projectId: string) => {
        set({ currentLoadedProjectId: projectId });
        console.log(`Switched currentLoadedProjectId in state to: ${projectId}`);
        // Navigation is now handled by the calling component (page.tsx)
    },
    loadProject: async (projectId: string) => {
        // Load full project from Supabase and hydrate store
        set({ isLoadingProject: true, loadError: null, currentLoadedProjectId: projectId });
        try {
            const fullState: AppProjectState | null = await SupabasePersist.persistLoadProject(projectId);
            if (!fullState) {
                console.warn(`loadProject: No data returned for project ${projectId}`);
                set({ currentLoadedProjectId: null, isLoadingProject: false, loadError: 'Project not found.' });
                return;
            }

            // Map ProjectSettings to relevant slices
            const {
                bpm,
                loopEnabled,
                loopStartBeat,
                loopEndBeat,
                numMeasures,
                isInstrumentSidebarVisible,
                selectedWindow,
            } = fullState.projectSettings;

            // Map and deserialize tracks
            const hydratedTracks: TrackType[] = fullState.tracks.map(trackData => {
                const synthInstance = trackData.synth ? deserializeSynth(trackData.synth) : null;
                const effectInstances = (trackData.effects || [])
                    .map(effectData => deserializeEffect(effectData))
                    .filter(instance => instance !== null) as any[];

                const hydratedMidiBlocks = (trackData.midiBlocks || []).map(blockData => ({
                    id: blockData.id,
                    startBeat: blockData.startBeat,
                    endBeat: blockData.endBeat,
                    notes: (blockData.notes || []).map(noteData => ({
                        id: noteData.id,
                        pitch: noteData.pitch,
                        velocity: noteData.velocity,
                        startBeat: noteData.startBeat,
                        duration: noteData.duration,
                    })),
                    color: 'lightblue',
                    name: '',
                }));

                const hydratedTrack: TrackType = {
                    id: trackData.id,
                    name: trackData.name,
                    midiBlocks: hydratedMidiBlocks,
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    synthesizer: synthInstance!,
                    effects: effectInstances as any,
                    isMuted: trackData.isMuted,
                    isSoloed: trackData.isSoloed,
                };
                return hydratedTrack;
            });

            set(state => ({
                currentLoadedProjectId: projectId,
                bpm,
                isPlaying: false,
                loopEnabled,
                loopStartBeat,
                loopEndBeat,
                numMeasures,
                isInstrumentSidebarVisible,
                selectedWindow: selectedWindow as any,
                selectedTrackId: null,
                selectedBlockId: null,
                selectedNotes: null,
                tracks: hydratedTracks,
                isLoadingProject: false,
            }));

            // Auto-select initial track and MIDI block for newly created projects
            // A new project has exactly 1 track with 1 MIDI block starting at beat 0
            if (hydratedTracks.length === 1 && hydratedTracks[0].midiBlocks.length === 1) {
                const firstTrack = hydratedTracks[0];
                const firstBlock = firstTrack.midiBlocks[0];
                
                // Check if this looks like a newly created project (block starts at beat 0)
                if (firstBlock.startBeat === 0) {
                    console.log('Auto-selecting initial track and MIDI block for new project');
                    set({
                        selectedTrackId: firstTrack.id,
                        selectedBlockId: firstBlock.id,
                        selectedTrack: firstTrack,
                        selectedBlock: firstBlock,
                        detailViewMode: 'midi',
                    });
                }
            }
        } catch (error) {
            console.error('loadProject: Failed to load project from Supabase:', error);
            set({ currentLoadedProjectId: null, tracks: [], isLoadingProject: false, loadError: 'Failed to load project.' });
        }
    },
    createNewProject: async (name: string): Promise<string | null> => {
        // Create in Supabase to get the ID
        const newProjectId = await SupabasePersist.persistCreateNewProject(get, name);
        
        if (newProjectId) {
            // Update state *after* successful persistence
            const newProjectMeta = { id: newProjectId, name: name || "Untitled Project" };
            set(state => ({ projectList: [...state.projectList, newProjectMeta] }));
             return newProjectId;
        } else {
             // Error already logged by persist function
             return null;
        }
    },
    renameProject: async (projectId: string, newName: string) => {
         // Update state first
         set(state => ({
             projectList: state.projectList.map(p => 
                 p.id === projectId ? { ...p, name: newName } : p
             )
         }));
         // Persist change *after* state update
         // Implement rename in Supabase (optional future work)
    },
    deleteProject: async (projectId: string) => {
        // Get current ID before state update
        const currentId = get().currentLoadedProjectId;
        
        // Update state first
        set(state => ({ 
            projectList: state.projectList.filter(p => p.id !== projectId)
        }));
        // Persist change *after* state update
        await SupabasePersist.persistDeleteProject(get, projectId);
        
        // Handle reload if the active project was deleted
        if (currentId === projectId) {
            console.log(`Deleted the currently active project (${projectId}). Reloading...`);
            window.location.reload(); 
        }
    },
}); 