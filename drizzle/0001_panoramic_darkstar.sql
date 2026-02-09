CREATE TABLE IF NOT EXISTS "test_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"step_number" integer NOT NULL,
	"action_type" text NOT NULL,
	"thought" text,
	"selector" text,
	"screenshot_url" text,
	"dom_snapshot" jsonb,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN "browser_connect_url" text;--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN "start_time" timestamp;--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN "end_time" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_steps" ADD CONSTRAINT "test_steps_run_id_test_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "test_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
