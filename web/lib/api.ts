
export interface Run {
    id: number;
    url: string;
    goal: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    result: 'pass' | 'fail' | null;
    videoUrl?: string; // e.g. /videos/run-123.webm
    createdAt: string;
    logs?: string;
    model?: string; // e.g. gemini-2.0-flash
}

export interface Step {
    id: number;
    runId: number;
    stepNumber: number;
    actionType: string;
    thought: string;
    selector: string;
    screenshotUrl: string;
    timestamp: string;
}

const API_BASE = 'http://localhost:3001/api';

export async function getRuns(limit = 10): Promise<Run[]> {
    const res = await fetch(`${API_BASE}/runs?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch runs');
    return res.json();
}

export async function getRun(id: string): Promise<Run & { steps: Step[] }> {
    const res = await fetch(`${API_BASE}/runs/${id}`);
    if (!res.ok) throw new Error('Failed to fetch run');
    return res.json();
}

export function getStreamUrl(runId: string) {
    return `${API_BASE}/stream/${runId}`;
}
