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
     */
    private generateKey(url: string, stepName: string, goal: string): string {
        // Normalize URL to remove query params if they are dynamic (optional, keeping it simple for now)
        // For now, we use a hash of the combined inputs to ensure uniqueness and manageable keys
        const data = `${url}|${stepName}|${goal}`;
        return crypto.createHash('md5').update(data).digest('hex');
    }

    /**
     * Retrieves cached actions for a specific step.
     */
    public get(url: string, stepName: string, goal: string): Action[] | null {
        const key = this.generateKey(url, stepName, goal);
        const cached = this.cache[key];

        if (cached) {
            console.log(`[ActionCache] Hit for ${stepName} (${key})`);
            cached.hitCount++;
            this.save(); // Persist hit count update
            return cached.actions;
        }

        return null;
    }

    /**
     * Saves a sequence of actions for a step.
     */
    public set(url: string, stepName: string, goal: string, actions: Action[]): void {
        const key = this.generateKey(url, stepName, goal);

        // Filter out non-reproducible actions if necessary (e.g., waiting for specific timestamps)
        // For now, store all actions.

        this.cache[key] = {
            actions,
            timestamp: Date.now(),
            hitCount: 0
        };

        console.log(`[ActionCache] Saved ${actions.length} actions for ${stepName} (${key})`);
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
