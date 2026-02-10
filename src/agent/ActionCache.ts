import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Action } from './types.js';

interface CachedStep {
    actions: Action[];
    timestamp: number;
    hitCount: number;
}

interface CacheSchema {
    [key: string]: CachedStep;
}

export class ActionCache {
    private cachePath: string;
    private cache: CacheSchema;

    constructor(cacheDir: string = './cache') {
        this.cachePath = path.join(cacheDir, 'action_cache.json');

        // Ensure cache directory exists
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        // Load existing cache or initialize empty
        if (fs.existsSync(this.cachePath)) {
            try {
                this.cache = JSON.parse(fs.readFileSync(this.cachePath, 'utf-8'));
            } catch (e) {
                console.warn('Failed to parse cache file, starting fresh.', e);
                this.cache = {};
            }
        } else {
            this.cache = {};
        }
    }


    /**
     * Generates a unique key for the step based on URL, step name, and goal.
     * Uses fuzzy matching for URL (ignores query params).
     */
    private generateKey(url: string, stepName: string, goal: string): string {
        // Normalize URL: remove query params to allow cache hits across sessions with different tokens/IDs
        let normalizedUrl = url;
        try {
            const u = new URL(url);
            normalizedUrl = `${u.protocol}//${u.host}${u.pathname}`; // Ignore search and hash
        } catch (e) {
            // value wasn't a valid URL, keep as is
        }

        const data = `${normalizedUrl}|${stepName}|${goal}`;
        return crypto.createHash('md5').update(data).digest('hex');
    }

    /**
     * Retrieves cached actions for a specific step.
     */
    public get(url: string, stepName: string, goal: string): Action[] | null {
        const key = this.generateKey(url, stepName, goal);
        const cached = this.cache[key];

        if (cached) {
            console.log(`[ActionCache] ⚡ HIT for ${stepName} (${key})`);

            // Validate cache age (optional: expire after 24h?)
            // const age = Date.now() - cached.timestamp;
            // if (age > 86400000) return null;

            cached.hitCount++;
            this.save(); // Persist hit count update
            return cached.actions;
        }

        console.log(`[ActionCache] 💨 MISS for ${stepName} (${key})`);
        return null;
    }

    /**
     * Saves a sequence of actions for a step.
     */
    public set(url: string, stepName: string, goal: string, actions: Action[]): void {
        const key = this.generateKey(url, stepName, goal);

        // Filter out actions that rely on specific coordinates unless they have a selector fallback?
        // For now, we trust the brain's output or assume the brain will improve over time.

        this.cache[key] = {
            actions,
            timestamp: Date.now(),
            hitCount: 0
        };

        console.log(`[ActionCache] 💾 SAVED ${actions.length} actions for ${stepName} (${key})`);
        this.save();
    }

    /**
     * Persists the in-memory cache to disk.
     */
    private save(): void {
        try {
            fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
        } catch (e) {
            console.error('[ActionCache] Failed to save cache:', e);
        }
    }

    /**
     * Clears the cache.
     */
    public clear(): void {
        this.cache = {};
        this.save();
    }
}
