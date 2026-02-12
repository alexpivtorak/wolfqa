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

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function RunPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const [run, setRun] = useState<Run | null>(null);
    const [steps, setSteps] = useState<Step[]>([]);
    const [logs, setLogs] = useState<{ message: string, timestamp: string, type: 'log' | 'thought' }[]>([]);
    const [status, setStatus] = useState('connecting');
    const [liveFrame, setLiveFrame] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Re-run state
    const [isRerunOpen, setIsRerunOpen] = useState(false);
    const [rerunModel, setRerunModel] = useState("gemini-2.0-flash");
    const [isRerunLoading, setIsRerunLoading] = useState(false);

    const handleRerun = async () => {
        if (!run) return;
        setIsRerunLoading(true);
        try {
            const response = await fetch("http://localhost:3001/api/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: run.url,
                    goal: run.goal,
                    // Assume standard mode for simplicity or fetch mode if available in Run object
                    mode: "standard",
                    model: rerunModel
                }),
            });

            if (!response.ok) throw new Error("Failed to start re-run");
            const data = await response.json();
            setIsRerunOpen(false);
            router.push(`/run/${data.runId}`);
        } catch (error) {
            console.error(error);
            alert("Failed to re-run mission.");
        } finally {
            setIsRerunLoading(false);
        }
    };

    // Initial Load
    useEffect(() => {
        getRun(id).then(data => {
            setRun(data);
            setSteps(data.steps || []);

            // Load existing logs if available
            if (data.logs) {
                try {
                    const parsed = typeof data.logs === 'string' ? JSON.parse(data.logs) : data.logs;
                    if (Array.isArray(parsed)) {
                        setLogs(parsed.map((m: string) => ({
                            message: m,
                            timestamp: data.createdAt, // approximation
                            type: m.includes('Action:') ? 'thought' : 'log'
                        })));
                    }
                } catch (e) {
                    console.error('Failed to parse logs:', e);
                }
            }
        }).catch(err => console.error(err));
    }, [id]);

    // SSE Connection for live logs, steps, frames, and status
    useEffect(() => {
        const streamUrl = getStreamUrl(id);
        const es = new EventSource(streamUrl);

        es.addEventListener('open', () => {
            setStatus('connected');
        });

        es.addEventListener('log', (e) => {
            try {
                const data = JSON.parse(e.data);
                setLogs(prev => [...prev, {
                    message: data.message,
                    timestamp: data.timestamp || new Date().toISOString(),
                    type: data.message?.includes('Action:') ? 'thought' : 'log'
                }]);
                // Auto-scroll
                setTimeout(() => {
                    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
                }, 50);
            } catch (err) {
                console.error('Failed to parse log event:', err);
            }
        });

        es.addEventListener('step', (e) => {
            try {
                const data = JSON.parse(e.data);
                setSteps(prev => [...prev, data]);
            } catch (err) {
                console.error('Failed to parse step event:', err);
            }
        });

        es.addEventListener('frame', (e) => {
            setLiveFrame(e.data);
        });

        es.addEventListener('status', (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.status) {
                    setRun(prev => prev ? { ...prev, status: data.status, result: data.result ?? prev.result } : prev);
                    setLogs(prev => [...prev, {
                        message: `Mission status changed to: ${data.status}${data.result ? ` (${data.result})` : ''}`,
                        timestamp: data.timestamp || new Date().toISOString(),
                        type: 'log'
                    }]);
                }
            } catch (err) {
                console.error('Failed to parse status event:', err);
            }
        });

        es.addEventListener('error', () => {
            setStatus('disconnected');
        });

        return () => {
            es.close();
            setStatus('disconnected');
        };
    }, [id]);

    if (!run) return <div className="p-10">Loading Mission {id}...</div>;

    const SERVER_URL = 'http://localhost:3001'; // Should be env var

    return (
        <div className="flex flex-col p-6 h-full overflow-hidden">
            <header className="flex items-center justify-between mb-6 border-b pb-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        Mission #{run.id}: {(() => {
                            try {
                                return new URL(run.url).hostname.replace('www.', '');
                            } catch {
                                return run.url;
                            }
                        })()}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm italic max-w-4xl truncate" title={run.goal}>
                        Goal: {run.goal}
                    </p>
                    <div className="flex items-center gap-2 text-muted-foreground mt-1">
                        <Badge variant={status === 'connected' ? 'default' : 'secondary'} className="animate-pulse">
                            {status === 'connected' ? '● LIVE' : '○ DISCONNECTED'}
                        </Badge>
                        <Badge variant="outline">{run.status}</Badge>
                        <span className="text-sm">{run.url}</span>
                        {run.model && <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">🤖 {run.model}</Badge>}
                    </div>
                </div>

                <Dialog open={isRerunOpen} onOpenChange={setIsRerunOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Zap className="w-4 h-4" /> Re-run Mission
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Re-run Mission #{run.id}</DialogTitle>
                            <DialogDescription>
                                Start a new run with the same goal and URL, but you can change the model.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <label htmlFor="model" className="text-sm font-medium">Select Model</label>
                                <Select value={rerunModel} onValueChange={setRerunModel}>
                                    <SelectTrigger id="model">
                                        <SelectValue placeholder="Select Model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gemini-2.0-flash">⚡ Gemini 2.0 Flash (Recommended)</SelectItem>
                                        <SelectItem value="gemini-2.0-pro">🧠 Gemini 2.0 Pro (High Reasoning)</SelectItem>
                                        <SelectItem value="gemini-2.5-flash-lite">🏎️ Gemini 2.5 Flash Lite (Fastest)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleRerun} disabled={isRerunLoading}>
                                {isRerunLoading ? "Starting..." : "🚀 Start Re-run"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            {/* Rest of UI */}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
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
                <Card className="flex flex-col h-full bg-black text-green-400 font-mono text-sm border-zinc-800 shadow-2xl overflow-hidden">
                    <CardHeader className="border-b border-zinc-800 bg-zinc-900/50 py-3 shrink-0">
                        <CardTitle className="text-green-500 flex items-center gap-2 text-base">
                            <Terminal className="w-4 h-4" /> THOUGHT CONSOLE
                        </CardTitle>
                    </CardHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto p-4" ref={scrollRef}>
                        <div className="space-y-1.5">
                            {logs.map((log, i) => {
                                const rawMsg = log.message || '';
                                // Strip existing emojis from the message to avoid duplicates
                                const cleanMsg = rawMsg.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}⚡⚠️✅❌]/gu, '').trim();
                                // Classify log type by content
                                let emoji = '>';
                                let textColor = 'text-green-300';
                                let borderColor = 'border-zinc-700';

                                if (rawMsg.includes('Action:') || rawMsg.includes('👉')) {
                                    emoji = '⚡'; textColor = 'text-yellow-400'; borderColor = 'border-yellow-600';
                                } else if (rawMsg.includes('Capturing') || rawMsg.includes('📸')) {
                                    emoji = '📸'; textColor = 'text-cyan-400'; borderColor = 'border-cyan-700';
                                } else if (rawMsg.includes('Thinking') || rawMsg.includes('🧠')) {
                                    emoji = '🧠'; textColor = 'text-purple-400'; borderColor = 'border-purple-700';
                                } else if (rawMsg.includes('Analyzing') || rawMsg.includes('🔍')) {
                                    emoji = '🔍'; textColor = 'text-blue-400'; borderColor = 'border-blue-700';
                                } else if (rawMsg.includes('Observer') || rawMsg.includes('⚠️')) {
                                    emoji = '⚠️'; textColor = 'text-red-400'; borderColor = 'border-red-600';
                                } else if (rawMsg.includes('Step') || rawMsg.includes('📍')) {
                                    emoji = '📍'; textColor = 'text-orange-400'; borderColor = 'border-orange-600';
                                } else if (rawMsg.includes('FAST FORWARD') || rawMsg.includes('⚡')) {
                                    emoji = '⚡'; textColor = 'text-amber-300'; borderColor = 'border-amber-600';
                                } else if (rawMsg.includes('status changed') || rawMsg.includes('Mission')) {
                                    emoji = '🚀'; textColor = 'text-emerald-400'; borderColor = 'border-emerald-600';
                                } else if (rawMsg.includes('Connected') || rawMsg.includes('stream')) {
                                    emoji = '🔗'; textColor = 'text-sky-400'; borderColor = 'border-sky-700';
                                } else if (rawMsg.includes('✅') || rawMsg.includes('Completed') || rawMsg.includes('PASS')) {
                                    emoji = '✅'; textColor = 'text-green-400'; borderColor = 'border-green-600';
                                } else if (rawMsg.includes('❌') || rawMsg.includes('FAIL') || rawMsg.includes('Error')) {
                                    emoji = '❌'; textColor = 'text-red-400'; borderColor = 'border-red-600';
                                }

                                return (
                                    <div key={i} className={`break-words border-l-2 ${borderColor} pl-2 py-0.5 hover:bg-zinc-900/50 transition-colors`}>
                                        <span className="text-zinc-600 text-xs">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                                        <span className={textColor}>
                                            {emoji} {cleanMsg}
                                        </span>
                                    </div>
                                );
                            })}
                            {status === 'connected' && (
                                <div className="animate-pulse">_</div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
