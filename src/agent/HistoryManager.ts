import { Action } from './types.js';

interface HistoryEntry {
    step: number;
    action: Action;
    outcome: string;
    timestamp: number;
}

export class HistoryManager {
    private entries: HistoryEntry[] = [];
    private maxVisibleEntries = 5;

    record(action: Action, outcome: string, step: number) {
        this.entries.push({
            step,
            action,
            outcome,
            timestamp: Date.now()
        });
    }

    log(message: string) {
        // Just store as a raw string for prompt context
        // We can treat it as a dummy entry or separate list
        this.rawLogs.push(message);
    }

    private rawLogs: string[] = [];

    /**
     * Returns a formatted string for the LLM prompt.
     * Keeps the last N entries in full detail, and summarizes the rest.
     */
    getPromptHistory(): string {
        let output = this.rawLogs.join('\n') + '\n\n';

        if (this.entries.length === 0) return output + "No actions taken yet.";

        const totalEntries = this.entries.length;
        const visibleStartIndex = Math.max(0, totalEntries - this.maxVisibleEntries);

        // Summarize older entries
        if (visibleStartIndex > 0) {
            const summaryCount = visibleStartIndex;
            const firstStep = this.entries[0].step;
            const lastStep = this.entries[visibleStartIndex - 1].step;
            output += `[Steps ${firstStep}-${lastStep}]: ${summaryCount} previous actions completed (summarized to save space).\n...\n`;
        }

        // Detailed recent entries
        for (let i = visibleStartIndex; i < totalEntries; i++) {
            const entry = this.entries[i];
            const details = this.formatActionDetails(entry.action);
            const statusIcon = entry.outcome.includes('No changes') ? '⚠️' : '✅';

            output += `[${i + 1}] ${statusIcon} ${entry.action.type}${details} → ${entry.outcome}\n`;
        }

        return output;
    }

    /**
     * Returns the full history for logging/debugging
     */
    getFullLog(): string[] {
        return [...this.rawLogs, ...this.entries.map((entry, i) => {
            const details = this.formatActionDetails(entry.action);
            return `[${i + 1}] ${entry.action.type}${details} Outcome: ${entry.outcome}`;
        })];
    }

    private formatActionDetails(action: Action): string {
        let details = '';
        if (action.selector) details += ` Sel="${action.selector}"`;
        if (action.coordinate) details += ` Coord=(${action.coordinate.x},${action.coordinate.y})`;
        if (action.text) details += ` Text="${action.text}"`;
        if (action.key) details += ` Key="${action.key}"`;
        return details;
    }
}
