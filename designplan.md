# Design Plan: Supabase Primary (Online-Only) Persistence

This plan outlines the steps to implement a persistence model where Supabase (PostgreSQL) serves as the single source of truth for all project data. Users must be logged in to create, view, or edit projects. Data is fetched from Supabase when needed and saved back asynchronously. Client-side state management (Zustand) holds a temporary copy of the data for UI rendering and interactions. The previous IndexedDB code (`src/Persistence/persistence-service.ts`) will be retained but no longer used for primary project data storage.

---

## Phase 1: Build the Supabase Backend Foundation (Schema & Security)

### High-Level Goal
Establish the necessary cloud database structure (tables, columns, relationships) and enforce security rules within Supabase. This backend will securely store all project data, accessible only by authenticated users according to defined permissions.

### Implementation Details

1.  **Access Supabase Project Dashboard:**
    *   Open your web browser and navigate to [https://app.supabase.com/](https://app.supabase.com/).
    *   Log in to your Supabase account.
    *   Select the project you are working on for this application.

2.  **Navigate to the SQL Editor:**
    *   In the left sidebar menu of your Supabase project dashboard, click the icon that looks like a database cylinder ("Table Editor").
    *   In the top-left area of the main panel, click the "SQL Editor" link.
    *   Click the "+ New query" button to open a blank SQL editor window.

3.  **Enable `moddatetime` Extension:** This PostgreSQL extension automatically updates `updated_at` timestamp columns whenever a row is modified, which can be useful for tracking recent changes or ordering.
    *   Paste the following SQL command into the SQL editor window:
        ```sql
        CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;
        ```
    *   Click the "RUN" button. Confirm success message appears.

4.  **Create Database Tables via SQL:** Paste the following SQL `CREATE TABLE` statements into the SQL editor window (you can paste them all together or run them one by one) and click "RUN". These define the structure for storing your project data.

    *   **`projects` Table:** Stores the main entry for each project.
        ```sql
        -- Stores metadata for user projects.
        CREATE TABLE public.projects (
            -- 'uuid' is a universally unique identifier, good for primary keys.
            -- 'DEFAULT gen_random_uuid()' automatically generates a unique ID for new projects.
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            -- 'user_id' links this project to a specific user in Supabase's built-in authentication system.
            -- 'REFERENCES auth.users(id)' creates a foreign key relationship (a link to the users table).
            -- 'ON DELETE CASCADE' means if a user is deleted from auth.users, their projects are automatically deleted.
            -- 'NOT NULL' means this column must always have a value.
            user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            -- 'text' stores the project name as a string.
            name text NOT NULL,
            -- 'timestamp with time zone' stores date and time, including timezone info.
            -- 'DEFAULT now()' sets the creation time automatically for new projects.
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        -- Trigger to automatically update the 'updated_at' column whenever a row in 'projects' is modified.
        CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.projects
          FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);
        ```
    *   **`project_settings` Table:** Stores settings specific to each project.
        ```sql
        -- Stores settings associated with each project.
        CREATE TABLE public.project_settings (
            -- 'project_id' links these settings to a specific project. It's the PRIMARY KEY,
            -- meaning each project can only have one row of settings.
            project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
            user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            -- 'integer' stores whole numbers for BPM and measures.
            bpm integer DEFAULT 120 NOT NULL,
            -- 'boolean' stores true/false values.
            is_playing boolean DEFAULT false NOT NULL,
            loop_enabled boolean DEFAULT false NOT NULL,
            -- 'numeric' stores numbers that might have decimal points (like beat numbers).
            loop_start_beat numeric, -- Allow NULL (optional setting)
            loop_end_beat numeric,   -- Allow NULL (optional setting)
            num_measures integer DEFAULT 16 NOT NULL,
            is_instrument_sidebar_visible boolean DEFAULT true NOT NULL,
            selected_window text, -- Allow NULL (optional setting)
            updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.project_settings
          FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);
        ```
    *   **`tracks` Table:** Stores the individual tracks within each project.
        ```sql
        -- Stores individual tracks within a project.
        CREATE TABLE public.tracks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
            user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            name text NOT NULL,
            is_muted boolean DEFAULT false NOT NULL,
            is_soloed boolean DEFAULT false NOT NULL,
            -- "order" is an SQL keyword, so it needs double quotes to be used as a column name.
            -- It stores the display/playback order of the track.
            "order" integer NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.tracks
          FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);
        ```
    *   **`track_synths` Table:** Stores the synthesizer configuration for each track (assuming one synth per track).
        ```sql
        -- Stores synthesizer settings for each track.
        CREATE TABLE public.track_synths (
            -- 'track_id' is both the Primary Key and the Foreign Key linking to the 'tracks' table.
            track_id uuid PRIMARY KEY REFERENCES public.tracks(id) ON DELETE CASCADE,
            user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            type text NOT NULL,
            -- 'jsonb' is an efficient binary format for storing complex JSON data (like synth parameters).
            settings jsonb,
            updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.track_synths
          FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);
        ```
    *   **`track_effects` Table:** Stores effects applied to tracks (a track can have multiple effects).
        ```sql
        -- Stores effects applied to tracks.
        CREATE TABLE public.track_effects (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
            user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            type text NOT NULL,
            settings jsonb,
            "order" integer NOT NULL, -- Order of effects within the track's chain
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.track_effects
          FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);
        ```
    *   **`midi_blocks` Table:** Stores blocks (regions) of MIDI data on a track.
        ```sql
        -- Stores MIDI blocks containing notes within a track.
        CREATE TABLE public.midi_blocks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
            user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            start_beat numeric NOT NULL,
            end_beat numeric NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.midi_blocks
          FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);
        ```
    *   **`midi_notes` Table:** Stores the individual MIDI notes contained within a MIDI block.
        ```sql
        -- Stores individual MIDI notes within a block.
        CREATE TABLE public.midi_notes (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            block_id uuid REFERENCES public.midi_blocks(id) ON DELETE CASCADE NOT NULL,
            user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            start_beat numeric NOT NULL,
            duration numeric NOT NULL,
            -- 'CHECK' constraints enforce data rules (velocity/pitch must be 0-127).
            velocity integer NOT NULL CHECK (velocity >= 0 AND velocity <= 127),
            pitch integer NOT NULL CHECK (pitch >= 0 AND pitch <= 127),
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.midi_notes
          FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);
        ```

5.  **Navigate to Authentication -> Policies:**
    *   In the left sidebar of the Supabase dashboard, click the shield icon ("Authentication").
    *   In the secondary menu that appears, click "Policies".

6.  **Enable Row Level Security (RLS) for Each Table:** RLS ensures users can only access their own data.
    *   Find each of the tables you just created (`projects`, `project_settings`, `tracks`, `track_synths`, `track_effects`, `midi_blocks`, `midi_notes`) in the list.
    *   For **each** table, click on its name and toggle the switch labeled "Enable Row Level Security (RLS)" to the **ON** position. Save if prompted.

7.  **Create RLS Policies for Each Table:** Define the access rules. For **each** table (`projects`, `project_settings`, `tracks`, etc.):
    *   Click the table name in the Policies list.
    *   Click "+ New Policy". Choose "Create a policy from scratch".
    *   **Create SELECT Policy:**
        *   Name: `Allow authenticated read access`
        *   Type: `SELECT`
        *   Target roles: `authenticated`
        *   USING expression: `auth.uid() = user_id`
        *   Review and Save.
    *   **Create INSERT Policy:**
        *   Name: `Allow authenticated insert access`
        *   Type: `INSERT`
        *   Target roles: `authenticated`
        *   WITH CHECK expression: `auth.uid() = user_id`
        *   Review and Save.
    *   **Create UPDATE Policy:**
        *   Name: `Allow authenticated update access`
        *   Type: `UPDATE`
        *   Target roles: `authenticated`
        *   USING expression: `auth.uid() = user_id`
        *   WITH CHECK expression: `auth.uid() = user_id`
        *   Review and Save.
    *   **Create DELETE Policy:**
        *   Name: `Allow authenticated delete access`
        *   Type: `DELETE`
        *   Target roles: `authenticated`
        *   USING expression: `auth.uid() = user_id`
        *   Review and Save.

8.  **Verify `profiles` Trigger:** (Ensures user names are handled correctly during signup)
    *   Go to "Database" -> "Triggers".
    *   Find the trigger on `auth.users` (e.g., `on_auth_user_created`).
    *   Click the linked function name (e.g., `handle_new_user`).
    *   Verify the SQL function definition correctly extracts `given_name`/`family_name` from `new.raw_user_meta_data` and inserts into `public.profiles`. Adjust if needed via SQL Editor.

### Files Created/Modified in Phase 1
*   Supabase Database Schema (Managed via Supabase Dashboard UI / SQL Editor)
*   Supabase RLS Policies (Managed via Supabase Dashboard UI)

### File Details for Phase 1
*   **Supabase Database Schema:**
    *   **Tables Created/Updated:** `projects`, `project_settings`, `tracks`, `track_synths`, `track_effects`, `midi_blocks`, `midi_notes`. Defines the cloud storage structure in PostgreSQL. Includes Primary Keys (`id`, `project_id`, `track_id`), Foreign Keys (`user_id`, `project_id`, `track_id`, `block_id`) linking tables and ensuring data integrity, data types (`uuid`, `text`, `boolean`, `integer`, `numeric`, `jsonb`, `timestamp with time zone`), default values, and `ON DELETE CASCADE` rules.
    *   **Triggers Added:** `handle_updated_at` on each table to automatically update the `updated_at` column on modifications.
*   **Supabase RLS Policies:**
    *   **Policies Created:** SELECT, INSERT, UPDATE, DELETE policies for each data table, restricting access based on the logged-in user's ID (`auth.uid()`).

### Implementation Summary for Phase 1
This phase constructs the secure backend database in Supabase. We define the tables to store project data, establish relationships between them, ensure timestamps update automatically, and implement Row Level Security (RLS) to strictly control data access based on the logged-in user. This creates the mandatory foundation for storing user data securely in the cloud.

### Testing Phase 1

1.  **Verify Tables:** In the Supabase Dashboard ("Table Editor"), confirm that all tables (`projects`, `project_settings`, `tracks`, `track_synths`, `track_effects`, `midi_blocks`, `midi_notes`) exist in the `public` schema. Click on each table and check that the columns, data types, primary keys, foreign keys, and default values match the `CREATE TABLE` statements.
2.  **Verify `moddatetime` Extension:** Go to "Database" -> "Extensions". Confirm that `moddatetime` is listed and enabled.
3.  **Verify RLS Enabled:** Go to "Authentication" -> "Policies". Check that Row Level Security is marked as "Enabled" for each of the data tables created.
4.  **Verify RLS Policies:** Click on each table name in the "Policies" list. Confirm that there are four policies (SELECT, INSERT, UPDATE, DELETE) created for the `authenticated` role, and that their `USING` / `WITH CHECK` expressions correctly reference `auth.uid() = user_id`.
5.  **Verify Trigger:** Go to "Database" -> "Triggers". Confirm that the `handle_updated_at` trigger exists for each table created.
6.  **(Optional) Manual Insert/Select:** Use the Supabase SQL Editor to manually insert a row into the `projects` table (using your test user's UUID for `user_id`). Then, try to `SELECT * FROM public.projects;` - it should succeed. Try inserting a row with a fake `user_id` - it should fail due to the foreign key constraint or RLS policy.

---

## Phase 2: Implement Core Persistence Service (Supabase Client)

### High-Level Goal
Create a dedicated service file (`supabase-service.ts`) containing functions that use the Supabase client library to perform all data operations (Create, Read, Update, Delete) directly with the Supabase backend tables defined in Phase 1. The existing IndexedDB persistence service (`persistence-service.ts`) will be kept but not used for these operations.

### Implementation Details

1.  **Create New Service File (`src/Persistence/supabase-service.ts`):** Create this file in your project. This will hold all functions that talk to Supabase for project data.
    ```typescript
    // src/Persistence/supabase-service.ts

    // Import the Supabase client creator function (adjust path as needed)
    import { createClient } from '@/utils/supabase/client';

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

    ```
2.  **Implement `getSupabaseProjectList` in `supabase-service.ts`:** Fetches project names and IDs.
    ```typescript
    // In src/Persistence/supabase-service.ts (append to file)
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
    ```
3.  **Implement `createSupabaseProject` in `supabase-service.ts`:** Creates project/settings in Supabase.
    ```typescript
    // In src/Persistence/supabase-service.ts (append to file)

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

        // Create the RPC function in Supabase SQL Editor first if not done already!
        /* SQL for RPC function 'create_new_project_rpc':
        CREATE OR REPLACE FUNCTION create_new_project_rpc(p_user_id uuid, p_project_name text)
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER -- Important for accessing auth.uid() if needed & inserting with correct user_id
        AS $$
        DECLARE
          new_project_id uuid;
        BEGIN
          -- Insert into projects table
          INSERT INTO public.projects (user_id, name)
          VALUES (p_user_id, p_project_name)
          RETURNING id INTO new_project_id;

          -- Insert default settings
          INSERT INTO public.project_settings (project_id, user_id, bpm, num_measures, is_playing, loop_enabled, is_instrument_sidebar_visible) -- Add all defaults
          VALUES (new_project_id, p_user_id, 120, 16, false, false, true); -- Specify default values

          RETURN new_project_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error in create_new_project_rpc: %', SQLERRM;
            RETURN NULL;
        END;
        $$;
        */

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
    ```
4.  **Implement `deleteSupabaseProject` in `supabase-service.ts`:** Deletes a project from Supabase.
    ```typescript
    // In src/Persistence/supabase-service.ts (append to file)
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
    ```
5.  **Implement `loadFullProjectFromSupabase` in `supabase-service.ts`:** Fetches all nested data for a project.
    ```typescript
    // In src/Persistence/supabase-service.ts (append to file)

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
    ```
6.  **Implement Item Save/Update Functions (`save` prefix) in `supabase-service.ts`:** Create functions using `.upsert()` to save individual data items.
    *   **`saveProjectSettings(settings: ProjectSettings)`:**
        ```typescript
        // In src/Persistence/supabase-service.ts (append)
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
        ```
    *   **`saveTrack(track: TrackData)`:**
        ```typescript
        // In src/Persistence/supabase-service.ts (append)
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
        ```
    *   **`saveSynth(synth: SynthData)`:**
        ```typescript
        // In src/Persistence/supabase-service.ts (append)
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
        ```
    *   **`saveEffect(effect: EffectData)`:**
        ```typescript
        // In src/Persistence/supabase-service.ts (append)
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
        ```
    *   **`saveMidiBlock(block: MidiBlockData)`:** (Saves block metadata, NOT notes)
        ```typescript
        // In src/Persistence/supabase-service.ts (append)
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
        ```
    *   **`saveMidiNotesBatch(notes: MidiNoteData[], blockId: string)`:** (Saves multiple notes for a block)
        ```typescript
        // In src/Persistence/supabase-service.ts (append)
        export async function saveMidiNotesBatch(notes: MidiNoteData[], blockId: string): Promise<boolean> {
             const userId = await getUserId();
             if (!userId || notes.length === 0) return false;
             console.log(`Saving batch of ${notes.length} notes for block ${blockId}...`);
             const dbData = notes.map(note => ({
                 id: note.id, // Primary Key for upsert
                 block_id: blockId,
                 user_id: userId,
                 start_beat: note.startBeat,
                 duration: note.duration,
                 velocity: note.velocity,
                 pitch: note.pitch
             }));
             // Upsert multiple notes in one go
             const { error } = await supabase.from('midi_notes').upsert(dbData);
             if (error) { console.error(`Error saving notes batch for block ${blockId}:`, error); return false; }
             console.log(`Notes batch saved for block ${blockId}.`); return true;
        }
        ```
7.  **Implement Item Deletion Functions (`delete` prefix) in `supabase-service.ts`:** Create functions for deleting individual items.
    *   **`deleteTrack(trackId: string)`:**
        ```typescript
        // In src/Persistence/supabase-service.ts (append)
        export async function deleteTrack(trackId: string): Promise<boolean> {
             const userId = await getUserId();
             if (!userId) return false;
             console.log(`Deleting track ${trackId} from Supabase...`);
             const { error } = await supabase.from('tracks').delete().eq('id', trackId);
             // RLS ensures ownership. Cascade delete handles related synth, effects, blocks, notes.
             if (error) { console.error("Error deleting track from Supabase:", error); return false; }
             // Cascade delete handles related synth, effects, blocks, notes.
             console.log("Track deleted (cascade initiated)."); return true;
        }
        ```
    *   **`deleteEffect(effectId: string)`:**
        ```typescript
        // In src/Persistence/supabase-service.ts (append)
        export async function deleteEffect(effectId: string): Promise<boolean> {
             const userId = await getUserId();
             if (!userId) return false;
             console.log(`Deleting effect ${effectId} from Supabase...`);
             const { error } = await supabase.from('track_effects').delete().eq('id', effectId);
             if (error) { console.error(`Error deleting effect ${effectId}:`, error); return false; }
             console.log(`Effect ${effectId} deleted.`); return true;
        }
        ```
    *   **`deleteMidiBlock(blockId: string)`:**
        ```typescript
        // In src/Persistence/supabase-service.ts (append)
        export async function deleteMidiBlock(blockId: string): Promise<boolean> {
             const userId = await getUserId();
             if (!userId) return false;
             console.log(`Deleting MIDI block ${blockId} from Supabase...`);
             const { error } = await supabase.from('midi_blocks').delete().eq('id', blockId);
             // Cascade delete handles related notes
             if (error) { console.error(`Error deleting MIDI block ${blockId}:`, error); return false; }
             console.log(`MIDI block ${blockId} deleted.`); return true;
        }
        ```
    *   **`deleteMidiNote(noteId: string)`:**
        ```typescript
        // In src/Persistence/supabase-service.ts (append)
        export async function deleteMidiNote(noteId: string): Promise<boolean> {
             const userId = await getUserId();
             if (!userId) return false;
             console.log(`Deleting MIDI note ${noteId} from Supabase...`);
             const { error } = await supabase.from('midi_notes').delete().eq('id', noteId);
             if (error) { console.error(`Error deleting MIDI note ${noteId}:`, error); return false; }
             console.log(`MIDI note ${noteId} deleted.`); return true;
        }
        ```
8.  **Retain (but do not use for primary persistence) `src/Persistence/persistence-service.ts`:** Leave the existing IndexedDB file in the project. Ensure no application logic (Zustand, UI) calls its project data saving/loading functions anymore. It serves only as a reference or potential fallback/cache if needed later, but is not part of the main Supabase-primary flow.

### Files Created/Modified in Phase 2
*   `src/Persistence/supabase-service.ts` (Created)
*   `src/Persistence/persistence-service.ts` (Retained, but no longer primary)

### File Details for Phase 2
*   **`src/Persistence/supabase-service.ts`:**
    *   **Interfaces Defined:** `ProjectMetadata`, `ProjectSettings`, `TrackData`, `SynthData`, `EffectData`, `MidiBlockData`, `MidiNoteData`, `AppProjectState`. Define the application-side data structures.
    *   **Functions Created:**
        *   `getSupabaseProjectList()`: Fetches basic project list from Supabase.
        *   `createSupabaseProject()`: Creates project/settings in Supabase (uses RPC).
        *   `deleteSupabaseProject()`: Deletes project from Supabase.
        *   `loadFullProjectFromSupabase()`: Fetches nested project data via joins and transforms it to `AppProjectState`.
        *   `saveProjectSettings()`, `saveTrack()`, `saveSynth()`, `saveEffect()`, `saveMidiBlock()`, `saveMidiNotesBatch()`: Implement `upsert` operations to save data items to Supabase.
        *   `deleteTrack()`, `deleteEffect()`, `deleteMidiBlock()`, `deleteMidiNote()`: Implement `delete` operations for individual items in Supabase.
*   **`src/Persistence/persistence-service.ts`:**
    *   **Status:** File remains in the project but its functions related to saving/loading project details (tracks, settings, notes etc.) are no longer called by the main application logic.

### Implementation Summary for Phase 2
This phase builds the dedicated communication layer (`supabase-service.ts`) for interacting with the Supabase backend. It contains functions using the Supabase client library to perform all necessary database operations (Create, Read, Update, Delete) for projects and their constituent parts. This includes fetching the project list, creating/deleting projects, loading the full state of a project with necessary data transformations, and saving/deleting individual items like tracks, settings, notes etc. The old IndexedDB service file is kept but effectively sidelined for core data persistence.

### Testing Phase 2

*   **Method:** Primarily manual testing by interacting with the application UI in the browser. Use Browser DevTools (Console, Network tab) and React DevTools extensively.
*   **Steps:**
    1.  **Project List UI:**
        *   Navigate to the page displaying the project list.
        *   Verify the list loads correctly (check against Supabase data). Check loading state (`isLoadingProjectList`).
        *   Click "Create Project", enter a name, submit. Verify loading state, new project appears in list, and application navigates/loads the new project.
        *   Click on an existing project. Verify loading state (`isLoadingProject`) and the editor UI loads with the correct data.
        *   Click the "Delete" button for a project. Verify the confirmation dialog appears. Confirm deletion. Verify the project is removed from the UI list and Supabase. Attempt to delete the currently loaded project and verify UI clears/handles it.
        *   Verify load errors from Phase 3 testing are displayed appropriately in the UI.
    2.  **Editor UI:**
        *   Load a project. Verify all elements (settings inputs, track headers, MIDI notes in piano roll, synth/effect parameters) display the correct data from the Zustand store.
        *   Verify loading indicators appear correctly when switching projects.
        *   Verify load error messages are displayed prominently if `loadProject` fails.
    3. **UI Interactions -> Zustand Actions:**
        *   **Settings:** Change BPM, loop points, etc., in the UI. Verify the changes are reflected immediately (optimistic update). Check React DevTools to see the corresponding Zustand action being called. Check Network tab/Supabase dashboard to confirm the async save occurs.
        *   **Tracks:** Rename a track, mute/solo. Verify UI updates instantly and saves asynchronously. Add a new track, delete a track. Verify changes in UI and Supabase.
        *   **MIDI Editor:** Drag a note. Verify smooth visual feedback *during* the drag (local state). Release the note. Verify the note visually snaps to the final position, the Zustand action is called (check React DevTools), and the change is saved to Supabase (check Network/dashboard). Add/delete notes and verify.
        *   **Synth/Effects:** Adjust parameters using sliders/knobs. Verify UI updates smoothly. Check React DevTools/Network tab to see if debounced save actions are triggered correctly after interaction stops.
    4. **Save/Error Feedback:**
        *   Perform various edits. Look for subtle "Saving..." / "Saved" indicators if implemented.
        *   Simulate a save failure (e.g., network disconnect, modify service temporarily). Perform an edit in the UI. Verify the optimistic update occurs, then reverts, and a user-friendly error message (from `saveError` state) is displayed (e.g., as a toast). Test any "Retry" functionality.
    5. **Authentication Guard:**
        *   Log out. Attempt to navigate directly to a protected route (e.g., `/editor/some-project-id`). Verify you are redirected to the `/login` page.
        *   Log in. Verify you can now access the protected routes.
        *   Test edge cases like trying to access protected routes while `authLoading` is still true (should show loading or wait).

---

## Phase 3: Integrate Persistence with State Management (Zustand)

### High-Level Goal
Refactor the Zustand store slices (`projectSlice.ts`, `trackSlice.ts`, `timeSlice.ts`, `uiSlice.ts`) to use `supabase-service.ts` for all persistence operations. Implement robust loading actions that distribute data across slices and saving actions that use optimistic updates with proper revert logic. Remove the intermediate `persistStore` layer.

### Implementation Details

1.  **Update Imports and Remove Old Persistence:**
    *   **In `src/store/projectSlice.ts`:**
        *   Remove `import * as P from '../Persistence/persistence-service';`
        *   Remove `import * as PersistProjectFns from './persistStore/persistProjectSlice';`
        *   Add `import * as supabaseService from '@/Persistence/supabase-service';` (adjust path if needed)
        *   Add `import type { AppProjectState, ProjectMetadata, ProjectSettings, TrackData /* other needed types */ } from '@/Persistence/supabase-service';`
    *   **In `src/store/trackSlice.ts`:**
        *   Remove `import * as PersistFns from './persistStore/persistTrackSlice';`
        *   Add `import * as supabaseService from '@/Persistence/supabase-service';` (adjust path if needed)
        *   Add `import type { TrackData, MidiBlockData, MidiNoteData, EffectData, SynthData /* other needed types */ } from '@/Persistence/supabase-service';`
        *   Ensure `Track`, `MIDIBlock`, `MIDINote` types used internally align with or map to Supabase service types.
    *   **In `src/store/timeSlice.ts`:**
        *   Remove `import { persistProjectSettings } from './persistStore/persistProjectSettings';`
        *   Add `import * as supabaseService from '@/Persistence/supabase-service';` (adjust path if needed)
        *   Add `import type { ProjectSettings } from '@/Persistence/supabase-service';`
    *   **In `src/store/uiSlice.ts`:**
        *   Remove `import { persistProjectSettings } from './persistStore/persistProjectSettings';`
        *   Add `import * as supabaseService from '@/Persistence/supabase-service';` (adjust path if needed)
        *   Add `import type { ProjectSettings } from '@/Persistence/supabase-service';`
    *   **In `src/store/store.ts`:**
        *   Remove `import * as P from '../Persistence/persistence-service';`
        *   Remove `import { deserializeSynth, deserializeEffect } from '../utils/persistenceUtils';` (or adapt if needed for Supabase data).
        *   Refactor `initializeStore` (later step) to use `supabaseService.getSupabaseProjectList` and `supabaseService.loadFullProjectFromSupabase` instead of `P.*` functions. The data hydration logic will need adjustment based on `AppProjectState` structure returned by `loadFullProjectFromSupabase`.
    *   **Delete `src/store/persistStore` directory** after migrating its logic (later step).

2.  **Define/Confirm Zustand State Structure:** Review and confirm the state variables within each slice necessary to hold project data and manage loading/saving status. Ensure consistency with the data structures defined in `supabase-service.ts` (`ProjectMetadata`, `ProjectSettings`, `TrackData`, etc.).
    *   **`projectSlice.ts` State:** Should include:
        *   `projectList: ProjectMetadata[]`
        *   `currentProjectId: string | null` (Renamed from `currentLoadedProjectId` for clarity)
        *   `isLoadingProject: boolean`
        *   `isLoadingProjectList: boolean`
        *   `loadError: string | null`
        *   `saveError: { itemId: string | null; message: string } | null`
    *   **`trackSlice.ts` State:** Should include:
        *   `tracks: TrackData[]` (This will hold the structure loaded from Supabase, including nested blocks/notes/etc.)
        *   `selectedTrackId: string | null`
        *   `selectedBlockId: string | null`
        *   `selectedNotes: MidiNoteData[] | null` (Adjust type based on `supabase-service.ts`)
        *   `clipboardBlock: MidiBlockData | null` (Adjust type)
        *   Remove `selectedTrack` and `selectedBlock` if they can be derived easily from `tracks` and selected IDs.
    *   **`timeSlice.ts` State:** No changes needed for Supabase integration itself, but confirm it holds `bpm`, `isPlaying`, `currentBeat`, `numMeasures`, `loopEnabled`, `loopStartBeat`, `loopEndBeat`.
    *   **`uiSlice.ts` State:** No changes needed for Supabase integration itself, but confirm it holds `isInstrumentSidebarVisible`, `selectedWindow`, `detailViewMode`.
    *   **`store.ts` (`AppState`):** Ensure the combined type includes all slices and an `authState` slice holding `user: User | null` and `authLoading: boolean`.

3.  **Implement Project List Loading Action (`loadProjectList` in `projectSlice.ts`):** Replace the existing `loadProjectList` action (which likely uses `P.getProjectMetadataList`) with the Supabase version.
    ```typescript
    // In src/store/projectSlice.ts (within createProjectSlice)
    loadProjectList: async () => {
        set({ isLoadingProjectList: true, loadError: null });
        try {
            // Call the Supabase service function
            const list = await supabaseService.getSupabaseProjectList();
            set({ projectList: list, isLoadingProjectList: false });
        } catch (error) {
            console.error("Zustand/ProjectSlice: Failed to fetch project list:", error);
            set({ loadError: "Could not load project list.", isLoadingProjectList: false, projectList: [] });
        }
    },
    ```

4.  **Implement Full Project Loading Action (`loadProject` in `projectSlice.ts`):** [Placeholder for next step]

5. **Implement Project Creation Action (`createProject` in `projectSlice.ts`):** [Existing content or placeholder for now]

6. **Implement Project Deletion Action (`deleteProject` in `projectSlice.ts`):** [Existing content or placeholder for now]

7. **Implement Data Saving Actions with Optimistic Updates:** [Existing content or placeholder for now]

8. **Refine Authentication Integration (`onAuthStateChange` in Layout/Provider):** [Existing content or placeholder for now]

### Files Created/Modified in Phase 3
*   `src/store/projectSlice.ts` (Modified)
*   `src/store/trackSlice.ts` (Modified)
*   `src/store/timeSlice.ts` (Modified)
*   `src/store/uiSlice.ts` (Modified)
*   `src/store/store.ts` (Modified)
*   `src/Persistence/supabase-service.ts` (Imported by slices)
*   Top-level component / Layout / Auth handling component (Modified `onAuthStateChange`)
*   **DELETED:** `src/store/persistStore/` directory and its contents.

### File Details for Phase 3
*   **Slice Files (`projectSlice.ts`, `trackSlice.ts`, `timeSlice.ts`, `uiSlice.ts`):**
    *   Imports updated to use `supabaseService`.
    *   Old persistence imports removed.
    *   State structure confirmed/updated for Supabase integration (Step 2).
    *   `projectSlice` updated with Supabase-backed `loadProjectList` action (Step 3).
*   **`store.ts`:**
    *   Old persistence imports removed.
    *   `initializeStore` marked for refactoring later.
*   **`persistStore` Directory:** Marked for deletion later.
*   [Other sections will be detailed in subsequent steps]

### Implementation Summary for Phase 3
This phase continues the refactor of Zustand slices. Step 1 updated imports. Step 2 confirms the necessary state structure within each slice. Step 3 implements the Supabase-backed action in `projectSlice` to fetch the list of user projects.

---

## Phase 4: UI Integration & Auth Enforcement

### High-Level Goal
Connect the UI components to the Zustand store actions for all data operations. Ensure that users are required to log in to access project-related features and that loading/error states are handled gracefully in the user interface.

### Implementation Details

1.  **Connect Project List UI (`src/components/ProjectsDisplay.tsx` or similar):**
    *   **Import `useStore`:** Import the Zustand hook: `import useStore from '@/store/store';` (adjust path).
    *   **Select State:** Inside the component, select the necessary state slices:
        ```typescript
        const projectList = useStore((state) => state.projectList);
        const isLoadingList = useStore((state) => state.isLoadingProjectList);
        const loadError = useStore((state) => state.loadError);
        const currentProjectId = useStore((state) => state.currentProjectId);
        // Select actions needed
        const fetchList = useStore((state) => state.fetchProjectList);
        const createProjectAction = useStore((state) => state.createProject);
        const deleteProjectAction = useStore((state) => state.deleteProject);
        const loadProjectAction = useStore((state) => state.loadProject);
        const user = useStore((state) => state.authState.user); // Get user for conditional rendering
        ```
    *   **Fetch List on Mount/User Change:** Use `useEffect` to fetch the list initially or when the user logs in.
        ```typescript
        useEffect(() => {
            // Fetch only if logged in
            if (user) {
                fetchList();
            }
            // Dependency array includes user to refetch if user logs in/out while component is mounted
        }, [user, fetchList]);
        ```
    *   **Render List:** Map over the `projectList` state to display project items. Show a loading indicator if `isLoadingList` is true. Show an error message if `loadError` has a value. Highlight the `currentProjectId` if it's in the list.
    *   **Create Button:** Add a button that prompts for a project name and then calls `createProjectAction(name)`. Disable the button while `isLoadingList` or `isLoadingProject` is true.
    *   **Delete Buttons:** Add delete buttons next to each project in the list. Add an `onClick` handler that shows a confirmation dialog (`if (window.confirm('Are you sure?')) { ... }`) and then calls `deleteProjectAction(projectId)`.
    *   **Load Buttons/Click Handlers:** Make each project item clickable. The `onClick` handler should call `loadProjectAction(projectId)`. Visually indicate which project is currently loading if `isLoadingProject` is true and the `currentProjectId` matches the item ID.

2.  **Connect Main Editor UI (DAW Interface - e.g., `app/editor/[projectId]/page.tsx` or components within):**
    *   **Select State:** Use `useStore` to select `currentProjectId`, `projectSettings`, `tracks`, `isLoadingProject`, `loadError`, `saveError`.
    *   **Handle Loading:** If `isLoadingProject` is true, render a full-page loading spinner or overlay.
    *   **Handle Load Error:** If `loadError` is set, display a prominent error message (e.g., "Could not load project: [loadError message]") and potentially a button to retry loading or go back to the project list.
    *   **Handle No Project:** If `currentProjectId` is `null` (and not loading/error), display a message like "No project selected" or redirect to the project list page.
    *   **Render Content:** Pass the `projectSettings` and `tracks` data as props to the respective UI components (Track Headers, Piano Roll, Mixer, Settings Panels, etc.).

3.  **Connect UI Interactions to Zustand Actions:** Wire up user inputs and actions in the editor UI.
    *   **Settings Panel:** Inputs for BPM, loop range, etc., should have `onChange` handlers that call the corresponding Zustand action (e.g., `useStore.getState().updateProjectSettings({ bpm: newBpmValue })`). Use debouncing here if updates trigger frequently.
    *   **Track Header:** Mute/Solo buttons call actions like `toggleTrackMute(trackId)`. Name input calls `updateTrackName(trackId, newName)` on blur or enter. Add/Delete track buttons call `addTrack()`, `deleteTrackInStore(trackId)`.
    *   **MIDI Editor (Piano Roll):**
        *   **Dragging:** Use local component state (`useState`) to track the note being dragged and its current visual position during the drag operation itself. Update this local state on mouse move events.
        *   **Drop (Mouse Up):** On mouse up, calculate the final `startBeat` and `pitch`. Call a Zustand action like `updateNoteProperties(noteId, { startBeat: finalStartBeat, pitch: finalPitch })`. This action performs the optimistic update in the main `tracks` state and calls the debounced `saveMidiNotesBatch` (or individual `saveMidiNote`).
        *   **Adding Note:** Double-clicking or drawing calls `addNote(trackId, blockId, newNoteData)`.
        *   **Deleting Note:** Selecting and hitting delete calls `deleteNoteInStore(noteId)`.
    *   **Synth/Effect Panels:** Sliders, knobs, dropdowns call actions like `updateSynthSetting(trackId, paramKey, newValue)` or `updateEffectSetting(effectId, paramKey, newValue)`. Use debouncing heavily here.

4.  **Display Save/Error Status in Editor:**
    *   Read the `saveError` state. If set, display a non-intrusive notification (e.g., a small toast message) indicating the specific error (e.g., `saveError.message` related to `saveError.itemId`). Include a "Dismiss" or "Retry" option if appropriate.
    *   (Optional) Read an `isSaving` state map. Display subtle "Saving..." indicators next to elements that are currently being saved asynchronously to Supabase. Change to "✓ Saved" briefly on success.

5.  **Enforce Authentication (Client-Side Guard):** Create a component or use logic in your layout to protect routes.
    *   **Create `AuthGuard` Component (Example):**
        ```typescript
        // components/AuthGuard.tsx
        import { useEffect } from 'react';
        import { useRouter } from 'next/navigation';
        import useStore from '@/store/store'; // Adjust path

        export function AuthGuard({ children }: { children: React.ReactNode }) {
            const user = useStore((state) => state.authState.user);
            const authLoading = useStore((state) => state.authState.authLoading);
            const router = useRouter();

            useEffect(() => {
                // Redirect if auth check is complete and user is not logged in
                if (!authLoading && !user) {
                    router.push('/login'); // Redirect to your login page
                }
            }, [user, authLoading, router]);

            // Show loading indicator while authentication is resolving
            if (authLoading) {
                return <div>Loading authentication...</div>; // Or a proper spinner
            }

            // Render children only if user is authenticated (or auth still loading)
            // The redirect handles the case where user becomes null after loading
            if (user) {
                 return <>{children}</>;
            }

            // Optionally return null or loading indicator while redirecting
            return null;
        }
        ```
    *   **Wrap Protected Pages/Layouts:** In your `app/layout.tsx` or specific page layouts that require authentication (like the editor layout), wrap the `children` prop with `<AuthGuard>`:
        ```typescript
        // Example in a protected layout.tsx
        import { AuthGuard } from '@/components/AuthGuard';

        export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
          return (
            <AuthGuard>
              {/* Header, Sidebar specific to logged-in users */}
              <main>{children}</main>
            </AuthGuard>
          );
        }
        ```

### Files Created/Modified in Phase 4
*   UI Components (`src/components/ProjectsDisplay.tsx`, DAW components, settings panels, MIDI editor, etc.) (Modified)
*   Page Components (`app/projects/page.tsx`, `app/editor/[projectId]/page.tsx`, etc.) (Modified)
*   Routing / Layout Components (`app/layout.tsx`, custom auth wrapper) (Modified)
*   `src/components/AuthGuard.tsx` (Created)
*   `src/store/store.ts` (or slices) (Possibly Modified - e.g., adding `isSaving` flags)

### File Details for Phase 4
*   **UI Components:**
    *   **Logic Added:** Components now read data and loading/error states from Zustand via `useStore`. User interactions (clicks, changes, drags) now trigger Zustand *actions* (e.g., `loadProject`, `updateProjectSettings`, `updateNotePosition`). Loading indicators and error messages are displayed based on Zustand state. MIDI editor handles drag locally, calls Zustand action on drop.
*   **Page Components:**
    *   **Logic Added:** Use `useEffect` hooks to trigger initial data loading via Zustand actions (e.g., `loadProject` using the `projectId` from route params). May be wrapped by `AuthGuard`.
*   **Routing / Layout Components:**
    *   **Components Created/Modified:** `AuthGuard` component created to check Zustand auth state and perform client-side redirects. Protected layouts/pages now utilize `AuthGuard` to prevent access by unauthenticated users.
*   **`src/store/store.ts` (or slices):**
    *   **State Added:** Optional: More granular `isSaving` state flags might be added to track specific background save operations if needed for detailed UI feedback.

### Implementation Summary for Phase 4
This phase connects the user interface to the application's brain (Zustand) and data layer (Supabase service). UI components now get their data from the Zustand store and trigger updates by calling Zustand actions. Loading states and error messages reflect the state managed in the store. Optimistic updates ensure a responsive feel, while background saves communicate with Supabase. Client-side authentication guards are added to protected routes, redirecting users if they are not logged in.

### Testing Phase 4

*   **Method:** Primarily manual testing by interacting with the application UI in the browser. Use Browser DevTools (Console, Network tab) and React DevTools extensively.
*   **Steps:**
    1.  **Project List UI:**
        *   Navigate to the page displaying the project list.
        *   Verify the list loads correctly (check against Supabase data). Check loading state (`isLoadingProjectList`).
        *   Click "Create Project", enter a name, submit. Verify loading state, new project appears in list, and application navigates/loads the new project.
        *   Click on an existing project. Verify loading state (`isLoadingProject`) and the editor UI loads with the correct data.
        *   Click the "Delete" button for a project. Verify the confirmation dialog appears. Confirm deletion. Verify the project is removed from the UI list and Supabase. Attempt to delete the currently loaded project and verify UI clears/handles it.
        *   Verify load errors from Phase 3 testing are displayed appropriately in the UI.
    2.  **Editor UI:**
        *   Load a project. Verify all elements (settings inputs, track headers, MIDI notes in piano roll, synth/effect parameters) display the correct data from the Zustand store.
        *   Verify loading indicators appear correctly when switching projects.
        *   Verify load error messages are displayed prominently if `loadProject` fails.
    3.  **UI Interactions -> Zustand Actions:**
        *   **Settings:** Change BPM, loop points, etc., in the UI. Verify the changes are reflected immediately (optimistic update). Check React DevTools to see the corresponding Zustand action being called. Check Network tab/Supabase dashboard to confirm the async save occurs.
        *   **Tracks:** Rename a track, mute/solo. Verify UI updates instantly and saves asynchronously. Add a new track, delete a track. Verify changes in UI and Supabase.
        *   **MIDI Editor:** Drag a note. Verify smooth visual feedback *during* the drag (local state). Release the note. Verify the note visually snaps to the final position, the Zustand action is called (check React DevTools), and the change is saved to Supabase (check Network/dashboard). Add/delete notes and verify.
        *   **Synth/Effects:** Adjust parameters using sliders/knobs. Verify UI updates smoothly. Check React DevTools/Network tab to see if debounced save actions are triggered correctly after interaction stops.
    4.  **Save/Error Feedback:**
        *   Perform various edits. Look for subtle "Saving..." / "Saved" indicators if implemented.
        *   Simulate a save failure (e.g., network disconnect, modify service temporarily). Perform an edit in the UI. Verify the optimistic update occurs, then reverts, and a user-friendly error message (from `saveError` state) is displayed (e.g., as a toast). Test any "Retry" functionality.
    5.  **Authentication Guard:**
        *   Log out. Attempt to navigate directly to a protected route (e.g., `/editor/some-project-id`). Verify you are redirected to the `/login` page.
        *   Log in. Verify you can now access the protected routes.
        *   Test edge cases like trying to access protected routes while `authLoading` is still true (should show loading or wait).

---

## Phase 5: Refinements & Testing

### High-Level Goal
Optimize performance for high-frequency updates (like MIDI editing), improve error handling and user feedback mechanisms, handle potential edge cases, and conduct comprehensive testing to ensure the application's stability, data integrity, and overall reliability.

### Implementation Details

1.  **Performance Optimization (Debouncing/Throttling):** Reduce the number of Supabase save requests for rapidly changing data.
    *   **Identify Targets:** Interactions like dragging notes/blocks, adjusting sliders/knobs for synth/effect parameters, potentially resizing blocks.
    *   **Import Utility:** Add a debounce/throttle library: `npm install lodash.debounce lodash.throttle` and `@types/lodash.debounce @types/lodash.throttle` (or use a built-in hook if your framework provides one).
    *   **Apply in Zustand Store (`src/store/store.ts` or slices):** Wrap the Supabase *service call* within a debounced or throttled function inside your Zustand actions.
        *   **Example (Debounce for Synth Setting):**
            ```typescript
            // Import debounce at the top of the store file
            import debounce from 'lodash.debounce';

            // Inside Zustand create() function
            // Define the debounced function once, likely outside the action definition itself
            // if it needs to maintain its timer across multiple calls to the action trigger.
            // It might be better defined alongside the state slice definition.
            debouncedSaveSynthFn: debounce(async (synthData: SynthData) => {
                console.log("Debounced: Saving synth...", synthData);
                const success = await supabaseService.saveSynth(synthData);
                if (!success) {
                    // Handle save failure - maybe set a specific error state?
                    console.error(`Debounced save failed for synth on track ${synthData.trackId}`);
                    // Avoid setting global saveError here directly, let the calling action handle UI feedback?
                    // Or set a specific synth save error state.
                } else {
                     console.log(`Debounced save successful for synth on track ${synthData.trackId}`);
                }
            }, 1000), // Adjust delay (in ms) as needed (e.g., 1000ms = 1 second)

            // Action triggered by UI slider/knob change
            updateSynthSetting: (trackId: string, settingKey: string, value: any) => {
                // Get current state
                const tracks = get().tracks;
                const trackIndex = tracks.findIndex(t => t.id === trackId);
                if (trackIndex === -1 || !tracks[trackIndex].synth) return;

                // 1. Optimistic Update (Update Zustand state immediately)
                const newTracks = [...tracks];
                const updatedSynth = {
                     ...newTracks[trackIndex].synth!,
                     settings: { ...newTracks[trackIndex].synth!.settings, [settingKey]: value }
                };
                newTracks[trackIndex] = { ...newTracks[trackIndex], synth: updatedSynth };
                set({ tracks: newTracks });

                // 2. Trigger the debounced save function with the updated data
                get().debouncedSaveSynthFn(updatedSynth);
            },
            ```
        *   **Apply similar debouncing/throttling** to actions handling MIDI note position updates (on drop, perhaps throttle updates during drag if needed for collaboration later), etc. Choose debounce (waits for pause) or throttle (limits rate) based on the interaction.

2.  **Improve Error Handling & User Feedback:** Make errors less jarring and more informative.
    *   **Specific Error Messages:** Instead of generic "Save Failed", try to provide more context if the Supabase error object (`error` returned from service functions) gives details. Display these in UI toasts or specific error sections.
    *   **Retry Mechanisms:** For network-related save errors, provide a "Retry" button in the error notification/UI that calls the relevant Zustand save action again.
    *   **Clearer Loading/Saving States:** Use distinct visual cues (spinners, disabled buttons, subtle background changes) for `isLoadingProject`, `isLoadingProjectList`, and potentially the granular `isSaving` states. Provide clear "Saved" confirmation messages (e.g., temporary toasts).

3.  **Handle Edge Cases:** Consider less common scenarios.
    *   **Rapid Clicks / Race Conditions:** Ensure loading/saving flags (`isLoadingProject`, `isSaving`) reliably disable buttons to prevent duplicate actions being fired before the first one completes.
    *   **Stale Data (Long-Open Tabs):** If it's critical that users always see the absolute latest version (e.g., frequent external changes), implement:
        *   **Periodic Refetch:** Use `setInterval` in a `useEffect` to call `fetchProjectList` or even `loadProject` (if current project might change) every few minutes *only if the tab is active*.
        *   **(Or Later) Realtime:** Implement Supabase Realtime subscriptions (Option 3 from comparison) to listen for database changes and update Zustand automatically. This is more complex but provides instant updates.
    *   **Browser Storage:** If using `localStorage` for `lastProjectId` or other preferences, wrap access in `try...catch` blocks to handle potential browser restrictions or quota errors.

4.  **Comprehensive Testing:** Ensure reliability and correctness.
    *   **Unit Tests (Jest/Vitest):**
        *   Test Zustand store actions in isolation. Mock the `supabase-service.ts` functions to verify that actions update state correctly (optimistic updates) and call the service functions with the right arguments. Test state changes on mocked success/failure from the service. Test debouncing logic.
    *   **Integration Tests (React Testing Library / Vitest):**
        *   Test components that interact with the Zustand store. Render the component, simulate user interactions (clicks, typing), and assert that the correct Zustand actions are called and the UI updates as expected based on mock state changes.
    *   **End-to-End (E2E) Tests (Cypress/Playwright):**
        *   Automate full user flows in a real browser environment. Script tests for:
            *   Login -> Create Project -> Add Track -> Add Notes -> Change Settings -> Save -> Reload -> Verify Data Persists.
            *   Login -> Load Existing Project -> Modify -> Verify Save.
            *   Login -> Delete Project -> Verify list updates.
            *   Attempting access when logged out -> Verify redirect to login.
            *   Simulate network error during save -> Verify UI error state and optimistic revert (if possible).
    *   **Manual Testing:** Click through every feature and scenario:
        *   Verify all CRUD operations work for projects, tracks, settings, effects, blocks, notes.
        *   Check loading/saving indicators and error messages are clear and accurate.
        *   Test navigation between projects.
        *   Test RLS by manually trying to construct Supabase client calls (in browser console) to access another user's data (should fail).
        *   Test across different browsers (Chrome, Firefox, Safari).

### Files Created/Modified in Phase 5
*   `src/store/store.ts` (or slices) (Modified for debouncing/throttling)
*   Various UI Components (Modified for improved error display, loading states, retry buttons)
*   Testing files (e.g., `*.test.ts`, `*.spec.ts`, E2E test scripts) (Created)

### File Details for Phase 5
*   **`src/store/store.ts` (or slices):**
    *   **Logic Added:** Implemented debouncing/throttling for specific actions (e.g., `updateSynthSetting`, potentially MIDI updates) using imported utilities like `lodash.debounce`. The action now updates local state immediately and triggers the debounced/throttled function which contains the call to the `supabase-service` save function.
*   **UI Components:**
    *   **UI Modified:** Enhanced display of loading states (more granular if `isSaving` map is used). Improved presentation of `saveError`/`loadError` messages (more context, clearer visuals, potential 'Retry' buttons linked to relevant Zustand actions). Added subtle 'Saved' confirmations.
*   **Testing Files:**
    *   **Tests Created:** New files containing unit tests for Zustand actions/reducers (mocking Supabase service), integration tests for components interacting with the store, and E2E test scripts automating user flows.

### Implementation Summary for Phase 5
This final phase polishes the application for production use. Performance bottlenecks from frequent database saves are addressed by implementing debouncing/throttling on relevant user interactions. Error handling is made more robust and user-friendly with clearer messages and potential retry options. Edge cases like stale data and rapid clicks are considered. Finally, comprehensive testing across unit, integration, and end-to-end levels ensures the system is stable, secure, and functions correctly as the primary interface to the Supabase backend.
