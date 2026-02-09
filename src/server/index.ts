
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { db } from '../db/index.js';
import { testRuns, testSteps } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';
import { EventEmitter } from 'events';
import Redis from 'ioredis';

const app = new Hono();

// Global Event Emitter for broadcasting to SSE clients
export const eventBus = new EventEmitter();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.subscribe('wolfqa-events', (err, count) => {
    if (err) console.error('Failed to subscribe: %s', err.message);
    else console.log(`Subscribed to ${count} channels. Listening for updates...`);
});

redis.on('message', (channel, message) => {
    if (channel === 'wolfqa-events') {
        try {
            const data = JSON.parse(message);
            // Re-emit internally so SSE handlers can pick it up
            if (data.type === 'step') eventBus.emit('step', data);
            else eventBus.emit('log', data);
        } catch (e) {
            console.error('Failed to parse Redis message:', e);
        }
    }
});

app.use('/*', cors());

app.get('/', (c) => {
    return c.text('WolfQA API is running! 🐺');
});

// List recent runs
app.get('/api/runs', async (c) => {
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 10;
    const runs = await db.select().from(testRuns).orderBy(desc(testRuns.createdAt)).limit(limit);
    return c.json(runs);
});

// Get run details
app.get('/api/runs/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    const run = await db.select().from(testRuns).where(eq(testRuns.id, id)).execute();

    if (run.length === 0) return c.json({ error: 'Run not found' }, 404);

    const steps = await db.select().from(testSteps).where(eq(testSteps.runId, id)).orderBy(testSteps.stepNumber).execute();

    return c.json({ ...run[0], steps });
});

// SSE Endpoint for Live Streaming
app.get('/api/stream/:id', async (c) => {
    const id = c.req.param('id');
    console.log(`🔌 Client connected to stream for run ${id}`);

    return streamSSE(c, async (stream) => {
        // Send initial connection message
        await stream.writeSSE({
            data: JSON.stringify({ type: 'connected', message: `Listening for events on run ${id}` }),
            event: 'status',
        });

        // Listener function
        const onLog = async (data: any) => {
            if (data.runId === parseInt(id)) {
                await stream.writeSSE({
                    data: JSON.stringify(data),
                    event: 'log',
                });
            }
        };

        const onStep = async (data: any) => {
            if (data.runId === parseInt(id)) {
                await stream.writeSSE({
                    data: JSON.stringify(data),
                    event: 'step',
                });
            }
        };

        // Attach listeners
        eventBus.on('log', onLog);
        eventBus.on('step', onStep);

        // Keep connection open until client disconnects
        // Hono's streamSSE handles checks for abortion, but we need to clean up listeners
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (c.req.raw.signal.aborted) {
                console.log(`🔌 Client disconnected from stream ${id}`);
                eventBus.off('log', onLog);
                eventBus.off('step', onStep);
                break;
            }
        }
    });
});

const port = 3001;
console.log(`🚀 Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port
});
