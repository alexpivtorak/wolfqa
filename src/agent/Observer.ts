import { Action } from './types.js';

interface StateSnapshot {
    url: string;
    actionCount: number;
    lastAction?: Action;
    timestamp: number;
}

export class Observer {
    private snapshots: StateSnapshot[] = [];
    private maxSnapshots = 25; // Keep last 25 states

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
        // Filter out 'wait' actions for progress validation
        // 'wait' is often used during rate-limiting/429s and shouldn't count as a "stuck" action
        const progressActions = this.snapshots.filter(s => s.lastAction?.type !== 'wait');

        if (progressActions.length < 3) return null;

        const current = progressActions[progressActions.length - 1];
        const previous = progressActions[progressActions.length - 2];
        const twoBefore = progressActions[progressActions.length - 3];

        // Check if we're filling a form (multiple 'type' actions on same page)
        const recentTypes = progressActions.slice(-5).filter(
            s => s.lastAction?.type === 'type'
        ).length;

        const isFillingForm = recentTypes >= 3 && current.url === previous.url;

        // Check 1: URL hasn't changed in 15+ ACTIVE actions (but allow form filling)
        if (current.url === previous.url &&
            previous.url === twoBefore.url &&
            progressActions.length >= 15 &&
            !isFillingForm) {
            return "STUCK: URL hasn't changed in 15 actions. Possible infinite loop.";
        }

        // Check 2: Too many clicks without navigation (but allow form filling)
        const recentClicks = progressActions.slice(-15).filter(
            s => s.lastAction?.type === 'click'
        ).length;

        // Allow up to 12 clicks in a row (for quantity pickers, carousels)
        if (recentClicks >= 12 && current.url === previous.url && !isFillingForm) {
            return "LOOP: Multiple clicks without navigation. Consider typing or waiting.";
        }

        const currentAction = current.lastAction;
        if (!currentAction) return null;

        // Check 3: Repeating the same action (exact same type) multiple times
        // Allow up to 5 repetitions for clicks (e.g. quantity adjusters, carousels)
        if (currentAction.type === previous.lastAction?.type &&
            currentAction.type === twoBefore.lastAction?.type &&
            current.url === previous.url &&
            currentAction.type !== 'type') {

            // Calculate how many times in a row this action type happened
            let repeatCount = 0;
            const targets = new Set<string>();

            for (let i = progressActions.length - 1; i >= 0; i--) {
                const action = progressActions[i].lastAction;
                if (action && action.type === currentAction.type) {
                    repeatCount++;
                    // Track unique targets (selectors or coordinates)
                    if (action.selector) targets.add(action.selector);
                    if (action.coordinate) targets.add(`${action.coordinate.x},${action.coordinate.y}`);
                } else {
                    break;
                }
            }

            // If it's a click loop, check if we are hitting the SAME target
            if (currentAction.type === 'click') {
                // If we are clicking different things (e.g. checkbox list, tabs), allow more
                // If we are clicking the EXACT same target 3 times, it's a loop
                const isSameTargetLoop = targets.size === 1 && repeatCount >= 3;
                const isGeneralClickLoop = repeatCount >= 15; // Hard limit for any click sequence without navigation

                if (isSameTargetLoop) {
                    return `REPETITION: Clicking the same target ${repeatCount} times without navigation or state change.`;
                }
                if (isGeneralClickLoop) {
                    return `LIMIT: 15+ clicks without navigation. The agent might be lost.`;
                }
            } else if (repeatCount >= 5) {
                // For other actions (like scroll), allow up to 5
                return `REPETITION: Action (${currentAction.type}) repeated 5+ times.`;
            }
        }

        return null;
    }

    /**
     * Returns a soft warning if repetition is starting
     */
    getEarlyWarning(): string | null {
        if (this.snapshots.length < 2) return null;

        const last = this.snapshots[this.snapshots.length - 1];
        const prev = this.snapshots[this.snapshots.length - 2];

        if (last.lastAction?.type === 'click' &&
            prev.lastAction?.type === 'click' &&
            last.url === prev.url) {

            // Check if same selector/coordinate
            const lastTarget = last.lastAction.selector || JSON.stringify(last.lastAction.coordinate);
            const prevTarget = prev.lastAction.selector || JSON.stringify(prev.lastAction.coordinate);

            if (lastTarget === prevTarget) {
                return `⚠️ Warning: You clicked the same target twice and the page didn't change. Try a different approach or verify the element state.`;
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

        // Logic updated per user request: only enforce navigation if the goal explicitly mentions it.
        const goalImpliesNavigation = stepName.toLowerCase().includes("go to") ||
            stepName.toLowerCase().includes("navigate");

        if (goalImpliesNavigation && current.url === beforeStep.url) {
            return `STEP_FAILED: "${stepName}" did not result in navigation. Still on ${current.url}`;
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
