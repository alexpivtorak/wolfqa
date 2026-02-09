import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index.js';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// We need to close the pool after migration to exit the process
// But db/index.ts exports `db` initialized with a pool that isn't exported directly.
// In a real app we'd structure this better, but for now we'll just let Node exit 
// or force exit. The migrator doesn't close the connection automatically.

async function runMigrations() {
    console.log('Running migrations...');
    try {
        // This will run migrations from the 'drizzle' folder
        await migrate(db, { migrationsFolder: './drizzle' });
        console.log('Migrations complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigrations();
