import { pgTable, serial, text, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    email: text('email').unique().notNull(),
    apiKey: text('api_key').unique().notNull(), // For API access
    createdAt: timestamp('created_at').defaultNow(),
});

export const testRuns = pgTable('test_runs', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id),
    url: text('url').notNull(),
    goal: text('goal').notNull(),
    status: text('status').notNull().default('queued'), // queued, running, completed, failed
    result: text('result'), // 'pass', 'fail'
    logs: jsonb('logs'), // Array of actions/logs
    videoUrl: text('video_url'), // Link to stored video
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const issues = pgTable('issues', {
    id: serial('id').primaryKey(),
    testRunId: integer('test_run_id').references(() => testRuns.id),
    description: text('description').notNull(),
    severity: text('severity').default('medium'), // low, medium, high, critical
    timestamp: text('timestamp'), // Video timestamp
    createdAt: timestamp('created_at').defaultNow(),
});
