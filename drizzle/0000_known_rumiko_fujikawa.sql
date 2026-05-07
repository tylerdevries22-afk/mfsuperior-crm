CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'paused', 'completed', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('queued', 'draft_created', 'sent', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."send_mode" AS ENUM('draft', 'auto_send');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('new', 'contacted', 'replied', 'quoted', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."suppression_reason" AS ENUM('unsubscribed', 'bounced', 'manual', 'invalid', 'replied');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"entity" varchar(80) NOT NULL,
	"entity_id" text,
	"action" varchar(80) NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_sync_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sheet_hash" text,
	"conflicts_pending" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"email_event_id" uuid,
	"url" text NOT NULL,
	"tracking_id" text NOT NULL,
	"ip_hash" text,
	"ua_hash" text,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"provider_message_id" text,
	"event_type" "event_type" NOT NULL,
	"template_id" uuid,
	"sequence_step" integer,
	"metadata_json" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" varchar(40) DEFAULT 'active' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text NOT NULL,
	"sequence_id" uuid,
	"sequence_step" integer,
	"send_mode" "send_mode" DEFAULT 'draft' NOT NULL,
	"attachment_drive_file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_sequence_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"next_send_at" timestamp with time zone,
	"paused_reason" text,
	"gmail_thread_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(120),
	"last_name" varchar(120),
	"email" text,
	"phone" varchar(40),
	"company_name" text,
	"website" text,
	"vertical" varchar(120),
	"address" text,
	"city" varchar(120),
	"state" varchar(40),
	"source" varchar(80),
	"stage" "stage" DEFAULT 'new' NOT NULL,
	"status" varchar(40) DEFAULT 'active' NOT NULL,
	"tier" "tier",
	"score" integer,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"drive_row_id" text,
	"drive_file_id" text,
	"drive_sync_orphan" boolean DEFAULT false NOT NULL,
	"last_contacted_at" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"business_name" text DEFAULT 'MF Superior Solutions' NOT NULL,
	"business_address" text DEFAULT '' NOT NULL,
	"business_mc" text,
	"business_usdot" text,
	"sender_name" text DEFAULT 'Tyler DeVries' NOT NULL,
	"sender_email" text NOT NULL,
	"drive_folder_id" text,
	"daily_send_cap" integer DEFAULT 20 NOT NULL,
	"warmup_started_at" timestamp with time zone,
	"unsubscribe_footer_html" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppression_list" (
	"email" text PRIMARY KEY NOT NULL,
	"reason" "suppression_reason" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unsubscribes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"email" text NOT NULL,
	"reason" text,
	"source" varchar(40) DEFAULT 'link' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_clicks" ADD CONSTRAINT "email_clicks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_clicks" ADD CONSTRAINT "email_clicks_email_event_id_email_events_id_fk" FOREIGN KEY ("email_event_id") REFERENCES "public"."email_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_enrollment_id_lead_sequence_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."lead_sequence_enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_sequence_id_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_sequence_enrollments" ADD CONSTRAINT "lead_sequence_enrollments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_sequence_enrollments" ADD CONSTRAINT "lead_sequence_enrollments_sequence_id_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unsubscribes" ADD CONSTRAINT "unsubscribes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_events_idempotency" ON "email_events" USING btree ("enrollment_id","sequence_step","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_lead_sequence_unique" ON "lead_sequence_enrollments" USING btree ("lead_id","sequence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_email_unique" ON "leads" USING btree ("email") WHERE "leads"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "leads_company_no_email_unique" ON "leads" USING btree ("company_name") WHERE "leads"."email" IS NULL AND "leads"."company_name" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "leads_tier_score_idx" ON "leads" USING btree ("tier","score");