import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';

// Simple store for clients associated with job IDs
// In a real app, consider scalability: maybe Redis pub/sub or dedicated message queue
const jobClients = new Map<string, Set<WebSocket>>();

let wss: WebSocketServer | null = null;

export function initializeWebSocketServer(server: http.Server) {
    if (wss) {
        console.warn('WebSocketServer already initialized.');
        return;
    }

    wss = new WebSocketServer({ server });

    console.log('WebSocketServer initialized');

    wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
        console.log(`WebSocket client connected: ${req.socket.remoteAddress}`);

        // Example: Client sends job ID upon connection
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'register' && data.jobId) {
                    const jobId = data.jobId as string;
                    console.log(`WebSocket client registering for jobId: ${jobId}`);
                    if (!jobClients.has(jobId)) {
                        jobClients.set(jobId, new Set());
                    }
                    jobClients.get(jobId)?.add(ws);

                    // Send confirmation back (optional)
                    ws.send(JSON.stringify({ type: 'registered', jobId }));

                    // Associate jobId with ws for cleanup on close
                    (ws as any).jobId = jobId;
                } else {
                    console.log('Received unknown message format:', data);
                }
            } catch (e) {
                console.error('Failed to parse WebSocket message or invalid format:', e);
            }
        });

        ws.on('close', () => {
            console.log(`WebSocket client disconnected: ${req.socket.remoteAddress}`);
            const jobId = (ws as any).jobId;
            if (jobId && jobClients.has(jobId)) {
                jobClients.get(jobId)?.delete(ws);
                // Clean up map entry if no clients left for this job
                if (jobClients.get(jobId)?.size === 0) {
                    jobClients.delete(jobId);
                    console.log(`Removed client set for job ID: ${jobId}`);
                }
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            // Attempt cleanup similar to 'close'
            const jobId = (ws as any).jobId;
             if (jobId && jobClients.has(jobId)) {
                jobClients.get(jobId)?.delete(ws);
                if (jobClients.get(jobId)?.size === 0) {
                    jobClients.delete(jobId);
                }
            }
        });
    });

    wss.on('error', (error) => {
        console.error('WebSocket Server Error:', error);
        wss = null; // Reset on server error
    });
}

// Function to send updates to clients for a specific job ID
export function sendUpdate(jobId: string, message: object) {
    if (!wss) {
        console.error('WebSocket server not initialized. Cannot send update.');
        return;
    }

    const clients = jobClients.get(jobId);
    if (clients && clients.size > 0) {
        const messageString = JSON.stringify({ ...message, jobId }); // Ensure jobId is in the message
        console.log(`Sending WebSocket update for job ${jobId} to ${clients.size} client(s):`, messageString);
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageString);
            } else {
                console.warn(`Client for job ${jobId} not open, removing.`);
                clients.delete(client); // Clean up disconnected client
                 if (clients.size === 0) {
                    jobClients.delete(jobId);
                }
            }
        });
    } else {
        // console.log(`No active WebSocket clients found for job ID: ${jobId}`);
    }
}

// Helper to check if WSS is running (needed for custom server setup)
export function isWebSocketServerRunning(): boolean {
    return !!wss;
}

// NOTE: This setup requires integration with a Node.js HTTP server.
// In Next.js development, this usually means modifying the dev server or using a custom server.
// For production deployments (Vercel, etc.), standard HTTP API routes might be simpler unless using a custom server setup. 