import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// --- Core Logic Imports ---
import NodeTimeManager from '../../lib/server/NodeTimeManager';
import VisualizerManager from '../../lib/VisualizerManager';
import ExportRenderer from '../../lib/server/ExportRenderer';
import { deserializeSynth, deserializeEffect, applySettings } from '../../utils/persistenceUtils'; // Adjusted path
import Synthesizer from '../../lib/Synthesizer'; // Base class
import Effect from '../../lib/Effect'; // Base class

// --- Concrete Synth/Effect Imports (CRUCIAL for deserialization map) ---
// Synthesizers (Add ALL concrete classes from src/lib/synthesizers/*)
import BasicSynthesizer from '../../lib/synthesizers/BasicSynthesizer';
import ApproachingCubeSynth from '../../lib/synthesizers/ApproachingCubeSynth';
import BackgroundLightSynth from '../../lib/synthesizers/BackgroundLightSynth';
import ColorPulseSynth from '../../lib/synthesizers/ColorPulseSynth';
import ConvergingSpheresSynth from '../../lib/synthesizers/ConvergingSpheresSynth';
import GlowSynth from '../../lib/synthesizers/GlowSynth';
import GlowingCubeSynth from '../../lib/synthesizers/glowingCubeSynth';
import PositionPulseSynth from '../../lib/synthesizers/PositionPulseSynth';
import PulseSynth from '../../lib/synthesizers/PulseSynth';
import RadialDuplicateGlowSynth from '../../lib/synthesizers/RadialDuplicateGlowSynth';
import SpiralGalaxySynth from '../../lib/synthesizers/SpiralGalaxySynth';
import SymmetricResonanceSynth from '../../lib/synthesizers/SymmetricResonanceSynth';
import VelocityOffsetDuplicateSynth from '../../lib/synthesizers/VelocityOffsetDuplicateSynth';
import VelocityRotateSynth from '../../lib/synthesizers/VelocityRotateSynth';
// Add any other synths here...


// Effects (Add ALL concrete classes from src/lib/effects/*)
import ScaleEffect from '../../lib/effects/ScaleEffect';
import DelayEffect from '../../lib/effects/DelayEffect';
import RadialDuplicateEffect from '../../lib/effects/RadialDuplicateEffect';
import GravityEffect from '../../lib/effects/GravityEffect';
import PositionOffsetEffect from '../../lib/effects/PositionOffsetEffect';
import RescalePositionEffect from '../../lib/effects/RescalePositionEffect';
import Rotate3DEffect from '../../lib/effects/Rotate3DEffect';
import PanEffect from '../../lib/effects/PanEffect';
import ColorEffect from '../../lib/effects/ColorEffect';
import GlobalRotateEffect from '../../lib/effects/GlobalRotateEffect';
import HorizontalDuplicateEffect from '../../lib/effects/HorizontalDuplicateEffect';
// Add any other effects here...

// --- Type Definitions ---
// Types expected in the POST request body
interface ExportRequestBody {
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    bloomParams?: { strength: number; threshold: number; radius: number };
    projectData: {
        bpm: number;
        // Simplified Track structure for export request
        tracks: Array<{
            id: string;
            name: string;
            isMuted: boolean;
            isSoloed: boolean;
            midiBlocks: any[]; // Define MIDIBlock structure if needed, or pass as is
            synthesizer: { type: string; settings: any } | null; // Data for deserialization
            effects: Array<{ id: string; type: string; settings: any }>; // Data for deserialization
        }>;
    };
}

// Type for storing active export jobs (in-memory for simplicity)
interface ExportJob {
    id: string;
    status: 'queued' | 'rendering' | 'encoding' | 'complete' | 'error';
    progress: number;
    message: string;
    outputFilename?: string;
    errorDetails?: string;
    startTime: number;
}

// In-memory store for active jobs (replace with a database/cache in production)
const activeJobs: Map<string, ExportJob> = new Map();

// --- Server-side Constructor Maps (Populated once) ---
const serverSynthesizerConstructors = new Map<string, new (...args: any[]) => Synthesizer>();
const serverEffectConstructors = new Map<string, new (...args: any[]) => Effect>();

function populateConstructors() {
    if (serverSynthesizerConstructors.size > 0 && serverEffectConstructors.size > 0) return; // Already populated

    console.log('Populating server-side Synth/Effect constructors...');
    
    // Synthesizers
    [
        BasicSynthesizer, ApproachingCubeSynth, BackgroundLightSynth, ColorPulseSynth,
        ConvergingSpheresSynth, GlowSynth, GlowingCubeSynth, PositionPulseSynth,
        PulseSynth, RadialDuplicateGlowSynth, SpiralGalaxySynth, SymmetricResonanceSynth,
        VelocityOffsetDuplicateSynth, VelocityRotateSynth
        // Add other synth classes here
    ].forEach(ctor => {
        if (ctor && ctor.name) {
            serverSynthesizerConstructors.set(ctor.name, ctor);
        } else {
            console.warn('Skipping invalid synthesizer constructor during population.');
        }
    });

    // Effects
    [
        ScaleEffect, DelayEffect, RadialDuplicateEffect, GravityEffect, PositionOffsetEffect,
        RescalePositionEffect, Rotate3DEffect, PanEffect, ColorEffect, GlobalRotateEffect,
        HorizontalDuplicateEffect
        // Add other effect classes here
    ].forEach(ctor => {
         if (ctor && ctor.name) {
             // Pass ID to constructor if needed, handle variations if necessary
             // Assuming Effect constructors take an optional ID like `new Constructor(id?)`
             serverEffectConstructors.set(ctor.name, ctor);
         } else {
              console.warn('Skipping invalid effect constructor during population.');
         }
    });
    
    console.log(`Populated ${serverSynthesizerConstructors.size} synth constructors and ${serverEffectConstructors.size} effect constructors.`);
}

// Ensure constructors are populated when the module loads
populateConstructors();


// --- API Handler ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const jobId = uuidv4();
    const startTime = Date.now();
    const job: ExportJob = {
        id: jobId,
        status: 'queued',
        progress: 0,
        message: 'Export job queued',
        startTime: startTime,
    };
    activeJobs.set(jobId, job);
    console.log(`[Job ${jobId}] Queued`);

    // Immediately respond to the client that the job has started
    res.status(202).json({ jobId: jobId, message: 'Export job started' });

    // --- Start processing the job asynchronously ---
    // Use setImmediate or similar to avoid blocking the response
    setImmediate(async () => {
        let timeManager: NodeTimeManager | null = null;
        let visualizerManager: VisualizerManager | null = null;
        let renderer: ExportRenderer | null = null;
        let outputFilename = '';

        try {
            const {
                width, height, fps, durationSeconds, bloomParams, projectData
            } = req.body as ExportRequestBody;

            // --- Basic Validation ---
            if (!width || !height || !fps || !durationSeconds || !projectData || !projectData.tracks || !projectData.bpm) {
                throw new Error('Missing required export parameters in request body.');
            }

             // Define output path (e.g., in temp directory)
             const safeFilename = `export_${jobId}.mp4`; // Use job ID for uniqueness
             outputFilename = path.join(os.tmpdir(), safeFilename); // Store in OS temp dir
             job.outputFilename = outputFilename; // Store for later retrieval/cleanup

            job.status = 'rendering';
            job.message = 'Initializing renderer...';
            job.progress = 1;
            console.log(`[Job ${jobId}] Initializing: ${width}x${height}@${fps}fps, Duration: ${durationSeconds}s, Output: ${outputFilename}`);
            // **TODO: Send WebSocket Update Here** 
            // e.g., sendWsUpdate(jobId, { status: job.status, progress: job.progress, message: job.message });

            // --- Instantiate Managers ---
            timeManager = new NodeTimeManager(projectData.bpm);

            // Deserialize Tracks, Synths, and Effects
            const liveTracks = projectData.tracks.map(trackData => {
                // **Crucial Deserialization Logic**
                const synthInstance = trackData.synthesizer
                    ? localDeserializeSynth(trackData.synthesizer, serverSynthesizerConstructors) // Pass the map
                    : null; 

                const effectInstances = trackData.effects
                    .map(effectData => localDeserializeEffect(effectData, serverEffectConstructors)) // Pass the map
                    .filter((instance): instance is Effect => instance !== null); // Type guard

                if (trackData.synthesizer && !synthInstance) {
                     console.warn(`[Job ${jobId}] Failed to deserialize synthesizer type ${trackData.synthesizer.type} for track ${trackData.id}`);
                     // Decide how to handle - skip track, use default, or error out?
                }

                // Reconstruct the Track object structure needed by VisualizerManager
                // (Assuming VisualizerManager needs this structure)
                return {
                    id: trackData.id,
                    name: trackData.name,
                    isMuted: trackData.isMuted,
                    isSoloed: trackData.isSoloed,
                    midiBlocks: trackData.midiBlocks, // Pass through MIDI blocks
                    synthesizer: synthInstance, // The live instance
                    effects: effectInstances,   // Array of live instances
                };
            });
            
            visualizerManager = new VisualizerManager(timeManager, liveTracks as any); // Cast needed if structure differs slightly
            visualizerManager.resetState(); // Ensure clean state before export

            // --- Instantiate Renderer ---
            renderer = new ExportRenderer(
                { width, height, fps, outputFilename, bloomParams },
                timeManager,
                visualizerManager
            );

            // --- Define Progress Callback ---
            const onProgress: (update: { percent: number; message: string }) => void = (update) => {
                job.progress = update.percent;
                job.message = update.message;
                if (update.percent < 99) {
                    job.status = 'rendering';
                } else if (update.percent < 100) {
                    job.status = 'encoding';
                }
                console.log(`[Job ${jobId}] Progress: ${update.percent}% - ${update.message}`);
                 // **TODO: Send WebSocket Update Here** 
                 // e.g., sendWsUpdate(jobId, { status: job.status, progress: job.progress, message: job.message });
            };

            // --- Start Export ---
            await renderer.export(durationSeconds, onProgress);

            // --- Mark Complete ---
            job.status = 'complete';
            job.progress = 100;
            job.message = `Export complete: ${safeFilename}`; // Use relative name for message
            console.log(`[Job ${jobId}] Complete. Output: ${outputFilename}`);
             // **TODO: Send WebSocket Update Here** 
             // e.g., sendWsUpdate(jobId, { status: job.status, progress: job.progress, message: job.message, url: `/api/download/${jobId}` }); // Send download URL

        } catch (error: any) {
            console.error(`[Job ${jobId}] Error during export:`, error);
            job.status = 'error';
            job.progress = 0; // Or keep last known progress?
            job.message = 'Export failed.';
            job.errorDetails = error.message || 'Unknown error';
             // **TODO: Send WebSocket Update Here** 
             // e.g., sendWsUpdate(jobId, { status: job.status, message: job.message, error: job.errorDetails });
        } finally {
             console.log(`[Job ${jobId}] Processing finished. Status: ${job.status}. Duration: ${(Date.now() - startTime) / 1000}s`);
             // --- Cleanup ---
             if (renderer) {
                 renderer.dispose(); // Ensure renderer resources are cleaned up
             }
             // Optional: Remove job from map after some time or add cleanup logic
             // setTimeout(() => activeJobs.delete(jobId), 60 * 60 * 1000); // e.g., remove after 1 hour
        }
    }); // End of setImmediate
}

// --- Helper Functions (to be implemented for actual WebSocket server) ---
/*
function sendWsUpdate(jobId: string, data: any) {
    // Find WebSocket connections associated with jobId
    // Send data to those connections
    console.log(`WS Update for ${jobId}:`, data); // Placeholder
}
*/

// --- Deserialization functions adapted for server-side ---
// (Need the constructor maps passed in)

function deserializeSynth(data: { type: string; settings: any }, constructors: Map<string, new (...args: any[]) => Synthesizer>): Synthesizer | null {
    const Constructor = constructors.get(data.type);
    if (!Constructor) {
        console.error(`No synthesizer constructor found for type: ${data.type}`);
        return null;
    }
    try {
        const instance = new Constructor(); // Assuming constructor doesn't need trackId
        applySettings(instance, data.settings);
        return instance;
    } catch (error) {
        console.error(`Error deserializing synthesizer type ${data.type}:`, error);
        return null;
    }
}

function deserializeEffect(data: { id: string; type: string; settings: any }, constructors: Map<string, new (...args: any[]) => Effect>): Effect | null {
     const Constructor = constructors.get(data.type);
     if (!Constructor) {
         console.error(`No effect constructor found for type: ${data.type}`);
         return null;
     }
     try {
         // Pass the ID from the persisted data to the constructor
         const instance = new Constructor(data.id); 
         applySettings(instance, data.settings);
         return instance;
     } catch (error) {
         console.error(`Error deserializing effect type ${data.type}:`, error);
         return null;
     }
} 