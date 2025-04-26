# Video Export Feature Implementation Plan

## 1. Goal

Implement a non-real-time video export feature allowing users to render their project visualization to a video file (configurable resolution/FPS, e.g., 720p@60fps) using a server-side process.

## 2. Core Strategy

- **Frontend:** Use `ExportView.tsx` modal to gather export settings (resolution, FPS). Initiate export via API call. Use WebSockets for progress updates. Provide download link on completion.
- **Backend:** Create a Node.js API endpoint to handle export requests.
    - Receive project data (serialized tracks, BPM, duration, settings).
    - Instantiate `NodeTimeManager`, `VisualizerManager`, Synth/Effect instances.
    - Use `ExportRenderer` for offscreen rendering with headless WebGL (e.g., `node-gl`).
    - `ExportRenderer` includes post-processing (Bloom).
    - Pipe rendered frames to `ffmpeg`.
    - Send progress via WebSockets.
    - Provide final video file for download.

## 3. Prerequisites & Dependencies

- **Node.js:** Backend environment.
- **`ffmpeg`:** Installed and accessible on the backend server.
- **Headless WebGL Library:** e.g., `node-gl` (`npm install gl`).
- **WebSocket Library:** e.g., `ws` (`npm install ws @types/ws`).
- **Other Backend NPM Packages:** `three`, `@types/three`, `uuid`, `@types/uuid`.

## 4. Implementation Steps

### Step 4.1: Backend Environment & Dependencies
- Set up Node.js environment.
- Install `ffmpeg`.
- Install required NPM packages: `gl`, `ws`, `@types/ws`, `three`, `@types/three`, `uuid`, `@types/uuid`.

### Step 4.2: Create `NodeTimeManager.ts`
- Create `src/lib/server/NodeTimeManager.ts` (or similar path).
- Copy the necessary methods from `src/lib/TimeManager.ts`: `constructor`, `setBPM`, `getBPM`, `seekTo`, `getCurrentBeat`, `beatToTime`, `timeToBeat`, `getCurrentTime`.
- Ensure this new class has **no** browser-specific dependencies (`performance`, `requestAnimationFrame`, etc.).

### Step 4.3: Implement `ExportRenderer.ts`
- **Initialization:** Finalize constructor using `node-gl` (or chosen alternative) for the `WebGLRenderer` context.
- **Post-Processing:** Ensure correct Three.js Bloom pass (`UnrealBloomPass` or equivalent) is used, mapping parameters accurately from `VisualizerView.tsx`'s `<Bloom>` component. Set up `EffectComposer` correctly (RenderPass, BloomPass, OutputPass).
- **Optimization:** Refine `updateSceneFromVisualObjects` for efficient object/material caching and disposal.
- **Time:** Ensure the main `export` loop uses `NodeTimeManager`'s `seekTo` method.

### Step 4.4: Implement `ffmpeg` Integration
- In `ExportRenderer.ts`, use `child_process.spawn` to run `ffmpeg`.
- Configure arguments correctly (input: rawvideo, rgba, resolution, fps; output: libx264, yuv420p, quality preset).
- Pipe `pixelBuffer` (from `composer.readBuffer`) to `ffmpeg`'s `stdin`.
- Handle `ffmpeg` process events (`stderr`, `close`, `error`).

### Step 4.5: Implement API Endpoint (/api/export)
- Create a Node.js API endpoint (e.g., Next.js API route).
- **Receive Request:** Accept POST with JSON body (tracks, bpm, time range, settings).
- **Instantiate Core Logic:**
    - Create `NodeTimeManager` instance.
    - Deserialize Synth/Effect instances for each track (this might require adapting/reusing constructor map logic from `store.ts` or loading definitions directly).
    - Create `VisualizerManager` instance.
    - Create `ExportRenderer` instance.
- **Start Export:** Call `exportRenderer.export(onProgressCallback)`.
- **Handle Progress/Completion:** Use WebSockets (see Step 4.7) to report status back to the client.
- **Return Job Info:** Initially respond with a job identifier if needed for WebSocket association.

### Step 4.6: Implement Frontend Integration
- **API Call:** Update `handleStartExport` in `PlaybarView.tsx` to `fetch` the `/api/export` endpoint.
- **State Management:** Connect state updates (`isExporting`, progress, status, etc.) to WebSocket messages.
- **Component Imports:** Resolve import errors for `Select` / `Label` in `ExportView.tsx` (Manual step: Ensure components exist or fix path).
- **Download:** Implement download button logic in `ExportView.tsx` based on final WebSocket message (e.g., receiving a file URL).

### Step 4.7: Implement WebSocket Communication
- **Backend:**
    - Set up WebSocket server (e.g., using `ws`).
    - Associate connections with export jobs (using job ID or similar).
    - Use the `onProgress` callback in `ExportRenderer` to send progress messages (`{ type: 'progress', percent: ..., message: ... }`).
    - Send completion (`{ type: 'complete', url: ... }`) or error (`{ type: 'error', message: ... }`) messages.
- **Frontend:**
    - Establish WebSocket connection.
    - Listen for messages and update corresponding state in `PlaybarView.tsx` / `useStore`.

## 5. Key Considerations

- **Node Compatibility:** `TimeManager` is the primary refactoring task. Synthesizers/Effects appear compatible based on review, but thorough testing is still needed.
- **Performance:** Server-side rendering is intensive. Monitor resource usage.
- **Bloom Parameter Mapping:** Requires careful matching between R3F and Three.js implementations.
- **State Serialization/Deserialization:** Re-instantiating Synths/Effects on the backend needs a robust mechanism.
- **Error Handling:** Implement comprehensive error handling in the backend process and report clearly to the frontend.

## 6. Open Decisions

- Specific headless WebGL library (`gl` recommended, but alternatives exist).
- Exact WebSocket implementation details (library choice, message format, job association).
- Strategy for providing the final file (temporary storage + signed URL, direct stream, etc.). 