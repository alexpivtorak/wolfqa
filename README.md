# WolfQA - Agentic Quality Assurance Platform

> 🐺 **WolfQA**: An AI-powered QA agent that tests your web application like a chaotic human.

## Overview

WolfQA is a scalable, containerized platform that uses **Google Gemini 2.0 Flash** (Vision) and **Playwright** to autonomously navigate and test web applications.

It operates on a `Job Queue` architecture, making it suitable for B2B deployments where hundreds of concurrent tests might be needed.

### Key Features
- **Visual Intelligence**: Uses Gemini 2.0 Flash to "see" the page and make decisions based on pixels, not just code selectors.
- **Chaos Mode**: Optional "Monkey Testing" mode to stress-test applications.
- **Scalable**: Built on Redis (BullMQ) and Docker, allowing horizontal scaling of worker nodes.
- **Permanent Records**: Stores all test runs, logs, and issues in PostgreSQL.

## Architecture

1.  **Manager (Docker)**: Orchestrates the system.
    -   `PostgreSQL`: Database for persistence.
    -   `Redis`: Job Queue.
2.  **Worker (Node.js)**: Consumes jobs, launches Playwright, and runs the AI loop.
3.  **Brain (Gemini)**: The Vision Language Model (VLM) deciding actions.

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Must be running)
- [Node.js](https://nodejs.org/) (v20+)
- A Google AI Studio API Key

### 1. Setup Environment
Clone the repo and install dependencies:

```bash
pnpm install
npx playwright install
```

Create a `.env` file in the root:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
DATABASE_URL=postgres://wolfqa:securepassword@127.0.0.1:5433/wolfqa_db
REDIS_URL=redis://127.0.0.1:6379
```

### 2. Start Everything
The easiest way to start the entire ecosystem (Infra, API, Worker, and Web Dashboard):

```bash
# Start all services (Postgres, Redis, API, Worker, Web)
pnpm run up

# Run database migrations (first time only)
pnpm run db:push
```

---

## 🛠️ Maintenance & Utility Scripts

| Command | Description |
| :--- | :--- |
| `pnpm run up` | 🚀 **Recommended**. Starts Infra + API + Worker + Front-end. |
| `pnpm run dev:all` | Starts API + Worker + Front-end (Infra must be running). |
| `pnpm run infra:up` | Starts Postgres & Redis containers only. |
| `pnpm run infra:down` | Stops all containers. |
| `pnpm run clean` | 🧹 **Cleanup**. Deletes all artifacts and clears the action cache. |
| `pnpm run kill:all` | Forcefully kills all running Node.js processes. |

### 4. Trigger a Test
In another terminal, send a job to the queue:

```bash
# Standard Goal-Oriented Test
npm run trigger https://www.google.com "Search for entropy"

# Chaos Mode (Monkey Testing)
npm run trigger https://example.com "Crash this site" chaos
```

### 5. Multi-Step Flows (E.E Tests)
Define complex flows in `tests.json` (root directory):

```bash
npm run trigger:flow sauce-flow
```

Example `tests.json`:
```json
[
  {
    "id": "sauce-flow",
    "name": "SauceDemo Purchase",
    "url": "https://www.saucedemo.com",
    "steps": [
      { "name": "Login", "goal": "Login as standard_user" },
      { "name": "Checkout", "goal": "Add item and checkout" }
    ]
  }
]
```

## Troubleshooting

- **Database Connection Error**: Ensure Docker is running. The default port is mapped to `5433` to avoid conflicts with local Postgres instances.
- **AI 404 Error**: Ensure you are using a valid model name in `VisionBrain.ts` (currently `gemini-2.0-flash`).
