import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { Action, ActionType } from './types.js';
import { Redis } from 'ioredis';
import { ChaosController } from './ChaosController.js';

// Redis Publisher for events
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Interface for DOM state tracking
interface DOMSnapshot {
    url: string;
    title: string;
    inputCount: number;
    buttonCount: number;
    visibleText: string;  // First 500 chars of visible text
    formValues: Record<string, string>;  // Input values (redacted)
    timestamp: number;
}

interface DOMDiff {
    urlChanged: boolean;
    titleChanged: boolean;
    inputCountChanged: boolean;
    buttonCountChanged: boolean;
    textChanged: boolean;
    hasChanges: boolean;
    summary: string;
}

export class BrowserController {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    public page: Page | null = null;
    private videoDir: string;
    private lastDOMSnapshot: DOMSnapshot | null = null;
    public chaos: ChaosController;

    constructor(videoDir: string = './artifacts/videos') {
        this.videoDir = videoDir;
        // ensure video dir exists
        if (!fs.existsSync(this.videoDir)) {
            fs.mkdirSync(this.videoDir, { recursive: true });
        }
        this.chaos = new ChaosController();
    }

    async launch() {
        this.browser = await chromium.launch({
            headless: true, // Run headless in production/worker
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
    }

    async startSession(sessionId: string) {
        if (!this.browser) await this.launch();

        this.context = await this.browser!.newContext({
            viewport: { width: 1280, height: 720 },
            recordVideo: {
                dir: this.videoDir,
                size: { width: 1280, height: 720 },
            },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        });

        this.page = await this.context.newPage();
        // Enable better hydration/loading detection
        this.page.setDefaultTimeout(60000);

        // Attach Chaos Controller (inactive by default)
        await this.chaos.attach(this.page);
    }

    async enableChaos(profile?: any) {
        if (!this.page) return;
        await this.chaos.injectGremlins(profile);
    }

    async navigate(url: string) {
        if (!this.page) throw new Error('Session not started');
        try {
            await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            await this.page.waitForLoadState('networkidle'); // Wait for initial network settling

            // Auto-handle consent modals after navigation
            await this.handleConsentModals();
        } catch (e) {
            console.error(`Navigation failed: ${e}`);
            throw e;
        }
    }

    /**
     * Automatically handles common cookie consent modals
     */
    async handleConsentModals(): Promise<boolean> {
        if (!this.page) return false;

        // Common consent button patterns (ordered by priority)
        const consentSelectors = [
            // English patterns
            'button:has-text("Accept all")',
            'button:has-text("Accept All")',
            'button:has-text("Accept cookies")',
            'button:has-text("Accept")',
            'button:has-text("I agree")',
            'button:has-text("Agree")',
            'button:has-text("Allow all")',
            'button:has-text("Allow")',
            'button:has-text("OK")',
            'button:has-text("Got it")',
            // ID-based (common frameworks)
            '#onetrust-accept-btn-handler',
            '#accept-cookies',
            '#cookie-accept',
            '[data-testid="cookie-accept"]',
            '.accept-cookies-button',
            // Czech patterns (for EU)
            'button:has-text("Přijmout vše")',
            'button:has-text("Souhlasím")',
            // German patterns
            'button:has-text("Alle akzeptieren")',
            'button:has-text("Akzeptieren")',
            // Spanish patterns
            'button:has-text("Aceptar todo")',
            'button:has-text("Aceptar")',
        ];

        for (const selector of consentSelectors) {
            try {
                const button = await this.page.locator(selector).first();
                if (await button.isVisible({ timeout: 500 })) {
                    console.log(`🍪 Found consent button: ${selector}`);
                    await button.click({ timeout: 2000 });
                    await this.page.waitForTimeout(500); // Wait for modal to close
                    console.log(`✓ Consent modal handled`);
                    return true;
                }
            } catch { }
        }

        return false;
    }

    /**
     * Clicks at coordinates, auto-scrolling if needed for off-screen elements
     */
    async clickAtCoordinate(x: number, y: number): Promise<void> {
        if (!this.page) throw new Error('Session not started');

        console.log(`Clicking to coordinates (${x}, ${y})`);
        await this.page.mouse.click(x, y);
    }

    /**
     * Hovers over an element to reveal hidden children (like "Add to Cart")
     */
    async hoverElement(selector: string): Promise<boolean> {
        if (!this.page) return false;

        try {
            const escapedSelector = this.escapeSelector(selector);
            const element = await this.page.locator(escapedSelector).first();
            if (await element.isVisible({ timeout: 2000 })) {
                await element.hover();
                await this.page.waitForTimeout(300); // Wait for hover effects
                console.log(`✓ Hovered over: ${selector}`);
                return true;
            }
        } catch { }

        return false;
    }

    async getScreenshot(): Promise<Buffer> {
        if (!this.page) throw new Error('Session not started');
        // Take full page screenshot if possible, or just viewport
        return await this.page.screenshot({
            type: 'jpeg',
            quality: 80,
            fullPage: false // Agent sees the viewport
        });
    }

    /**
     * Advanced DOM Distiller (Level 3)
     * - Traverses Shadow DOM
     * - Maps interactive elements to Coordinates
     * - Optimizes tokens (short keys)
     */
    /**
     * Advanced DOM Distiller (Level 3)
     * - Traverses Shadow DOM
     * - Maps interactive elements to Coordinates
     * - Optimizes tokens (short keys)
     */
    async getPageContext(): Promise<string> {
        if (!this.page) throw new Error('Session not started');

        try {
            // WE MUST PASS A STRING TO EVALUATE TO AVOID TRANSPILER INJECTION (ReferenceError: __name)
            // This function is serialized by Playwright, but tsx/esbuild might still inject things if passed as a closure.
            // Using a string body is the safest way.
            return await this.page.evaluate(`
                (() => {
                    // 1. Helper: Check visibility
                    function isVisible(el) {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            style.opacity !== '0' &&
                            el.getBoundingClientRect().width > 0;
                    }

                    // 2. Helper: Traverse Shadow DOM recursively
                    function getInteractiveElements(root) {
                        const elements = [];
                        // Walker is faster than querySelectorAll for full tree
                        const walker = document.createTreeWalker(root || document, NodeFilter.SHOW_ELEMENT);

                        let node = walker.nextNode();
                        while (node) {
                            const el = node;

                            // Check if interactive
                            const tag = el.tagName.toLowerCase();
                            const role = el.getAttribute('role');
                            const isInteractive =
                                ['input', 'textarea', 'select', 'button', 'a'].includes(tag) ||
                                role === 'button' ||
                                role === 'link' ||
                                role === 'checkbox' ||
                                role === 'menuitem' ||
                                el.hasAttribute('onclick');

                            if (isInteractive && isVisible(el)) {
                                elements.push(el);
                            }

                            // Traverse Shadow Root
                            if (el.shadowRoot) {
                                elements.push(...getInteractiveElements(el.shadowRoot));
                            }
                            node = walker.nextNode();
                        }
                        return elements;
                    }

                    const allInteractive = getInteractiveElements(document);
                    const distilled = [];

                    // 3. Extract & Optimize
                    for (const el of allInteractive) {
                        const rect = el.getBoundingClientRect();
                        const centerX = Math.round(rect.x + rect.width / 2);
                        const centerY = Math.round(rect.y + rect.height / 2);

                        // Skip elements off-screen (optimization)
                        if (centerY < 0 || centerY > window.innerHeight) continue;

                        const item = {
                            t: el.tagName.toLowerCase(), // tag
                            c: [centerX, centerY] // center coordinates [x, y]
                        };

                        // Add useful attributes (if present)
                        const text = el.textContent?.trim() || el.value;
                        if (text && text.length < 50) item.txt = text; // limit text length

                        if (el.id) item.id = el.id;

                        const testId = el.getAttribute('data-test') || el.getAttribute('data-testid');
                        if (testId) item.dt = testId;

                        const label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name');
                        if (label) item.l = label; // l = label/name/placeholder

                        distilled.push(item);
                    }

                    // 4. Return Top 300 elements
                    return JSON.stringify({
                        items: distilled.slice(0, 300),
                        meta: { count: distilled.length, w: window.innerWidth, h: window.innerHeight }
                    });
                })()
            `);
        } catch (e) {
            console.error('Failed to distill DOM:', e);
            return '{}';
        }
    }

    /**
     * Captures the current DOM state for comparison
     */
    async captureDOMSnapshot(): Promise<DOMSnapshot> {
        if (!this.page) throw new Error('Session not started');

        try {
            const snapshot = await this.page.evaluate(() => {
                const inputs = document.querySelectorAll('input, textarea, select');
                const buttons = document.querySelectorAll('button, input[type="submit"], [role="button"]');

                // Get form values (redacted for sensitive fields)
                const formValues: Record<string, string> = {};
                inputs.forEach((el, i) => {
                    const input = el as HTMLInputElement;
                    const key = input.id || input.name || `input_${i}`;
                    const type = input.type?.toLowerCase();
                    if (type === 'password') {
                        formValues[key] = input.value ? '[FILLED]' : '[EMPTY]';
                    } else {
                        formValues[key] = input.value ? '[HAS_VALUE]' : '[EMPTY]';
                    }
                });

                // Get visible text (first 500 chars)
                const visibleText = document.body?.innerText?.slice(0, 500) || '';

                return {
                    url: window.location.href,
                    title: document.title,
                    inputCount: inputs.length,
                    buttonCount: buttons.length,
                    visibleText,
                    formValues
                };
            });

            const result: DOMSnapshot = {
                ...snapshot,
                timestamp: Date.now()
            };

            this.lastDOMSnapshot = result;
            return result;
        } catch (e) {
            console.error('Failed to capture DOM snapshot:', e);
            return {
                url: '',
                title: '',
                inputCount: 0,
                buttonCount: 0,
                visibleText: '',
                formValues: {},
                timestamp: Date.now()
            };
        }
    }

    /**
     * Compares current DOM state with previous snapshot
     */
    async getDOMDiff(): Promise<DOMDiff> {
        const previous = this.lastDOMSnapshot;
        const current = await this.captureDOMSnapshot();

        if (!previous) {
            return {
                urlChanged: false,
                titleChanged: false,
                inputCountChanged: false,
                buttonCountChanged: false,
                textChanged: false,
                hasChanges: true,
                summary: 'First snapshot captured'
            };
        }

        const urlChanged = previous.url !== current.url;
        const titleChanged = previous.title !== current.title;
        const inputCountChanged = previous.inputCount !== current.inputCount;
        const buttonCountChanged = previous.buttonCount !== current.buttonCount;
        const textChanged = previous.visibleText.slice(0, 100) !== current.visibleText.slice(0, 100);

        const hasChanges = urlChanged || titleChanged || inputCountChanged || buttonCountChanged || textChanged;

        // Build summary
        const changes: string[] = [];
        if (urlChanged) changes.push(`URL: ${previous.url} → ${current.url}`);
        if (titleChanged) changes.push(`Title: "${previous.title}" → "${current.title}"`);
        if (inputCountChanged) changes.push(`Inputs: ${previous.inputCount} → ${current.inputCount}`);
        if (buttonCountChanged) changes.push(`Buttons: ${previous.buttonCount} → ${current.buttonCount}`);
        if (textChanged) changes.push('Page content changed');

        return {
            urlChanged,
            titleChanged,
            inputCountChanged,
            buttonCountChanged,
            textChanged,
            hasChanges,
            summary: hasChanges ? changes.join(', ') : 'No changes detected'
        };
    }

    /**
     * Escapes special characters in CSS selectors (dots, brackets, etc.)
     */
    escapeSelector(selector: string): string {
        if (!selector) return selector;

        // If it's already an attribute selector, don't modify
        if (selector.startsWith('[')) return selector;

        // If it starts with # and has special chars (except -), convert to attribute selector
        if (selector.startsWith('#') && /[.:\[\]]/.test(selector.slice(1))) {
            const id = selector.slice(1);
            return `[id='${id}']`;
        }

        return selector;
    }

    /**
     * Finds elements using heuristics when no ID/selector is available
     * Searches for common patterns like "Submit", "Login", "Register" buttons
     */
    async findElementByHeuristic(intent: string): Promise<string | null> {
        if (!this.page) return null;

        // Normalize intent to lowercase for matching
        const normalizedIntent = intent.toLowerCase();

        // Map common intents to likely button text patterns
        const heuristicPatterns: Record<string, string[]> = {
            'submit': ['submit', 'send', 'go', 'continue', 'next', 'done', 'apply'],
            'login': ['login', 'log in', 'sign in', 'signin'],
            'register': ['register', 'sign up', 'signup', 'create account', 'join'],
            'checkout': ['checkout', 'check out', 'proceed', 'pay', 'buy now', 'purchase'],
            'add': ['add', 'add to cart', 'add to bag'],
            'confirm': ['confirm', 'ok', 'yes', 'accept', 'agree'],
            'cancel': ['cancel', 'no', 'close', 'dismiss'],
            'save': ['save', 'update', 'apply changes'],
            'delete': ['delete', 'remove', 'trash'],
            'search': ['search', 'find', 'go']
        };

        // Find matching patterns for the intent
        let patterns: string[] = [];
        for (const [key, values] of Object.entries(heuristicPatterns)) {
            if (normalizedIntent.includes(key)) {
                patterns = [...patterns, ...values];
            }
        }

        // If no patterns matched, use the intent itself
        if (patterns.length === 0) {
            patterns = [normalizedIntent];
        }

        // Try to find buttons matching these patterns
        for (const pattern of patterns) {
            try {
                // Try exact text match
                const exactSelector = `button:has-text("${pattern}"), input[type="submit"][value*="${pattern}" i], [role="button"]:has-text("${pattern}")`;
                const element = await this.page.locator(exactSelector).first();
                if (await element.isVisible({ timeout: 1000 })) {
                    console.log(`✓ Found element by heuristic: "${pattern}"`);
                    return exactSelector;
                }
            } catch { }
        }

        // Try aria-label matching
        for (const pattern of patterns) {
            try {
                const ariaSelector = `[aria-label*="${pattern}" i]`;
                const element = await this.page.locator(ariaSelector).first();
                if (await element.isVisible({ timeout: 500 })) {
                    console.log(`✓ Found element by aria-label heuristic: "${pattern}"`);
                    return ariaSelector;
                }
            } catch { }
        }

        console.log(`✗ No element found for intent: "${intent}"`);
        return null;
    }

    /**
     * Attempts to find an element using multiple selector strategies
     * Returns the working selector or null if not found
     */
    async findElementMultiStrategy(target: {
        selector?: string;
        id?: string;
        name?: string;
        dataTest?: string;
        ariaLabel?: string;
        text?: string;
    }): Promise<string | null> {
        if (!this.page) return null;

        // Build ordered list of selectors to try
        const selectors: string[] = [];

        // Priority 1: data-test/data-testid (most reliable for test automation)
        if (target.dataTest) {
            selectors.push(`[data-test='${target.dataTest}']`);
            selectors.push(`[data-testid='${target.dataTest}']`);
        }

        // Priority 2: ID (escaped for special chars)
        if (target.id) {
            selectors.push(this.escapeSelector(`#${target.id}`));
        }

        // Priority 3: Name attribute
        if (target.name) {
            selectors.push(`[name='${target.name}']`);
        }

        // Priority 4: aria-label
        if (target.ariaLabel) {
            selectors.push(`[aria-label='${target.ariaLabel}']`);
        }

        // Priority 5: Original selector (escaped)
        if (target.selector) {
            selectors.push(this.escapeSelector(target.selector));
        }

        // Try each selector
        for (const selector of selectors) {
            try {
                const element = await this.page.locator(selector).first();
                if (await element.isVisible({ timeout: 1500 })) {
                    console.log(`✓ Found element with: ${selector}`);
                    return selector;
                }
            } catch { }
        }

        // Fallback: scroll and retry with all selectors
        try {
            await this.page.evaluate(() => window.scrollBy(0, 300));
            await this.page.waitForTimeout(400);
        } catch { }

        for (const selector of selectors) {
            try {
                const element = await this.page.locator(selector).first();
                if (await element.isVisible({ timeout: 1000 })) {
                    console.log(`✓ Found element after scroll: ${selector}`);
                    return selector;
                }
            } catch { }
        }

        // Priority 6: Text-based search (last resort for buttons/links)
        if (target.text) {
            try {
                const textSelector = `text="${target.text}"`;
                const element = await this.page.locator(textSelector).first();
                if (await element.isVisible({ timeout: 1000 })) {
                    console.log(`✓ Found element by text: ${textSelector}`);
                    return textSelector;
                }
            } catch { }
        }

        console.log(`✗ Could not find element with any strategy`);
        return null;
    }

    /**
     * Attempts to find and interact with an element using multiple strategies
     * @deprecated Use findElementMultiStrategy instead
     */
    async findElement(selector: string): Promise<boolean> {
        if (!this.page) return false;

        const escapedSelector = this.escapeSelector(selector);

        // Strategy 1: Direct selector
        try {
            const element = await this.page.locator(escapedSelector).first();
            if (await element.isVisible({ timeout: 2000 })) {
                return true;
            }
        } catch { }

        // Strategy 2: Scroll into view and retry
        try {
            await this.page.evaluate(() => window.scrollBy(0, 300));
            await this.page.waitForTimeout(500);
            const element = await this.page.locator(escapedSelector).first();
            if (await element.isVisible({ timeout: 2000 })) {
                return true;
            }
        } catch { }

        // Strategy 3: Scroll to top and search
        try {
            await this.page.evaluate(() => window.scrollTo(0, 0));
            await this.page.waitForTimeout(500);
            const element = await this.page.locator(escapedSelector).first();
            if (await element.isVisible({ timeout: 2000 })) {
                return true;
            }
        } catch { }

        return false;
    }

    /**
     * Gets the center coordinates of a visible element
     */
    async getElementCenter(selector: string): Promise<{ x: number; y: number } | null> {
        if (!this.page) return null;

        const escapedSelector = this.escapeSelector(selector);

        try {
            const element = await this.page.locator(escapedSelector).first();
            const box = await element.boundingBox({ timeout: 2000 });
            if (box) {
                return {
                    x: Math.round(box.x + box.width / 2),
                    y: Math.round(box.y + box.height / 2)
                };
            }
        } catch { }

        return null;
    }

    /**
     * Click using element center coordinates as fallback
     */
    async clickSmartCoordinate(selector: string): Promise<boolean> {
        if (!this.page) return false;

        const center = await this.getElementCenter(selector);
        if (center) {
            console.log(`Clicking element center at (${center.x}, ${center.y})`);
            await this.page.mouse.click(center.x, center.y);
            return true;
        }

        return false;
    }

    /**
     * Executes a click with retry and scroll fallback
     */
    async clickWithRetry(selector: string, maxRetries: number = 3): Promise<void> {
        if (!this.page) throw new Error('Session not started');

        const escapedSelector = this.escapeSelector(selector);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Try direct click
                await this.page.click(escapedSelector, { timeout: 5000 });
                return; // Success!
            } catch (e) {
                console.log(`Click attempt ${attempt} failed, trying fallback...`);

                if (attempt < maxRetries) {
                    // Fallback: scroll and wait
                    try {
                        await this.page.evaluate(() => window.scrollBy(0, 300));
                        await this.page.waitForTimeout(500);
                    } catch { }

                    // Try scrolling element into view
                    try {
                        await this.page.locator(escapedSelector).first().scrollIntoViewIfNeeded({ timeout: 2000 });
                        await this.page.waitForTimeout(300);
                    } catch { }
                } else {
                    throw e; // All retries exhausted
                }
            }
        }
    }

    /**
     * Executes a fill with retry, scroll fallback, and validation
     */
    async fillWithRetry(selector: string, text: string, maxRetries: number = 3): Promise<void> {
        if (!this.page) throw new Error('Session not started');

        const escapedSelector = this.escapeSelector(selector);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.page.fill(escapedSelector, text, { timeout: 5000 });

                // Validate: check if the value was actually entered
                try {
                    const value = await this.page.locator(escapedSelector).first().inputValue({ timeout: 1000 });
                    if (value === text) {
                        console.log(`✓ Fill validated: "${text.slice(0, 10)}..."`);
                        return; // Success with validation!
                    } else {
                        console.warn(`Fill mismatch: expected "${text}" but got "${value}"`);
                    }
                } catch {
                    // inputValue might fail for non-input elements, that's OK
                    return;
                }

                return; // Success!
            } catch (e) {
                console.log(`Fill attempt ${attempt} failed, trying fallback...`);

                if (attempt < maxRetries) {
                    // Scroll element into view
                    try {
                        await this.page.locator(escapedSelector).first().scrollIntoViewIfNeeded({ timeout: 2000 });
                        await this.page.waitForTimeout(300);
                    } catch { }
                } else {
                    throw e;
                }
            }
        }
    }

    async executeAction(action: Action) {
        if (!this.page) throw new Error('Session not started');

        console.log(`Executing action: ${action.type}`, action);

        try {
            switch (action.type) {
                case 'click':
                    let clickSucceeded = false;

                    if (action.coordinate) {
                        try {
                            // Use smart coordinate click with auto-scroll
                            await this.clickAtCoordinate(action.coordinate.x, action.coordinate.y);
                            clickSucceeded = true;
                        } catch (e) {
                            console.warn("Coordinate click failed, trying selector if available");
                            if (action.selector) {
                                try {
                                    await this.clickWithRetry(action.selector);
                                    clickSucceeded = true;
                                } catch { }
                            }
                        }
                    } else if (action.selector) {
                        try {
                            await this.clickWithRetry(action.selector);
                            clickSucceeded = true;
                        } catch (e) {
                            console.warn(`Click on selector failed: ${e}`);
                        }
                    }

                    // SMART FALLBACK: If click failed (element invisible), try pressing Enter
                    // This handles cases like Google's autocomplete overlay hiding the search button
                    if (!clickSucceeded) {
                        console.log('🔄 Click failed - trying Enter key as fallback');
                        await this.page.keyboard.press('Enter');
                        await this.page.waitForTimeout(500);
                    }

                    // Smart wait: navigation OR timeout
                    try {
                        await Promise.race([
                            this.page.waitForNavigation({ timeout: 8000 }),
                            this.page.waitForTimeout(3000)
                        ]);
                    } catch (e) {
                        // Navigation timeout is OK (might be SPA)
                        console.log('Navigation wait completed');
                    }
                    break;

                case 'hover':
                    if (action.selector) {
                        await this.hoverElement(action.selector);
                    } else if (action.coordinate) {
                        await this.page.mouse.move(action.coordinate.x, action.coordinate.y);
                        await this.page.waitForTimeout(300);
                    }
                    break;

                case 'type':
                    if (action.coordinate) {
                        await this.clickAtCoordinate(action.coordinate.x, action.coordinate.y);
                        await this.page.waitForTimeout(500); // Wait for focus
                        await this.page.keyboard.type(action.text!);
                    } else if (action.selector && action.text) {
                        await this.fillWithRetry(action.selector, action.text);
                    } else if (action.text) {
                        // Just type into focused element (risky)
                        console.warn('Typing without selector or coordinate');
                        await this.page.keyboard.type(action.text);
                    }
                    break;

                case 'keypress':
                    if (action.key) {
                        console.log(`⌨️ Pressing key: ${action.key}`);
                        await this.page.keyboard.press(action.key);
                        await this.page.waitForTimeout(500);
                    }
                    break;

                case 'scroll':
                    // Scroll down by default or to specific element
                    if (action.selector && !action.selector.includes('document.')) {
                        try {
                            const element = this.page.locator(action.selector);
                            await element.scrollIntoViewIfNeeded({ timeout: 3000 });
                        } catch (e) {
                            console.log('Scroll to element failed, scrolling page instead');
                            await this.page.evaluate(() => window.scrollBy(0, 500));
                        }
                    } else {
                        // Scroll page - check if "bottom" intent
                        const scrollAmount = action.reason?.toLowerCase().includes('bottom') ? 10000 : 300;

                        // Safety check: Don't scroll if we're already at the bottom
                        const canScroll = await this.page.evaluate(() => {
                            return (window.innerHeight + window.scrollY) < document.body.scrollHeight;
                        });

                        if (canScroll) {
                            await this.page.evaluate((amt) => window.scrollBy(0, amt), scrollAmount);
                        } else {
                            console.log('🚫 Cannot scroll further, reached bottom of page');
                        }
                    }
                    await this.page.waitForTimeout(300);
                    break;

                case 'rage_click':
                    if (action.selector) {
                        // Use Chaos Controller
                        await this.chaos.rageClick(action.selector);
                    } else if (action.coordinate) {
                        console.warn('Rage click with coordinate not fully supported, trying simple click');
                        await this.clickAtCoordinate(action.coordinate.x, action.coordinate.y);
                    }
                    break;

                case 'wait':
                    await this.page.waitForTimeout(action.duration || 2000);
                    break;

                case 'navigate':
                    if (action.text) await this.navigate(action.text);
                    break;

                case 'done':
                case 'fail':
                    // Handled by main loop logic, but we log here
                    console.log(`Test concluded: ${action.type} - ${action.reason}`);
                    break;
            }
        } catch (error) {
            console.error(`Action failed: ${error}`);
            throw error;
        }
    }

    async closeSession(): Promise<string | null> {
        let videoPath: string | null = null;
        if (this.page) {
            const video = this.page.video();
            if (video) {
                videoPath = await video.path();
            }
            await this.page.close();
        }

        if (this.context) {
            await this.context.close();
        }

        this.context = null;
        this.page = null;
        return videoPath;
    }

    async cleanup() {
        if (this.browser) await this.browser.close();
    }
}
