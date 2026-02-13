"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChaosControlPanel, ChaosProfile } from "@/components/chaos-control";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

export default function NewMission() {
    const router = useRouter();
    const [url, setUrl] = useState("https://saucedemo.com");
    // Default model to Gemini 2.0 Flash
    const [model, setModel] = useState("gemini-2.0-flash");
    const [goal, setGoal] = useState(`GOAL: Complete the Checkout Flow.
CRITICAL RULE: DO NOT EMIT 'DONE' UNTIL YOU SEE THE TEXT "THANK YOU FOR YOUR ORDER".
IF YOU EMIT 'DONE' BEFORE THAT, YOU FAIL.

PHASE 1: INVENTORY & CART
1. Login with "standard_user" / "secret_sauce".
2. Add "Sauce Labs Backpack".
3. Add "Sauce Labs Bike Light".
4. Click Shopping Cart Icon.
5. Click "Checkout".

PHASE 2: DATA ENTRY (MANDATORY)
6. INSPECT "First Name" field. IF EMPTY -> TYPE "Wolf".
7. INSPECT "Last Name" field. IF EMPTY -> TYPE "QA".
8. INSPECT "Zip" field. IF EMPTY -> TYPE "90210".
(Do not assume these are filled. Look at the pixels.)

PHASE 3: FINISH
9. Click "Continue".
10. Click "Finish".
11. VERIFY "Thank you for your order" is visible.
12. ONLY NOW -> Emit "Done".`);
    const [isChaos, setIsChaos] = useState(false);
    const [chaosProfile, setChaosProfile] = useState<ChaosProfile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [headless, setHeadless] = useState(true);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch("http://localhost:3001/api/jobs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url,
                    goal,
                    mode: isChaos ? "chaos" : "standard",
                    chaosProfile: isChaos ? chaosProfile : undefined,
                    model,
                    headless,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to start mission");
            }

            const data = await response.json();
            router.push(`/run/${data.runId}`);
        } catch (error) {
            console.error(error);
            alert("Failed to start mission. Check server logs.");
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center p-8 md:p-24">
            <Card className="w-full max-w-3xl">
                <CardHeader>
                    <CardTitle>Launch New Mission</CardTitle>
                    <CardDescription>
                        Deploy an autonomous agent to test a web flow.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="url">Target URL</Label>
                                <Input
                                    id="url"
                                    placeholder="https://example.com"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="model">AI Model</Label>
                                <Select value={model} onValueChange={setModel}>
                                    <SelectTrigger id="model">
                                        <SelectValue placeholder="Select Model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gemini-2.0-flash">
                                            ⚡ Gemini 2.0 Flash (Recommended)
                                        </SelectItem>
                                        <SelectItem value="gemini-2.0-pro">
                                            🧠 Gemini 2.0 Pro (High Reasoning)
                                        </SelectItem>
                                        <SelectItem value="gemini-2.5-flash-lite">
                                            🏎️ Gemini 2.5 Flash Lite (Fastest)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="goal">Mission Goal / Prompt</Label>
                            <Textarea
                                id="goal"
                                placeholder="e.g. Login, search for 'shoes', and add the first one to cart."
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                required
                                className="min-h-[300px]"
                            />
                        </div>

                        <div className="flex items-center space-x-2 border p-4 rounded-lg bg-muted/50">
                            <Switch
                                id="chaos-mode"
                                checked={isChaos}
                                onCheckedChange={setIsChaos}
                            />
                            <div className="flex-1">
                                <Label htmlFor="chaos-mode" className="font-bold">
                                    Enable Chaos Mode 😈
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    The agent will face network lag, errors, and will fuzz inputs to try and break the app.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 border p-4 rounded-lg bg-muted/50">
                            <Switch
                                id="headless-mode"
                                checked={headless}
                                onCheckedChange={setHeadless}
                            />
                            <div className="flex-1">
                                <Label htmlFor="headless-mode" className="font-bold">
                                    Headless Mode 👻
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Run the browser without a visible window. Disable to watch the agent live on your machine.
                                </p>
                            </div>
                        </div>

                        {isChaos && (
                            <ChaosControlPanel onChange={setChaosProfile} />
                        )}

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? "Deploying Agent..." : "🚀 Launch Mission"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
