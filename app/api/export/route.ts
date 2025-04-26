import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path'; // Needed for constructing output path
import os from 'os'; // Needed for temporary directory

// Core Server-Side Libs
import NodeTimeManager from '@/src/lib/server/NodeTimeManager';
import VisualizerManager from '@/src/lib/VisualizerManager'; // Assuming VisualizerManager is Node-safe
import ExportRenderer from '@/src/lib/server/ExportRenderer';
// Import WebSocket utility
import { sendUpdate } from '@/src/lib/server/websocketServer';

// Placeholder Types (Refine based on actual Track/Project data structure)
type TrackData = any;
interface ExportRequestBody {
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    bpm: number;
    tracks: TrackData[];
    bloomParams?: { strength: number; threshold: number; radius: number };
    // Add other necessary parameters from the frontend
}

// Simple in-memory store for job status (Replace with a persistent solution if needed)
const exportJobs: Map<string, { status: string; percent: number; message: string; error?: string; url?: string }> = new Map();

export async function POST(request: Request) {
    let jobId = '';
    try {
        const body = await request.json() as ExportRequestBody;

        // --- Input Validation (Basic) ---
        if (!body.width || !body.height || !body.fps || !body.durationSeconds || !body.bpm || !body.tracks) {
            return NextResponse.json({ error: 'Missing required export parameters.' }, { status: 400 });
        }

        jobId = uuidv4();
        const outputFilename = `cabin_export_${jobId}.mp4`;
        // Define output path (e.g., temporary directory or a specific exports folder)
        // Ensure this directory exists and is writable by the Node process
        const outputPath = path.join(os.tmpdir(), outputFilename); // Using temp dir for simplicity

        console.log(`[Job ${jobId}] Received export request. Output: ${outputPath}`);

        // --- Set Initial Job Status (also send initial WS message) ---
        const initialStatus = { status: 'starting', percent: 0, message: 'Initializing export...' };
        exportJobs.set(jobId, initialStatus);
        sendUpdate(jobId, { type: 'status', ...initialStatus }); // Send initial status

        // --- Define Progress Callback (now sends WS messages) ---
        const onProgress = (update: { percent: number; message: string }) => {
            console.log(`[Job ${jobId}] Progress: ${update.percent}% - ${update.message}`);
            const currentJob = exportJobs.get(jobId);
            let status = 'rendering';
            if (currentJob) {
                currentJob.percent = update.percent;
                currentJob.message = update.message;
                if (update.percent < 100) {
                    currentJob.status = status;
                } // Status updated on complete/fail later
            } else {
                // Store status if map entry somehow got deleted mid-process
                exportJobs.set(jobId, { status: status, percent: update.percent, message: update.message });
            }
            // Send WebSocket update
            sendUpdate(jobId, { type: 'progress', percent: update.percent, message: update.message });
        };

        // --- Start Export Process Asynchronously ---
        // We don't await this, so the API route returns immediately
        (async () => {
            try {
                console.log(`[Job ${jobId}] Instantiating managers...`);
                // 1. Instantiate Managers
                const timeManager = new NodeTimeManager(body.bpm);
                // TODO: Ensure VisualizerManager is Node-safe and handles track data correctly
                // Cast timeManager to any to satisfy VisualizerManager constructor expecting TimeManager
                const visualizerManager = new VisualizerManager(timeManager as any, body.tracks);

                // 2. Instantiate Renderer
                const exportRenderer = new ExportRenderer(
                    body.width,
                    body.height,
                    timeManager, // Pass NodeTimeManager
                    visualizerManager // Pass VisualizerManager
                );

                console.log(`[Job ${jobId}] Starting ExportRenderer.export()...`);
                // 3. Start Export
                await exportRenderer.export(
                    { // ExportOptions
                        width: body.width,
                        height: body.height,
                        fps: body.fps,
                        durationSeconds: body.durationSeconds,
                        outputFilename: outputPath, // Use the generated path
                        projectData: {
                            bpm: body.bpm,
                            tracks: body.tracks,
                        },
                        bloomParams: body.bloomParams,
                        ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg', // Allow overriding ffmpeg path via env var
                    },
                    onProgress // Pass the progress callback
                );

                console.log(`[Job ${jobId}] Export finished successfully.`);
                // Update job status & Send WebSocket message on success
                const finalUrl = `/api/download/${outputFilename}`; // Example download URL structure
                const successStatus = { status: 'complete', percent: 100, message: 'Export complete', url: finalUrl };
                exportJobs.set(jobId, successStatus);
                sendUpdate(jobId, { type: 'complete', url: finalUrl });
                // TODO: Implement file serving or temporary storage cleanup logic

            } catch (error: any) {
                console.error(`[Job ${jobId}] Export process failed:`, error);
                // Update job status & Send WebSocket message on error
                const errorStatus = {
                    status: 'failed',
                    percent: 100, // Indicate process finished (even if failed)
                    message: 'Export failed',
                    error: error.message || String(error)
                };
                exportJobs.set(jobId, errorStatus);
                sendUpdate(jobId, { type: 'error', message: errorStatus.error });
            }
        })(); // Self-invoking async function

        // --- Return Immediate Response --- 
        // Respond quickly to the client, the export runs in the background
        return NextResponse.json({ jobId: jobId, message: 'Export process started.' }, { status: 202 }); // 202 Accepted

    } catch (error: any) {
        // Handle initial setup errors (before async process starts)
        console.error('Error processing /api/export request:', error);
        const initialErrorMsg = error.message || String(error);
        // Update status if job ID was generated and send WS message
        if (jobId) { // Check if jobId was assigned before error
             const setupErrorStatus = { status: 'failed', percent: 0, message: 'Initialization failed', error: initialErrorMsg };
             exportJobs.set(jobId, setupErrorStatus);
             // Try sending WS error, might fail if connection isn't established yet
             sendUpdate(jobId, { type: 'error', message: initialErrorMsg });
        }
        return NextResponse.json({ error: 'Failed to start export process.', details: initialErrorMsg }, { status: 500 });
    }
}

// Optional: Add a GET handler to check job status (useful for polling if WebSockets aren't used)
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId query parameter.' }, { status: 400 });
    }

    const job = exportJobs.get(jobId);

    if (!job) {
        return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    return NextResponse.json(job);
} 