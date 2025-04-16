# Video Export Architecture

This document outlines the proposed architecture for adding client-side video export functionality to the Cabin Visuals application. The goal is to allow users to render a video of the visualization synchronised with the loaded audio track directly in their browser.

## Core Concepts

-   **Client-Side Processing:** The entire video creation process (frame capture, encoding) happens within the user's browser using libraries like `ffmpeg.wasm`.
-   **Offline Rendering:** The export process operates independently of the real-time playback loop. It involves stepping through time frame-by-frame, rendering each frame explicitly, capturing it, and then combining frames with audio.
-   **Store as Orchestrator:** The Zustand store is the central coordinator for the export process, managing state, triggering actions, and interacting with other managers (`TimeManager`, `AudioManager`, `ExportManager`).
-   **Passive Export Manager:** A dedicated `ExportManager` class handles the complexities of interacting with `ffmpeg.wasm` (loading, file system, command execution) but does not manage application time or state directly.

## Components and Responsibilities

1.  **Zustand Store (`src/store/store.ts`)**
    *   **State Management:**
        *   `isExporting: boolean`: Tracks whether an export process is currently active. Used to control UI elements and R3F frameloop.
        *   `exportProgress: number`: Stores the progress (0 to 1) of the current export process. Updated internally by the `startVideoExport` action.
        *   `exportManagerInstance: ExportManager | null`: Holds the instance of the `ExportManager`.
        *   `r3fContext: { gl, canvas, invalidate } | null`: Stores essential React Three Fiber context required for capturing frames.
    *   **Actions:**
        *   `registerR3FContext(...)`: Called by `VisualizerView` to provide the necessary R3F context (`gl`, `canvas`, `invalidate`) to the store and initialize the `ExportManager` instance.
        *   `seekTo(beat): Promise<void>`: **(Modified for Export)** This action updates the application's `currentBeat`, seeks the `TimeManager` and `AudioManager`. Crucially, when `isExporting` is true, it also calls `invalidate()` on the R3F context and returns a Promise that resolves *after* the next `requestAnimationFrame`, ensuring the scene has likely re-rendered for the target beat before proceeding.
        *   `startVideoExport(options): Promise<void>`: The main orchestrator action. It controls the entire export lifecycle (described below).
    *   **Orchestration:** The store initiates and controls the step-by-step process of seeking time, rendering frames, capturing data, interacting with `ExportManager`, and managing state updates.

2.  **`ExportManager` (`src/lib/ExportManager.ts`)**
    *   **Purpose:** A dedicated utility class acting as an interface to `ffmpeg.wasm`.
    *   **Responsibilities:**
        *   Loading `ffmpeg.wasm`.
        *   Managing `ffmpeg.wasm`'s virtual file system (MEMFS).
        *   Receiving rendered frame data (as `Blob`s) and writing them sequentially to MEMFS (e.g., `frame_00001.png`, `frame_00002.png`, ...).
        *   Receiving prepared audio data (as a WAV `ArrayBuffer`) and writing it to MEMFS (e.g., `audio.wav`).
        *   Executing the FFmpeg command to combine the image sequence and audio file into a video format (e.g., MP4).
        *   Reading the resulting video file from MEMFS.
        *   Cleaning up temporary files in MEMFS.
    *   **Decoupling:** It has no knowledge of the application's time, state, or other managers. It simply processes the data given to it.

3.  **`VisualizerView` (`src/components/VisualizerView.tsx`)**
    *   **Context Provider:** Uses R3F's `useThree` hook to get `gl`, `canvas`, and `invalidate` and registers this context with the Zustand store via `registerR3FContext` (likely within a `useEffect`).
    *   **UI Trigger:** Contains the UI element (e.g., an "Export Video" button) that calls the store's `startVideoExport` action.
    *   **UI Placement (`app/page.tsx`):** An "Export Video" button should be added to the UI. A suitable location would be within the `visualizer-container` div in `app/page.tsx`, potentially near the `VisualizerView` component itself or in a shared control area if one exists. This button's `onClick` handler will ultimately trigger the `startVideoExport` action from the Zustand store. The button should be disabled when `isExporting` is true or when audio is not loaded (`!isAudioLoaded`).
    *   **Conditional Rendering:**
        *   Sets the `<Canvas>` component's `frameloop` prop to `"demand"` when `isExporting` is true (preventing automatic rendering) and `"always"` otherwise.
        *   Displays export progress and status based on `isExporting` and `exportProgress` state from the store.

4.  **`AudioManager` (`src/lib/AudioManager.ts`)**
    *   **Data Provider:** Provides access to the decoded `AudioBuffer` and the `sampleRate` via getter methods (e.g., `getAudioBuffer()`, `get sampleRate()`).

5.  **`TimeManager` (`src/lib/TimeManager.ts`)**
    *   **Time Calculation:** Used by the store (within `seekTo`) to convert beats to time offsets for audio seeking.

## Export Process Flow (`startVideoExport` Action)

1.  **Prerequisites Check:** The action verifies that R3F context is registered, `ExportManager` is initialized, audio is loaded, and no export is already in progress.
2.  **Initialization:**
    *   Sets `isExporting` to `true` and `exportProgress` to `0`.
    *   Calls `exportManagerInstance.initializeExport(options)` to load `ffmpeg.wasm` and prepare the virtual file system.
3.  **Parameter Calculation:** Determines the target duration (e.g., 4 beats), converts it to seconds using the current BPM, and calculates the `totalFrames` based on the desired `fps`.
4.  **Frame Loop:** Iterates from frame `0` to `totalFrames - 1`.
    *   **Calculate Beat:** Determines the precise `frameBeat` corresponding to the current frame index `i`.
    *   **Seek & Wait:** Calls `await get().seekTo(frameBeat)`. This updates the application state and waits (via the Promise) for the R3F scene to likely render the visuals for `frameBeat`.
    *   **Capture Frame:** Captures the current content of the R3F `<canvas>` as an image `Blob` using `canvas.toBlob(...)`.
    *   **Add Frame:** Calls `await exportManagerInstance.addFrame(frameBlob)` to store the frame data in `ffmpeg.wasm`.
    *   **Update Progress:** Updates the store's internal `exportProgress` state: `set({ exportProgress: (i + 1) / totalFrames })`.
    *   **(Cancellation Check):** Periodically checks if `isExporting` is still true to allow for potential cancellation.
5.  **Audio Preparation:**
    *   Retrieves the full `AudioBuffer` from `AudioManager`.
    *   Calculates the audio duration needed (matching the video duration).
    *   Uses a helper function (`sliceAndConvertToWav`) to extract the required audio segment and convert it into a WAV format `ArrayBuffer`.
6.  **Finalization:**
    *   Calls `await exportManagerInstance.finalizeExport(audioWavData)` which:
        *   Writes the `audioWavData` to MEMFS.
        *   Executes the FFmpeg command (e.g., `ffmpeg -framerate fps -i frame_%05d.png -i audio.wav -c:v libx264 -c:a aac -pix_fmt yuv420p output.mp4`).
        *   Reads the resulting `output.mp4` file.
        *   Returns the video data as a `Blob`.
7.  **Download:** Uses a helper function (`triggerDownload`) to initiate a browser download of the returned video `Blob`.
8.  **Cleanup:**
    *   Calls `await exportManagerInstance.cleanup()` to remove temporary files from MEMFS.
    *   Resets store state: `set({ isExporting: false, exportProgress: 0 })`.

## Helper Functions Required

-   **`sliceAndConvertToWav(audioBuffer, startTime, endTime, sampleRate)`:** A function to extract a portion of an `AudioBuffer` and encode it into a valid WAV format `ArrayBuffer`.
-   **`triggerDownload(blob, fileName)`:** A function to create a temporary download link for a `Blob` and simulate a click to start the download.