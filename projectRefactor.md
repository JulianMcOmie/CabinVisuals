# Project Persistence Refactor Plan

## 1. Current State Analysis (Based on original `src/store/store.ts`)

The current persistence mechanism relies on Zustand's `persist` middleware configured to use `localStorage`.

*   **Mechanism:** `persist` middleware wraps the Zustand store.
*   **Storage:** `createJSONStorage(() => localStorage)` is used, meaning data is saved as a single JSON string in the browser's `localStorage` under the key `cabin-visuals-storage`.
*   **Scope:** Only *one* implicit project's state is stored. There is no concept of multiple projects or switching between them in the persisted state.
*   **Trigger:** Persistence is triggered automatically by the middleware when the state changes (potentially debounced).
*   **Serialization (`partialize`):**
    *   Takes the entire live `AppState`.
    *   Selects specific simple state fields (`bpm`, `loopEnabled`, UI settings, etc.).
    *   Crucially, iterates through the live `tracks` array.
    *   For each track, it serializes the live `SynthesizerInstance` and `EffectInstance` objects by extracting their constructor name (`type`) and calling `getSettings()` (or accessing the `properties` map) to get a plain `settings` object.
    *   MIDI blocks and notes within tracks are also serialized into plain objects/arrays.
    *   Outputs a single large JavaScript object (`PersistentState` containing `SerializableTrack` etc.) representing the essential state of the implicit project.
*   **Deserialization (`merge`):**
    *   Takes the single object parsed from the `localStorage` JSON string.
    *   Reconstructs the `AppState`.
    *   For simple fields, it assigns the persisted values.
    *   For tracks, it iterates through the `SerializableTrack` data.
    *   Uses the `type` string and constructor maps (`synthesizerConstructors`, `effectConstructors`) to instantiate *new* live Synth/Effect objects (`new Constructor()`).
    *   Uses the `applySettings` helper to configure these new instances using the stored `settings`.
    *   Rebuilds the `tracks` array with live instances and associated MIDI data.
    *   Performs post-merge steps (like setting TimeManager BPM).

**Limitations:** Single project only, potentially large `localStorage` entry, inefficient updates (whole state saved even for small changes), difficult to query or sync granularly.

## 2. Goal of Refactor

Transition from the single-project `localStorage` blob to a multi-project system using a granular IndexedDB structure. This aims for:

*   Support for multiple named projects.
*   More efficient storage and updates (saving only changed entities where feasible).
*   A persistence layer that aligns better with potential future cloud synchronization (e.g., Supabase/AWS) by handling data in smaller, logical units.
*   Explicit control over *when* and *what* gets persisted.

## 3. Proposed Architecture: Granular IndexedDB + Action-Triggered Persistence

This approach removes the `persist` middleware entirely and implements persistence manually.

### 3.1. Key Changes

*   **Remove `persist` Middleware:** The `persist(...)` wrapper and its configuration (`partialize`, `merge`, `storage`) will be removed from `src/store/store.ts`.
*   **New IndexedDB Schema:** Implement a more normalized schema in IndexedDB to store data granularly.
*   **Persistence Service:** Create a dedicated module (`src/Persistence/persistence-service.ts`) to handle all interactions with IndexedDB (CRUD operations for projects, tracks, notes, etc.).
*   **Action-Triggered Saves:** Modify Zustand actions (in slices like `timeSlice`, `trackSlice`, etc.) to call functions in the Persistence Service *after* they update the live Zustand state.
*   **Manual Loading:** Implement project loading logic within `initializeStore` (or a similar app startup process) that uses the Persistence Service to fetch data and hydrate the initial Zustand state.
*   **Distributed Serialization/Deserialization:** The logic currently in `partialize`/`merge` for handling Synth/Effect instances will be reused but invoked explicitly by the Persistence Service during saving/loading operations for those specific data types.

### 3.2. Proposed IndexedDB Schema (`CabinVisualsDB`)

*(Using object stores)*

*   **`appConfig`**
    *   **Purpose:** Store global application configuration not tied to a specific project.
    *   **Key:** String literal key, e.g., `'currentProjectId'`.
    *   **Value:** `string | null` (Stores the ID of the project currently loaded in the Zustand state).
*   **`projectMetadata`**
    *   **Purpose:** Store basic information about each project.
    *   **Key:** `projectId` (String, unique identifier like UUID).
    *   **Value:** `{ name: string }` (Potentially add `createdAt`, `lastModified` later).
*   **`projectSettings`**
    *   **Purpose:** Store project-level settings not part of tracks.
    *   **Key:** `projectId` (String).
    *   **Value:** `{ bpm?: number, isPlaying?: boolean, loopEnabled?: boolean, loopStartBeat?: number | null, loopEndBeat?: number | null, numMeasures?: number, isInstrumentSidebarVisible?: boolean, selectedWindow?: string | null }` (Essentially the non-track parts of the old `PersistentState`).
*   **`tracks`**
    *   **Purpose:** Store metadata for each track.
    *   **Key:** `trackId` (String, unique identifier).
    *   **Value:** `{ projectId: string, name: string, isMuted: boolean, isSoloed: boolean }`.
    *   **Index:** Create an index on `projectId` to efficiently retrieve all tracks belonging to a specific project.
*   **`trackSynths`**
    *   **Purpose:** Store the *serializable* state of the synthesizer for each track.
    *   **Key:** `trackId` (String) - Assumes one synth per track.
    *   **Value:** `{ type: string, settings: Record<string, any> }` (Plain object, `type` is constructor name).
*   **`trackEffects`**
    *   **Purpose:** Store the *serializable* state of effect instances on tracks.
    *   **Key:** `effectId` (String, unique identifier for the effect instance).
    *   **Value:** `{ trackId: string, order: number, type: string, settings: Record<string, any> }` (`type` is constructor name, `order` indicates position in chain).
    *   **Index:** Create an index on `trackId` to efficiently retrieve all effects for a specific track.
*   **`midiBlocks`**
    *   **Purpose:** Store metadata for MIDI blocks (clips).
    *   **Key:** `blockId` (String, unique identifier).
    *   **Value:** `{ trackId: string, startBeat: number, endBeat: number }`.
    *   **Index:** Create an index on `trackId` to efficiently retrieve all blocks for a specific track.
*   **`midiNotes`**
    *   **Purpose:** Store individual MIDI notes.
    *   **Key:** `noteId` (String, unique identifier).
    *   **Value:** `{ blockId: string, pitch: number, velocity: number, startBeat: number, duration: number }` (Align with `MIDINote` type, ensure `blockId` is present).
    *   **Index:** Create an index on `blockId` to efficiently retrieve all notes for a specific block.

### 3.3. Persistence Service (`src/Persistence/persistence-service.ts`)

This module will contain async functions to interact with the IndexedDB schema. Examples:

*   **Project Level:**
    *   `getProjectMetadataList(): Promise<Array<{id: string, name: string}>>`
    *   `createNewProject(name: string): Promise<projectId>`
    *   `deleteProject(projectId): Promise<void>` (Handles deleting metadata, settings, and cascading deletes for tracks, blocks, etc.)
    *   `renameProject(projectId, newName): Promise<void>`
    *   `getCurrentProjectId(): Promise<string | null>`
    *   `setCurrentProjectId(projectId: string | null): Promise<void>`
*   **Loading:**
    *   `loadFullProject(projectId): Promise<AppState | null>` (Or the relevant parts needed to initialize Zustand). This function will perform multiple DB reads across stores (using indexes) and assemble the state, including deserializing synths/effects.
*   **Saving/Updating (Triggered by Actions):**
    *   `saveProjectSettings(projectId, settings): Promise<void>`
    *   `saveTrack(trackData): Promise<void>` (Saves data to `tracks` store).
    *   `saveSynth(trackId, synthData): Promise<void>` (Expects *serialized* `synthData`).
    *   `saveEffect(effectData): Promise<void>` (Expects *serialized* `effectData`).
    *   `saveMidiBlock(blockData): Promise<void>`
    *   `saveMidiNote(noteData): Promise<void>`
    *   *(Note: Update operations like `updateTrackName` would likely involve reading the record, modifying it, and writing it back, all handled within the service function).*
*   **Deleting Granular Data:**
    *   `deleteTrack(trackId): Promise<void>` (Handles deleting synth, effects, blocks, notes associated with the track).
    *   `deleteEffect(effectId): Promise<void>`
    *   `deleteMidiBlock(blockId): Promise<void>` (Handles deleting associated notes).
    *   `deleteMidiNote(noteId): Promise<void>`
*   **Serialization Helpers (Internal or Exported):**
    *   `serializeSynth(instance: SynthesizerInstance): { type: string, settings: any }`
    *   `deserializeSynth(data: { type: string, settings: any }): SynthesizerInstance | null`
    *   (Similar helpers for Effects).

### 3.4. Zustand Store Modifications (`src/store/store.ts` and slices)

*   Remove `persist` middleware and its config.
*   Add state for project management: `projectList: ProjectMetadata[]`, `currentLoadedProjectId: string | null`.
*   Add actions for project management UI: `loadProjectList`, `switchProjectAndUpdate`, `createNewProjectAndUpdate`, etc. These actions will primarily call functions from the Persistence Service and potentially trigger `window.location.reload()` for switching.
*   Modify existing actions (e.g., `addTrack`, `updateTrackName`, `addNoteToBlock`, `updateSynthSetting`) to:
    1.  Perform the immutable state update using `set()`.
    2.  Call the *corresponding* save/update function from the Persistence Service (e.g., `persistenceService.saveTrack(...)`, `persistenceService.saveNote(...)`).
    3.  Ensure necessary serialization happens *before* calling the persistence function if saving complex objects like synths/effects.

### 3.5. Application Initialization / Loading

*   The main application entry point (e.g., `app/projects/page.tsx` or `main.tsx`) needs to manage the asynchronous initialization.
*   It will call an `initializeStore` function (exported from `store.ts`).
*   `initializeStore` will:
    1.  Call `persistenceService.getCurrentProjectId()`.
    2.  If an ID exists, call `persistenceService.loadFullProject(projectId)`.
    3.  Create the Zustand store using the loaded data (or default empty state if no project ID/data).
    4.  Return the `useStore` hook.
*   The UI needs to handle the loading state until the store is ready.

### 3.6. Project Switching

*   A UI element triggers the `switchProjectAndUpdate(newProjectId)` action in the store.
*   This action calls `persistenceService.setCurrentProjectId(newProjectId)`.
*   If successful, it triggers `window.location.reload()`.
*   The reload process naturally invokes the Initialization/Loading flow described above, loading the newly selected project.

## 4. Benefits of New Approach

*   Supports multiple projects.
*   More efficient IndexedDB updates for granular changes.
*   Clear separation between live state management (Zustand) and persistence logic (Persistence Service).
*   Action-triggered saves provide explicit control.
*   Structure aligns well with future potential database synchronization APIs (sending granular updates).

## 5. Challenges

*   Increased implementation complexity compared to `persist` middleware.
*   Requires careful implementation of the Persistence Service, especially the `loadFullProject` logic.
*   Need to ensure all relevant state-mutating actions correctly call their corresponding persistence functions.
*   Requires handling the async nature of store initialization in the UI.

</rewritten_file> 