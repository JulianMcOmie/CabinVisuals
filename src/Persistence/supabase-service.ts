// src/Persistence/supabase-service.ts

// Import the Supabase client creator function (adjust path as needed)
import { createClient } from '../../src/utils/supabase/client';

// Define TypeScript interfaces representing the structure of your application's data.
// These should match how data is used in Zustand and UI components (e.g., using camelCase).
// You can copy or adapt these from your existing persistence-service.ts if they exist.
export interface ProjectMetadata {
    id: string;
    name: string;
    updated_at?: string; // Optional: for display/sorting
}

export interface ProjectSettings {
    projectId: string; // Matches Supabase 'project_id' but camelCase here
    bpm: number;
    isPlaying: boolean;
    loopEnabled: boolean;
    loopStartBeat: number | null;
    loopEndBeat: number | null;
    numMeasures: number;
    isInstrumentSidebarVisible: boolean;
    selectedWindow: string | null;
    // Note: user_id is not usually needed in the client-side settings object
    // Note: updated_at is usually handled automatically
}

export interface MidiNoteData {
    id: string; // UUID from Supabase
    // blockId: string; // Often implicit from context when operating on notes
    startBeat: number;
    duration: number;
    velocity: number;
    pitch: number;
}

export interface MidiBlockData {
    id: string; // UUID from Supabase
    trackId: string;
    startBeat: number;
    endBeat: number;
    notes: MidiNoteData[]; // Notes associated with this block
}

export interface EffectData {
    id: string; // UUID from Supabase
    trackId: string;
    type: string;
    settings: Record<string, any>; // Use Record or a more specific type
    order: number;
}

export interface SynthData {
    trackId: string; // PK in Supabase is track_id
    type: string;
    settings: Record<string, any>;
}

export interface TrackData {
    id: string; // UUID from Supabase
    projectId: string;
    name: string;
    order: number;
    isMuted: boolean;
    isSoloed: boolean;
    // Nested data loaded separately or via joins
    synth?: SynthData | null;      // Optional: May be loaded with track
    effects?: EffectData[];      // Optional: May be loaded with track
    midiBlocks?: MidiBlockData[]; // Optional: May be loaded with track
}

// Represents the complete, nested structure needed by the application state/UI
// after loading everything for a single project.
export interface AppProjectState {
    projectSettings: ProjectSettings;
    tracks: TrackData[]; // Should contain fully populated tracks with synth, effects, blocks, notes
}

// Create a Supabase client instance.
// For client components/services, use the client-side helper.
const supabase = createClient();

// Helper function to get current user ID (avoids repetition)
async function getUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
}

export async function getSupabaseProjectList(): Promise<ProjectMetadata[]> {
    const userId = await getUserId();
    if (!userId) {
        console.warn("getSupabaseProjectList: No user logged in.");
        return [];
    }

    const { data, error } = await supabase
        .from('projects')
        .select('id, name, updated_at') // Select needed columns
        .eq('user_id', userId)         // Filter by this user
        .order('updated_at', { ascending: false }); // Show newest first

    if (error) {
        console.error("Error fetching Supabase project list:", error);
        return []; // Return empty on error
    }
    // Map database result (snake_case) to application interface (camelCase if necessary)
    return (data || []).map(p => ({
        id: p.id,
        name: p.name,
        updated_at: p.updated_at // Pass through if needed
    }));
}

/**
 * Creates a new project and its default settings in Supabase using an RPC function.
 * Returns the new project's UUID on success, or null on failure.
 */
export async function createSupabaseProject(name: string): Promise<string | null> {
    const userId = await getUserId();
    if (!userId) {
        console.error("createSupabaseProject: User not logged in.");
        return null;
    }

    const projectName = name || 'Untitled Project';
    console.log(`Creating Supabase project '${projectName}'...`);

    try {
        // First, create the project
        const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .insert({ user_id: userId, name: projectName })
            .select('id')
            .single();

        if (projectError || !projectData) {
            console.error("Error creating project:", projectError);
            return null;
        }

        const projectId = projectData.id;

        // Then, create the default settings
        const { error: settingsError } = await supabase
            .from('project_settings')
            .insert({
                project_id: projectId,
                user_id: userId,
                bpm: 120,
                num_measures: 16,
                is_playing: false,
                loop_enabled: false,
                is_instrument_sidebar_visible: true
            });

        if (settingsError) {
            console.error("Error creating project settings:", settingsError);
            // Clean up the project if settings creation failed
            await supabase.from('projects').delete().eq('id', projectId);
            return null;
        }

        console.log(`Successfully created Supabase project: ${projectId}`);
        return projectId;
    } catch (error) {
        console.error("Error creating Supabase project:", error);
        return null;
    }
}

export async function deleteSupabaseProject(projectId: string): Promise<boolean> {
    const userId = await getUserId();
    if (!userId) {
         console.warn("deleteSupabaseProject: User not logged in.");
         return false;
    }

    console.log(`Deleting Supabase project ${projectId}...`);
    // RLS policy ensures only the owner can perform this delete.
    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

    if (error) {
        console.error(`Error deleting Supabase project ${projectId}:`, error);
        return false; // Indicate failure
    }
    // Cascade delete defined in Phase 1 handles related data (settings, tracks, etc.)
    console.log(`Successfully deleted Supabase project ${projectId}.`);
    return true; // Indicate success
}


/**
 * Loads a complete project state (including settings, tracks, synths, effects, blocks, notes)
 * from Supabase for a given project ID. Performs necessary data transformation.
 * Returns the structured AppProjectState or null if not found/error.
 */
export async function loadFullProjectFromSupabase(projectId: string): Promise<AppProjectState | null> {
    const userId = await getUserId();
    if (!userId) {
         console.warn("loadFullProjectFromSupabase: User not logged in.");
         return null;
    }

    console.log(`Loading full project ${projectId} from Supabase...`);
    const { data: dbData, error } = await supabase
        .from('projects') // Start query from the 'projects' table
        .select(`
            id, name,
            project_settings ( * ),
            tracks (
                id, name, project_id, is_muted, is_soloed, "order",
                track_synths ( * ),
                track_effects ( *, "order" ),
                midi_blocks (
                    id, track_id, start_beat, end_beat,
                    midi_notes ( * )
                )
            )
        `) // Define the nested structure and columns to retrieve
        .eq('id', projectId) // Filter for the specific project
        // .eq('user_id', userId) // RLS handles this, but redundant check is ok
        .maybeSingle(); // Important: returns null if no matching row found (0 results), errors only for >1 result

    if (error) {
        console.error(`Error loading full project ${projectId} from Supabase:`, error);
        throw error; // Propagate error for the caller (e.g., Zustand store) to handle
    }
    if (!dbData) {
        console.warn(`Project ${projectId} not found in Supabase or RLS prevented access.`);
        return null; // Project doesn't exist for this user
    }

    console.log("Fetched Supabase data for project:", dbData);

    // **Data Transformation: Map Supabase snake_case to App camelCase interfaces**
    try {
        const settingsData = dbData.project_settings;
        const tracksData = dbData.tracks || [];

        if (!settingsData) {
            throw new Error("Project settings data is missing from Supabase response.");
        }

        // Transform project settings
        const transformedSettings: ProjectSettings = {
             projectId: dbData.id, // Use the main project ID
             bpm: settingsData.bpm,
             isPlaying: settingsData.is_playing,
             loopEnabled: settingsData.loop_enabled,
             loopStartBeat: settingsData.loop_start_beat,
             loopEndBeat: settingsData.loop_end_beat,
             numMeasures: settingsData.num_measures,
             isInstrumentSidebarVisible: settingsData.is_instrument_sidebar_visible,
             selectedWindow: settingsData.selected_window,
        };

        // Transform tracks and their nested data
        const transformedTracks: TrackData[] = tracksData
            .sort((a: any, b: any) => a.order - b.order) // Sort tracks by order
            .map((track: any) => {
                const synthData = track.track_synths; // Supabase returns object or null for one-to-one
                const effectsData = track.track_effects || []; // Supabase returns array for one-to-many
                const blocksData = track.midi_blocks || [];

                // Transform synth
                const transformedSynth: SynthData | null = synthData ? {
                    trackId: track.id, // Synth primary key is the track ID
                    type: synthData.type,
                    settings: synthData.settings || {} // Ensure settings is an object
                } : null;

                // Transform effects
                const transformedEffects: EffectData[] = effectsData
                    .sort((a: any, b: any) => a.order - b.order) // Sort effects by order
                    .map((effect: any) => ({
                        id: effect.id,
                        trackId: effect.track_id,
                        type: effect.type,
                        settings: effect.settings || {},
                        order: effect.order
                    }));

                // Transform blocks and their notes
                const transformedBlocks: MidiBlockData[] = blocksData
                    .sort((a: any, b: any) => a.start_beat - b.start_beat) // Sort blocks by start beat
                    .map((block: any) => {
                        const notesData = block.midi_notes || [];
                        const transformedNotes: MidiNoteData[] = notesData.map((note: any) => ({
                            id: note.id,
                            // blockId: block.id, // Not needed in nested structure
                            startBeat: note.start_beat,
                            duration: note.duration,
                            velocity: note.velocity,
                            pitch: note.pitch
                        }));
                        return {
                            id: block.id,
                            trackId: block.track_id,
                            startBeat: block.start_beat,
                            endBeat: block.end_beat,
                            notes: transformedNotes // Assign mapped notes
                        };
                    });

                // Assemble the transformed track data
                return {
                     id: track.id,
                     projectId: track.project_id,
                     name: track.name,
                     isMuted: track.is_muted,
                     isSoloed: track.is_soloed,
                     order: track.order,
                     synth: transformedSynth,
                     effects: transformedEffects,
                     midiBlocks: transformedBlocks
                };
        }); // End map tracks

        // Assemble the final application state structure
        const transformedState: AppProjectState = {
             projectSettings: transformedSettings,
             tracks: transformedTracks
        };

        console.log("Transformed project state:", transformedState);
        return transformedState;

    } catch (transformError) {
         console.error(`Error transforming Supabase data for project ${projectId}:`, transformError);
         // This likely indicates a mismatch between your interfaces and the actual DB structure/query
         throw new Error("Failed to process project data structure from Supabase.");
    }
}

export async function saveProjectSettings(settings: ProjectSettings): Promise<boolean> {
    const userId = await getUserId();
    if (!userId) return false;

    console.log(`Saving settings for Supabase project ${settings.projectId}...`);
    // Map application state (camelCase) to database columns (snake_case)
    const dbData = {
        project_id: settings.projectId, // The primary key for upsert
        user_id: userId,                // Include user_id for RLS checks
        bpm: settings.bpm,
        is_playing: settings.isPlaying,
        loop_enabled: settings.loopEnabled,
        loop_start_beat: settings.loopStartBeat,
        loop_end_beat: settings.loopEndBeat,
        num_measures: settings.numMeasures,
        is_instrument_sidebar_visible: settings.isInstrumentSidebarVisible,
        selected_window: settings.selectedWindow,
        // updated_at is handled by trigger, no need to set here unless forcing
    };

    // upsert = insert if project_id doesn't exist, update if it does
    const { error } = await supabase.from('project_settings').upsert(dbData);

    if (error) {
        console.error("Error saving project settings to Supabase:", error);
        return false;
    }
    console.log("Project settings saved to Supabase.");
    return true;
}

export async function saveTrack(track: TrackData): Promise<boolean> {
    const userId = await getUserId();
    if (!userId) return false;
    console.log(`Saving track ${track.id} to Supabase...`);
    const dbData = {
        id: track.id, // Primary Key for upsert
        project_id: track.projectId,
        user_id: userId,
        name: track.name,
        is_muted: track.isMuted,
        is_soloed: track.isSoloed,
        "order": track.order
    };
    const { error } = await supabase.from('tracks').upsert(dbData);
    if (error) { console.error(`Error saving track ${track.id}:`, error); return false; }
    console.log(`Track ${track.id} saved.`); return true;
}

export async function saveSynth(synth: SynthData): Promise<boolean> {
    const userId = await getUserId();
    if (!userId) return false;
    console.log(`Saving synth for track ${synth.trackId}...`);
    const dbData = {
        track_id: synth.trackId, // Primary Key for upsert
        user_id: userId,
        type: synth.type,
        settings: synth.settings
    };
    const { error } = await supabase.from('track_synths').upsert(dbData);
    if (error) { console.error(`Error saving synth for track ${synth.trackId}:`, error); return false; }
    console.log(`Synth for track ${synth.trackId} saved.`); return true;
}

export async function saveEffect(effect: EffectData): Promise<boolean> {
    const userId = await getUserId();
    if (!userId) return false;
    console.log(`Saving effect ${effect.id} for track ${effect.trackId}...`);
    const dbData = {
        id: effect.id, // Primary Key for upsert
        track_id: effect.trackId,
        user_id: userId,
        type: effect.type,
        settings: effect.settings,
        "order": effect.order
    };
    const { error } = await supabase.from('track_effects').upsert(dbData);
    if (error) { console.error(`Error saving effect ${effect.id}:`, error); return false; }
    console.log(`Effect ${effect.id} saved.`); return true;
}

export async function saveMidiBlock(block: Omit<MidiBlockData, 'notes'>): Promise<boolean> { // Exclude notes here
    const userId = await getUserId();
    if (!userId) return false;
    console.log(`Saving MIDI block ${block.id} for track ${block.trackId}...`);
    const dbData = {
        id: block.id, // Primary Key for upsert
        track_id: block.trackId,
        user_id: userId,
        start_beat: block.startBeat,
        end_beat: block.endBeat
    };
    const { error } = await supabase.from('midi_blocks').upsert(dbData);
    if (error) { console.error(`Error saving MIDI block ${block.id}:`, error); return false; }
    console.log(`MIDI block ${block.id} saved.`); return true;
}

export async function saveMidiNotesBatch(notes: MidiNoteData[], blockId: string): Promise<boolean> {
    const userId = await getUserId();
    if (!userId || notes.length === 0) return false;
    // console.log(`Saving batch of ${notes.length} notes for block ${blockId}...`);
    const dbData = notes.map(note => ({
        id: note.id, // Primary Key for upsert
        block_id: blockId,
        user_id: userId,
        start_beat: note.startBeat,
        duration: note.duration,
        velocity: note.velocity,
        pitch: note.pitch
    }));
    // console.log(`DEBUG: dbData being sent to Supabase:`, JSON.stringify(dbData, null, 2));
    // Upsert multiple notes in one go
    const { error } = await supabase.from('midi_notes').upsert(dbData);
    if (error) {
        console.error(`Error saving notes batch for block ${blockId}:`, error);
        // console.error(`Full error details:`, JSON.stringify(error, null, 2));
        return false;
    }
    // console.log(`Notes batch saved for block ${blockId}.`); return true;
}

export async function deleteTrack(trackId: string): Promise<boolean> {
    const userId = await getUserId();
    if (!userId) return false;
    console.log(`Deleting track ${trackId} from Supabase...`);
    const { error } = await supabase
        .from('tracks')
        .delete()
        .eq('id', trackId)
        .eq('user_id', userId);
    // RLS ensures ownership. Cascade delete handles related synth, effects, blocks, notes.
    if (error) { console.error("Error deleting track from Supabase:", error); return false; }
    // Cascade delete handles related synth, effects, blocks, notes.
    console.log("Track deleted (cascade initiated)."); return true;
}

export async function deleteEffect(effectId: string): Promise<boolean> {
    const userId = await getUserId();
    if (!userId) return false;
    console.log(`Deleting effect ${effectId} from Supabase...`);
    const { error } = await supabase.from('track_effects').delete().eq('id', effectId);
    if (error) { console.error(`Error deleting effect ${effectId}:`, error); return false; }
    console.log(`Effect ${effectId} deleted.`); return true;
}

export async function deleteMidiBlock(blockId: string): Promise<boolean> {
    const userId = await getUserId();
    if (!userId) return false;
    console.log(`Deleting MIDI block ${blockId} from Supabase...`);
    const { error } = await supabase
        .from('midi_blocks')
        .delete()
        .eq('id', blockId)
        .eq('user_id', userId);
    // Cascade delete handles related notes
    if (error) { console.error(`Error deleting MIDI block ${blockId}:`, error); return false; }
    console.log(`MIDI block ${blockId} deleted.`); return true;
}

export async function deleteMidiNote(noteId: string): Promise<boolean> {
    const userId = await getUserId();
    if (!userId) return false;
    console.log(`Deleting MIDI note ${noteId} from Supabase...`);
    const { error } = await supabase
        .from('midi_notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', userId);
    if (error) { console.error(`Error deleting MIDI note ${noteId}:`, error); return false; }
    console.log(`MIDI note ${noteId} deleted.`); return true;
}
