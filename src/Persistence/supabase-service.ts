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
    console.log(`Calling RPC to create Supabase project '${projectName}'...`);

    const { data: newProjectId, error } = await supabase.rpc('create_new_project_rpc', {
        p_user_id: userId,
        p_project_name: projectName
    });

    if (error || !newProjectId) {
         console.error("Error creating Supabase project via RPC:", error);
         return null; // Indicate failure
    }
    console.log(`Successfully created Supabase project via RPC: ${newProjectId}`);
    return newProjectId; // Return the new project's UUID
}

