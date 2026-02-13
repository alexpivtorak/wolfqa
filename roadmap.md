# 🐺 WolfQA Development Roadmap

This document outlines the evolutionary stages of WolfQA, moving from a single-player prototype to an enterprise-grade Autonomous QA Platform.

## 📅 High-Level Timeline

| Stage | Name | Focus | Key Deliverable |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **The Glass Box** | Observability & Debugging | Live "See/Think/Act" Dashboard |
| **Phase 2** | **The Iron Clad** | Reliability & Stress Testing | Chaos Mode & Action Caching |
| **Phase 3** | **The Hive Mind** | Scale & ROI | Team Management & Self-Healing Ledger |

---

## 🟢 Phase 1: The Glass Box (The "Trust" Phase)
**Goal:** Stop the AI from being a "Black Box." Give developers a real-time view of what the Agent is seeing and thinking.

### 🖥️ Dashboard Features (UI)
* **Live Stream Player:**
    * Embed a VNC or MJPEG stream of the Playwright browser.
    * **Overlay:** Draw a bounding box around the element Gemini *plans* to click.
* **The "Thought" Console:**
    * A scrolling log (like a terminal) showing the *Reasoning Chain*.
    * *Example:* `[THINKING] "I see a popup. ID: #promo-modal. Strategy: Close it."`

### ⚙️ Settings (Configuration)
* **Vision Model:** Toggle between `gemini-2.0-flash` (Speed) and `gemini-1.5-pro` (Reasoning).
* **Headless Mode:** `true` / `false` (Allow user to watch the browser locally).
* **Target URL:** The entry point for the test.

### 🔧 Core Tech
* **Backend:** Implement `Server-Sent Events (SSE)` or `WebSockets` to push "Thoughts" from the Node worker to the Frontend.
* **Storage:** Basic Drizzle schema for `TestRuns` and `Logs`.

---

## 🟡 Phase 2: The Iron Clad (The "Resiliency" Phase)
**Goal:** Move beyond "Happy Path" testing. Introduce stress testing and caching to speed up execution and find edge cases.

### 🖥️ Dashboard Features (UI)
* **Timeline Editor (The "Forensics" View):**
    * A horizontal track of the test run.
    * Clicking a step allows "Replay" or "Inspect" of that specific moment.
* **Chaos Control Panel:**
    * **Sliders:** Gamified controls for network conditions.
        * Latency: `0ms` ↔ `5000ms`
        * Packet Drop Rate: `0%` ↔ `20%`
* **Cache Indicator:**
    * Visual badge showing if a step was `🤖 AI Generated` (Slow) or `⚡ Cache Hit` (Fast).

### ⚙️ Settings (Configuration)
* **Chaos Profiles:**
    * `Gremlin Mode`: Random clicks, high latency.
    * `Hacker Mode`: Injects SQLi strings into inputs.
* **Max Retries:** How many times the AI can try to "self-heal" a failed step (default: 3).

### 🔧 Core Tech
* **Smart Caching:** Implement the `Anchor Strategy` (caching selectors/text, not coordinates).
* **Network Interception:** Use Playwright's `route` API to inject latency and failures based on dashboard sliders.

---

## 🔴 Phase 3: The Hive Mind (The "Enterprise" Phase)
**Goal:** Features required for teams, billing, and large-scale parallel execution.

### 🖥️ Dashboard Features (UI)
* **The "ROI" Ledger:**
    * A widget showing: *"WolfQA fixed 14 broken selectors this week. Saved 5.2 engineering hours."*
* **Visual Regression Diff:**
    * Automatic comparison of "Baseline" vs. "Current" screenshots with a diff overlay (Red pixels = changes).
* **Fleet Status:**
    * Grid view of 50+ concurrent browsers running tests in parallel (via BullMQ).

### ⚙️ Settings (Configuration)
* **Schedule:** Cron-job settings (e.g., "Run regression suite every night at 3 AM").
* **Notifications:** Slack/Email webhooks for "Test Failed" or "Healing Event."
* **Strictness:**
    * `Strict`: Fail on any visual change > 1%.
    * `Lenient`: Ignore minor layout shifts.

### 🔧 Core Tech
* **Orchestration:** Kubernetes or Docker Swarm setup for scaling Workers.
* **S3 / Blob Storage:** For storing video recordings and thousands of screenshots efficiently.

---

## 📝 Immediate Todo List (Next 2 Weeks)

- [ ] **Data Model:** Create `runs`, `steps`, and `snapshots` tables in Drizzle.
- [ ] **API:** Create a `/stream/{runId}` endpoint for the Live Dashboard.
- [ ] **Agent:** Update `VisionBrain.ts` to emit "Thought" events before "Action" events.
- [ ] **UI:** Build the "Live Mission" view in Next.js.
