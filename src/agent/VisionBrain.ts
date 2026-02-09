import { GoogleGenerativeAI } from '@google/generative-ai';
import { Action } from './types.js';
import dotenv from 'dotenv';

dotenv.config();

export class VisionBrain {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey?: string) {
        const key = apiKey || process.env.GOOGLE_API_KEY;
        if (!key) throw new Error('GOOGLE_API_KEY is required');
        this.genAI = new GoogleGenerativeAI(key);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }

    async decideAction(screenshot: Buffer, goal: string, history: string[], pageContext?: string, domDiff?: string): Promise<Action> {
        const contextSection = pageContext ? `
      
      PAGE CONTEXT (use this to find exact selectors):
      ${pageContext}
      
      SELECTOR PRIORITY (use the first available):
      1. data-test or data-testid: [data-test='value'] or [data-testid='value']
      2. id attribute: #elementId (note: if ID has dots like "customer.firstName", use [id='customer.firstName'])
      3. name attribute: [name='fieldName']
      4. aria-label: [aria-label='Button text']
      5. Text content for buttons: Use coordinates if text is visible
      
      IMPORTANT: Always prefer selectors over coordinates for form inputs.
      ` : '';

        // Add DOM diff info if available
        const diffSection = domDiff ? `
      
      PAGE CHANGE DETECTION:
      ${domDiff}
      
      Use this to verify if your last action had an effect. If "No changes detected" after multiple clicks, try a different approach.
      ` : '';

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
      8. **DO NOT CLEAR OR RETYPE**: If an input field ALREADY contains the correct text you need, DO NOT clear it or retype. Move to the NEXT action.
      9. **PROGRESS FORWARD**: After typing, the next step is usually "keypress" with "Enter" or clicking a visible submit button.
      10. **DETECT SUCCESS**: If the page has visually changed (new content, different URL), the goal is likely DONE.
      11. **LOOP DETECTION**: If history shows you attempted the same action 2+ times, STOP. Either return "done" if goal seems achieved, or "fail" if truly stuck.
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

    private async generateAction(prompt: string, screenshot: Buffer): Promise<Action> {
        // Convert Buffer to base64
        const imagePart = {
            inlineData: {
                data: screenshot.toString('base64'),
                mimeType: 'image/jpeg',
            },
        };

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

            return JSON.parse(jsonMatch[0]) as Action;
        } catch (error) {
            console.error('VisionBrain Error:', error);
            return { type: 'wait', duration: 2000, reason: 'Brain freeze (error)' };
        }
    }
}
