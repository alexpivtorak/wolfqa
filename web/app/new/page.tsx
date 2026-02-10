"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChaosControlPanel, ChaosProfile } from "@/components/chaos-control";
import { useRouter } from "next/navigation";

export default function NewMission() {
    const router = useRouter();
    const [url, setUrl] = useState("https://saucedemo.com");
    const [goal, setGoal] = useState("Login with standard_user and buy a onesie");
    const [isChaos, setIsChaos] = useState(false);
    const [chaosProfile, setChaosProfile] = useState<ChaosProfile | null>(null);
    const [isLoading, setIsLoading] = useState(false);

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
                            <Label htmlFor="goal">Mission Goal / Prompt</Label>
                            <Textarea
                                id="goal"
                                placeholder="e.g. Login, search for 'shoes', and add the first one to cart."
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                required
                                className="h-24"
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
