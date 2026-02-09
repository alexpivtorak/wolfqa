import { Page } from 'playwright';

export class ChaosController {

    private isActive: boolean = false;
    private page: Page | null = null;

    constructor() { }

    /**
     * Activates the chaos controller on a specific page
     */
    async attach(page: Page) {
        this.page = page;
        this.isActive = true;
        console.log('😈 Chaos Controller Attached!');
    }

    /**
     * Injects network gremlins (latency, packet loss)
     */
    async injectGremlins() {
        if (!this.page) return;

        console.log('👾 Injecting Network Gremlins...');

        await this.page.route('**/*', async (route) => {
            if (!this.isActive) {
                await route.continue();
                return;
            }

            const random = Math.random();
            const request = route.request();
            const resourceType = request.resourceType();

            // SKIP CORE ASSETS (CSS, JS) to avoid breaking the app entirely visually
            // We focus on XHR/Fetch/Documents
            if (['image', 'font', 'stylesheet'].includes(resourceType)) {
                await route.continue();
                return;
            }

            // 10% chance to abort XHR/Fetch requests (Simulate packet loss)
            if (random < 0.10 && (resourceType === 'xhr' || resourceType === 'fetch')) {
                console.log(`👾 Gremlin intercepted: Aborting ${request.url().slice(0, 50)}...`);
                try {
                    await route.abort('failed');
                } catch (e) { }
                return;
            }

            // 20% chance to add massive latency (Simulate bad connections)
            if (random > 0.10 && random < 0.30) {
                // 1-3 seconds lag
                const delay = Math.floor(Math.random() * 2000) + 1000;
                // console.log(`🐌 Gremlin slowing down: ${request.url().slice(0, 30)}... by ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));
            }

            try {
                await route.continue();
            } catch (e) { }
        });
    }

    /**
     * Clicks an element 10 times rapidly
     */
    async rageClick(selector: string) {
        if (!this.page) return;

        console.log(`🔥 RAGE CLICKING: ${selector}`);
        try {
            // We accept selectors, but we need to handle potential errors gracefully
            // so we don't crash the TEST, just stress the APP.
            const element = await this.page.locator(selector).first();

            if (await element.isVisible({ timeout: 2000 })) {
                // Click 10 times with very short delay
                for (let i = 0; i < 10; i++) {
                    // Ignore errors during individual clicks (e.g. element detached)
                    await element.click({ delay: 20, timeout: 500, force: true }).catch(() => { });
                }
            } else {
                console.log(`⚠️ Cannot rage click, element not visible: ${selector}`);
            }
        } catch (e) {
            console.error(`Error during rage click: ${e}`);
        }
    }
}
