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
    const [goal, setGoal] = useState(`1. Login securely with user "standard_user" and password "secret_sauce"
2. Add first item to the cart
3. Go to this item page, verify that button on this page is changed to "Remove" (means it was added to the cart)
4. Click that Remove button so the product is removed from cart
5. Go Back to Products
6. Add second item to the cart
7. Go to this item page, verify that button on this page is changed to "Remove" (means it was added to the cart)
8. Go to cart
9. Verify that the second item is in the cart only.
10. Data Entry: Fill out the multi-field checkout form.
11. Verification: Click Finish and confirm the success message appears.`);
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
                    model, // Pass selected model
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
