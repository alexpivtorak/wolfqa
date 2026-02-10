'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Run, Step, getRun, getStreamUrl } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Terminal, Camera, Zap, Video } from 'lucide-react';
import { VideoPlayer } from '@/components/video-player';
import { Timeline } from '@/components/timeline';

export default function RunPage() {
    const params = useParams();
    const id = params.id as string;
    const [run, setRun] = useState<Run | null>(null);
    const [steps, setSteps] = useState<Step[]>([]);
    const [logs, setLogs] = useState<{ message: string, timestamp: string, type: 'log' | 'thought' }[]>([]);
    const [status, setStatus] = useState('connecting');
    const [liveFrame, setLiveFrame] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initial Load
    useEffect(() => {
        getRun(id).then(data => {
            setRun(data);
            setSteps(data.steps || []);
        }).catch(err => console.error(err));
    }, [id]);

    // SSE Connection
    useEffect(() => {
        const eventSource = new EventSource(getStreamUrl(id));

        eventSource.onopen = () => {
            setStatus('connected');
            setLogs(prev => [...prev, { message: 'Connected to live stream...', timestamp: new Date().toISOString(), type: 'log' }]);
        };

        eventSource.addEventListener('log', (e: any) => {
            const data = JSON.parse(e.data);
            setLogs(prev => [...prev, data]);
            // Auto-scroll
            if (scrollRef.current) {
                const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
                if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        });

        eventSource.addEventListener('frame', (e: any) => {
            setLiveFrame(e.data); // e.data IS the base64 string
        });

        eventSource.addEventListener('step', (e: any) => {
            const data = JSON.parse(e.data);
            // Add new step
            const newStep: Step = {
                id: Date.now(), // temp id
                runId: parseInt(id),
                stepNumber: steps.length + 1,
                actionType: data.action.type,
                thought: data.action.reason,
                selector: data.action.selector,
                screenshotUrl: '', // TODO: Handle screenshot updates
                timestamp: new Date().toISOString(),
                // ... other fields
            } as any;

            setSteps(prev => [...prev, newStep]);
        });

        eventSource.addEventListener('status', (e: any) => {
            const data = JSON.parse(e.data);
            if (data.status) {
                setRun(prev => prev ? { ...prev, status: data.status, result: data.result } : null);
                setLogs(prev => [...prev, {
                    message: `Mission status changed to: ${data.status.toUpperCase()}${data.result ? ` (${data.result.toUpperCase()})` : ''}`,
                    timestamp: data.timestamp || new Date().toISOString(),
                    type: 'log'
                }]);

                // If finished, refresh to get video etc.
                if (data.status === 'completed' || data.status === 'failed') {
                    getRun(id).then(setRun).catch(() => { });
                }
            }
        });

        // Refresh run details when status changes (e.g. completion)
        const interval = setInterval(() => {
            getRun(id).then(r => {
                if (r.status === 'completed' || r.status === 'failed') {
                    setRun(r);
                }
            }).catch(() => { });
        }, 5000);

        eventSource.onerror = (e) => {
            console.error('SSE Error:', e);
            setStatus('disconnected');
            eventSource.close();
        };

        return () => {
            eventSource.close();
            clearInterval(interval);
        };
    }, [id]); // Removed steps dependency to avoid re-connecting

    if (!run) return <div className="p-10">Loading Mission {id}...</div>;

    const SERVER_URL = 'http://localhost:3001'; // Should be env var

    return (
        <div className="flex flex-col p-6 h-[calc(100vh-64px)] overflow-hidden">
            <header className="flex items-center justify-between mb-6 border-b pb-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        Mission #{run.id}: {run.goal}
                    </h1>
                    <div className="flex items-center gap-2 text-muted-foreground mt-1">
                        <Badge variant={status === 'connected' ? 'default' : 'secondary'} className="animate-pulse">
                            {status === 'connected' ? '● LIVE' : '○ DISCONNECTED'}
                        </Badge>
                        <Badge variant="outline">{run.status}</Badge>
                        <span className="text-sm">{run.url}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-150px)]">
                {/* Left: Video / Timeline */}
                <Card className="lg:col-span-2 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2">
                            <Video className="w-5 h-5 text-purple-500" />
                            {run.status === 'running' ? 'Live Feed' : 'Mission Replay'}
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
                        {/* Video Player Area */}
                        <div className="flex-1 bg-black rounded-lg flex items-center justify-center overflow-hidden border shadow-inner relative">
                            {run.status === 'running' && liveFrame ? (
                                <img
                                    src={`data:image/jpeg;base64,${liveFrame}`}
                                    className="w-full h-full object-contain"
                                    alt="Live Stream"
                                />
                            ) : run.videoUrl ? (
                                <div className="w-full h-full flex items-center justify-center">
                                    <VideoPlayer src={`${SERVER_URL}${run.videoUrl}`} />
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground">
                                    {run.status === 'running' ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                                            <p>Agent is working...</p>
                                        </div>
                                    ) : (
                                        <p>No recording available for this run.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Timeline */}
                        <div className="h-[140px] shrink-0">
                            <Timeline steps={steps} />
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Thought Console & Logs */}
                <Card className="flex flex-col h-full bg-black text-green-400 font-mono text-sm border-zinc-800 shadow-2xl">
                    <CardHeader className="border-b border-zinc-800 bg-zinc-900/50 py-3">
                        <CardTitle className="text-green-500 flex items-center gap-2 text-base">
                            <Terminal className="w-4 h-4" /> THOUGHT CONSOLE
                        </CardTitle>
                    </CardHeader>
                    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                        <div className="space-y-2">
                            {logs.map((log, i) => (
                                <div key={i} className="break-words border-l-2 border-zinc-800 pl-2 hover:bg-zinc-900/30">
                                    <span className="text-zinc-500 text-xs">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                                    <span className={log.type === 'thought' ? 'text-blue-400' : 'text-green-300'}>
                                        {log.type === 'thought' ? '🤔 ' : '> '}
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                            {status === 'connected' && (
                                <div className="animate-pulse">_</div>
                            )}
                        </div>
                    </ScrollArea>
                </Card>
            </div>
        </div>
    );
}
