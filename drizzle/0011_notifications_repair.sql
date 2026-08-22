-- Repair: create the `notifications` table and its enum.
--
-- `notifications` has been declared in src/lib/db/schema.ts and recorded in the
-- drizzle snapshot since 0004, but no migration ever emitted the DDL — the
-- table only ever existed on databases where someone ran `db:push`. Every
-- freshly migrated database (staging, production, CI) was therefore missing it,
-- which silently broke the notification insert in POST /api/contact and would
-- 500 any notifications read.
--
-- Written idempotently because databases that were pushed rather than migrated
-- already have these objects.

DO $$ BEGIN
  CREATE TYPE "public"."notification_type" AS ENUM('lead_submitted', 'email_sent', 'email_opened', 'email_replied', 'sequence_completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"lead_id" uuid,
	"read_at" timestamp with time zone,
	"metadata_json" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
