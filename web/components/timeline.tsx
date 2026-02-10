"use client";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, MousePointer, Type, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Step {
    id: number;
    stepNumber: number;
    actionType: string;
    thought?: string;
    selector?: string;
    timestamp?: string;
}

interface TimelineProps {
    steps: Step[];
    currentStepIndex?: number;
    onStepClick?: (index: number) => void;
}

export function Timeline({ steps, currentStepIndex, onStepClick }: TimelineProps) {
    if (!steps || steps.length === 0) return null;

    return (
        <div className="w-full border rounded-lg bg-slate-50 dark:bg-slate-900/50 p-4">
            <h3 className="text-sm font-semibold mb-3">Timeline</h3>
            <ScrollArea className="w-full whitespace-nowrap rounded-md border bg-background">
                <div className="flex w-max space-x-4 p-4">
                    {steps.map((step, index) => (
                        <button
                            key={step.id}
                            onClick={() => onStepClick?.(index)}
                            className={cn(
                                "flex flex-col items-start gap-2 rounded-lg border p-3 w-[180px] text-left transition-all hover:bg-muted",
                                index === currentStepIndex && "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-sm ring-1 ring-blue-500"
                            )}
                        >
                            <div className="flex items-center gap-2 w-full">
                                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">
                                    {step.stepNumber}
                                </Badge>
                                <span className="text-xs font-mono text-muted-foreground truncate flex-1">
                                    {new Date(step.timestamp || 0).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            </div>

                            <div className="font-semibold text-sm flex items-center gap-1.5 overflow-hidden w-full">
                                {getActionIcon(step.actionType)}
                                <span className="capitalize truncate">{step.actionType}</span>
                            </div>

                            <p className="text-xs text-muted-foreground line-clamp-2 w-full whitespace-normal h-[32px]">
                                {step.thought || "No details"}
                            </p>
                        </button>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}

function getActionIcon(type: string) {
    switch (type) {
        case 'click': return <MousePointer className="h-3 w-3 text-blue-500" />;
        case 'type': return <Type className="h-3 w-3 text-green-500" />;
        case 'wait': return <Eye className="h-3 w-3 text-orange-500" />;
        case 'fail': return <XCircle className="h-3 w-3 text-red-500" />;
        case 'done': return <CheckCircle2 className="h-3 w-3 text-green-600" />;
        default: return <CheckCircle2 className="h-3 w-3 text-gray-500" />;
    }
}
