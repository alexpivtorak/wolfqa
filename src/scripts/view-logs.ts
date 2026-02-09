
import { db } from '../db/index.js';
import { testRuns } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import util from 'util';

dotenv.config();

async function main() {
    const runId = process.argv[2];

    let query = db.select().from(testRuns).orderBy(desc(testRuns.createdAt)).limit(1);

    if (runId) {
        // query = db.select().from(testRuns).where(eq(testRuns.id, parseInt(runId))).limit(1);
        // Typescript dynamic query construction is tricky with drizzle sometimes, doing simple check
        const result = await db.select().from(testRuns).where(eq(testRuns.id, parseInt(runId)));
        if (result.length > 0) {
            printLogs(result[0]);
            return;
        } else {
            console.log(`Test Run ID ${runId} not found.`);
            return;
        }
    }

    const result = await query;
    if (result.length === 0) {
        console.log("No test runs found in database.");
        return;
    }

    printLogs(result[0]);
}

function printLogs(run: any) {
    console.log(`\n--- Test Run #${run.id} ---`);
    console.log(`Goal: ${run.goal}`);
    console.log(`URL: ${run.url}`);
    console.log(`Status: ${run.status}`);
    console.log(`Result: ${run.result || 'pending'}`);
    console.log(`Video: ${run.videoUrl || 'none'}`);
    console.log(`\n--- LOGS ---`);

    if (!run.logs || !Array.isArray(run.logs)) {
        console.log("No structured logs found.");
        return;
    }

    run.logs.forEach((log: string) => {
        // Logs are stored as strings in the JSON array based on worker implementation
        console.log(log);
    });
    console.log(`\n--- END ---`);
}

main().catch(console.error);
