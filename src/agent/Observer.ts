import { Action } from './types.js';

interface StateSnapshot {
    url: string;
    actionCount: number;
    lastAction?: Action;
    timestamp: number;
}

export class Observer {
    private snapshots: StateSnapshot[] = [];
    private maxSnapshots = 10; // Keep last 10 states

    recordState(url: string, action?: Action) {
        this.snapshots.push({
            url,
            actionCount: this.snapshots.length,
            lastAction: action,
            timestamp: Date.now()
        });

        // Keep only recent snapshots
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }
    }

    /**
     * Validates if progress is being made
     * Returns null if OK, or an intervention message if stuck
     */
    validateProgress(): string | null {
        if (this.snapshots.length < 3) return null;

        const current = this.snapshots[this.snapshots.length - 1];
        const previous = this.snapshots[this.snapshots.length - 2];
        const twoBefore = this.snapshots[this.snapshots.length - 3];

        // Check if we're filling a form (multiple 'type' actions on same page)
        const recentTypes = this.snapshots.slice(-5).filter(
            s => s.lastAction?.type === 'type'
        ).length;

        const isFillingForm = recentTypes >= 3 && current.url === previous.url;

        // Check 1: URL hasn't changed in 5+ actions (but allow form filling)
        if (current.url === previous.url &&
            previous.url === twoBefore.url &&
            this.snapshots.length >= 7 &&
            !isFillingForm) {
            return "STUCK: URL hasn't changed in 7 actions. Possible infinite loop.";
        }

        // Check 2: Too many clicks without navigation (but allow form filling)
        const recentClicks = this.snapshots.slice(-10).filter(
            s => s.lastAction?.type === 'click'
        ).length;

        // Allow up to 8 clicks in a row (for quantity pickers, carousels)
        if (recentClicks >= 8 && current.url === previous.url && !isFillingForm) {
            return "LOOP: Multiple clicks without navigation. Consider typing or waiting.";
        }

        // Check 3: Repeating the same action (exact same type) multiple times
        // Allow up to 5 repetitions for clicks (e.g. quantity adjusters, carousels)
        if (current.lastAction?.type === previous.lastAction?.type &&
            current.lastAction?.type === twoBefore.lastAction?.type &&
            current.url === previous.url &&
            current.lastAction?.type !== 'type') {

            // Calculate how many times in a row this action type happened
            let repeatCount = 0;
            for (let i = this.snapshots.length - 1; i >= 0; i--) {
                if (this.snapshots[i].lastAction?.type === current.lastAction?.type) {
                    repeatCount++;
                } else {
                    break;
                }
            }

            // If it's a click loop > 5 times, intervene
            if (current.lastAction?.type === 'click' && repeatCount >= 6) {
                return `REPETITION: Click action repeated ${repeatCount} times without navigation.`;
            }

            // For other actions (like scroll), keep tight limit
            if (current.lastAction?.type !== 'click' && repeatCount >= 3) {
                return `REPETITION: Action (${current.lastAction?.type}) repeated 3+ times.`;
            }
        }

        return null;
    }

    /**
     * Validates if a step goal was achieved
     * For login: URL should change from /login to something else
     */
    validateStepCompletion(stepName: string, expectedUrlChange?: string): string | null {
        if (this.snapshots.length < 2) return null;

        const current = this.snapshots[this.snapshots.length - 1];
        const beforeStep = this.snapshots[0]; // URL when step started

        // Generic validation: URL should change for navigation-heavy steps
        if (stepName.toLowerCase().includes('login') ||
            stepName.toLowerCase().includes('checkout') ||
            stepName.toLowerCase().includes('navigate')) {

            if (current.url === beforeStep.url) {
                return `STEP_FAILED: "${stepName}" did not result in navigation. Still on ${current.url}`;
            }
        }

        return null;
    }

    /**
     * Resets observer state (call at the start of each new step)
     */
    resetForNewStep() {
        this.snapshots = [];
    }

    getCurrentUrl(): string | null {
        if (this.snapshots.length === 0) return null;
        return this.snapshots[this.snapshots.length - 1].url;
    }

    getInitialUrl(): string | null {
        if (this.snapshots.length === 0) return null;
        return this.snapshots[0].url;
    }
}
