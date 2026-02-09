import { GoogleGenerativeAI } from '@google/generative-ai';
import { Action } from './types.js';
import { testSteps } from '../db/schema.js';
import { db } from '../db/index.js';
import dotenv from 'dotenv';
import Redis from 'ioredis';

dotenv.config();

// Redis Publisher for inter-process communication
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export class VisionBrain {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey?: string) {
        const key = apiKey || process.env.GOOGLE_API_KEY;
        if (!key) throw new Error('GOOGLE_API_KEY is required');
        this.genAI = new GoogleGenerativeAI(key);
        // Using 2.0 Flash Lite as 1.5 Flash returned 404
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        console.log(`🤖 VisionBrain initialized with model: ${modelName}`);
        this.model = this.genAI.getGenerativeModel({ model: modelName });
    }

    async decideAction(screenshot: Buffer, goal: string, history: string[], pageContext?: string, domDiff?: string, runId?: number): Promise<Action> {
        const contextSection = pageContext ? `
      
      PAGE CONTEXT (Distilled DOM):
      The page context is provided as a compressed JSON list of interactive elements.
      - t: tag name (btn=button, inp=input, etc.)
      - c: [x, y] center coordinates (USE THESE for precise clicking)
      - txt: visible text or value
      - dt: data-test or data-testid
      - l: label/aria-label/placeholder
      - id: element id
      
      ${pageContext}
      
      SELECTOR PRIORITY:
      1. Coordinate: { "coordinate": { "x": 123, "y": 456 } } (Highly reliable, use 'c' values from context)
      2. data-test/id: [data-test='value']
      3. Text/Label: Use text content if unique.
      
      IMPORTANT: If an element has coordinates 'c', PREFER using "coordinate": { "x": ..., "y": ... } over selectors.
      ` : '';

        // Add DOM diff info if available
        const diffSection = domDiff ? `
      
      PAGE CHANGE DETECTION:
      ${domDiff}
      
      Use this to verify if your last action had an effect. If "No changes detected" after multiple clicks, try a different approach.
      ` : '';

        if (runId) {
            redis.publish('wolfqa-events', JSON.stringify({ runId, type: 'thought', message: 'Analyzing page state...' }));
        }

        const prompt = `
      You are an automated QA tester acting as a user. 
      Your Goal: "${goal}"
      
      History of actions:
      ${history.join('\n')}
${contextSection}${diffSection}
      Analyze the screenshot. Determine the next logical step to achieve the goal.
      Return ONLY a JSON object with the following structure:
      {
        "type": "click" | "type" | "keypress" | "scroll" | "hover" | "wait" | "navigate" | "done" | "fail",
        "reason": "short explanation",
        "selector": "css selector (optional)",
        "coordinate": { "x": 123, "y": 456 } (optional, for click/hover),
        "text": "text to type" (optional, for 'type' action),
        "key": "Enter" | "Escape" | "Tab" | etc. (optional, for 'keypress' action),
        "intent": "what button/element you're looking for" (optional, for heuristic search)
      }

      Rules:
      1. If the goal is achieved, return type: "done".
      2. If you are stuck or see an error, return type: "fail".
      3. For "click" actions: PREFER "coordinate" based on what you SEE in the screenshot.
      4. For "type" actions: Type into input fields. After typing in a search box, use "keypress" with "key": "Enter" to submit.
      5. For "keypress": Use this after typing to submit forms (Enter), close dialogs (Escape), or move to next field (Tab).
      6. Do not wrap result in markdown blocks. Just raw JSON.
      7. IMPORTANT: If a button is hidden or covered by an overlay, use "keypress" with "Enter" instead of trying to click it.

      CRITICAL ANTI-LOOP RULES:
      8. **INTERACTION TRANSITION**: If you just clicked an input field (search, login), your NEXT action MUST be "type". Do not click it again.
      9. **DO NOT CLEAR OR RETYPE**: If an input field ALREADY contains the correct text you need, DO NOT clear it or retype. Move to the NEXT action.
      10. **PROGRESS FORWARD**: After typing, the next step is usually "keypress" with "Enter" or clicking a visible submit button.
      11. **DETECT SUCCESS**: If the page has visually changed (new content, different URL), the goal is likely DONE.
      12. **LOOP DETECTION**: If history shows you attempted the same action 2+ times, STOP. Either return "done" if goal seems achieved, or "fail" if truly stuck.
    `;

        return this.generateAction(prompt, screenshot);
    }

    async decideChaosAction(screenshot: Buffer, history: string[]): Promise<Action> {
        const prompt = `
      You are an Expert QA Penetration Tester. Your goal is NOT to complete the purchase successfully. Your goal is to crash the application, trigger error messages, or find logic loopholes.

      Directives:
      Fuzz Inputs: When asked for a name or text input, try emojis (😀), SQL injection patterns (' OR 1=1), or long text.
      Edge Case Navigation: If there is a 'Back' button during payment, click it. If there is a 'Quantity' field, try entering -1 or 0.
      Resource Stress: If you see a 'Generate' or 'Search' button, try clicking it.
      Visual Analysis: Look for broken layouts, overlapping text, or '500 Internal Server Error' pages.

      History of actions:
      ${history.join('\n')}

      Analyze the screenshot. Determine the next chaotic step.
      Return ONLY a JSON object with the following structure:
      {
        "type": "click" | "rage_click" | "type" | "scroll" | "wait" | "navigate" | "done" | "fail",
        "reason": "short explanation of the chaos strategy",
        "selector": "css selector (optional)",
        "coordinate": { "x": 123, "y": 456 } (optional),
        "text": "text to type" (optional)
      }
      
      Rules:
      1. Never return "done". Chaos never ends (until the loop limit).
      2. If you see a crash/error page, return "fail" (which indicates the app CRASHED).
      3. Do not wrap result in markdown blocks. Just raw JSON.
    `;

        const action = await this.generateAction(prompt, screenshot);

        // --- NASTY STRING INJECTION ---
        // Overwrite text with nasty strings 50% of the time, or if the model specifically requested a placeholder
        const NASTY_STRINGS = [
            "' OR 1=1--",                // SQL Injection
            "<script>alert(1)</script>", // XSS
            "😀😃😄😁😆😅😂🤣",           // Emojis
            "A".repeat(1000),            // Buffer Overflow / Long Text
            "-1",                        // Negative Numbers
            "0",                         // Zero
            "undefined",                 // JS primitives
            "null",
            "{{7*7}}",                   // SSTI
            "../../etc/passwd"           // Path Traversal
        ];

        if (action.type === 'type') {
            const shouldInject = Math.random() < 0.5 || action.text?.includes("NASTY") || !action.text;
            if (shouldInject) {
                const randomString = NASTY_STRINGS[Math.floor(Math.random() * NASTY_STRINGS.length)];
                action.text = randomString;
                action.reason = (action.reason || "") + ` [Injected Nasty String: ${randomString}]`;
            }
        }

        return action;
    }

    private async generateAction(prompt: string, screenshot: Buffer, runId?: number): Promise<Action> {
        // Convert Buffer to base64
        const imagePart = {
            inlineData: {
                data: screenshot.toString('base64'),
                mimeType: 'image/jpeg',
            },
        };

        let retries = 3;
        let delay = 2000;

        while (retries > 0) {
            try {
                const result = await this.model.generateContent([prompt, imagePart]);
                const response = result.response;
                const text = response.text();

                console.log('Gemini Response:', text);

                // Extract JSON from potential markdown or text wrapper
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error("No JSON found in response");
                }

                const action = JSON.parse(jsonMatch[0]) as Action;

                if (runId) {
                    redis.publish('wolfqa-events', JSON.stringify({ runId, type: 'step', action, timestamp: new Date() }));

                    // Persist to DB immediately
                    // await db.insert(testSteps).values({
                    //    runId,
                    //    stepNumber: history.length + 1, // approximate
                    //    actionType: action.type,
                    //    thought: action.reason,
                    //    selector: action.selector,
                    //    // screenshotUrl: ... (handled by worker)
                    //    domSnapshot: {} // (handled by worker)
                    // });
                }

                return action;
            } catch (error: any) {
                console.error(`VisionBrain Error (Attempts left: ${retries}):`, error);

                if (error.message?.includes('429') || error.status === 429) {
                    console.log(`⏳ Rate limited. Waiting ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                    retries--;
                } else {
                    // Non-retriable error
                    return { type: 'wait', duration: 2000, reason: `Brain error: ${error.message}` };
                }
            }
        }

        return { type: 'wait', duration: 5000, reason: 'Brain freeze (rate limited)' };
    }
}
