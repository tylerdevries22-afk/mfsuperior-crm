CREATE TYPE "public"."driver_shift_status" AS ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."schedule_sync_status" AS ENUM('pending', 'synced', 'failed');--> statement-breakpoint
CREATE TYPE "public"."shift_coverage_request_status" AS ENUM('pending', 'accepted', 'declined', 'closed');--> statement-breakpoint
CREATE TABLE "driver_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "driver_shift_status" DEFAULT 'scheduled' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_shifts_id_carrier_unique" UNIQUE("id","carrier_id"),
	CONSTRAINT "driver_shifts_span_check" CHECK ("driver_shifts"."ends_at" > "driver_shifts"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "schedule_sync_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"provider" varchar(40) DEFAULT 'target' NOT NULL,
	"status" "schedule_sync_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_coverage_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"from_driver_id" uuid NOT NULL,
	"target_driver_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"status" "shift_coverage_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_driver_carrier_fk" FOREIGN KEY ("driver_id","carrier_id") REFERENCES "public"."drivers"("id","carrier_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_sync_statuses" ADD CONSTRAINT "schedule_sync_statuses_shift_carrier_fk" FOREIGN KEY ("shift_id","carrier_id") REFERENCES "public"."driver_shifts"("id","carrier_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_coverage_requests" ADD CONSTRAINT "shift_coverage_requests_shift_carrier_fk" FOREIGN KEY ("shift_id","carrier_id") REFERENCES "public"."driver_shifts"("id","carrier_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_coverage_requests" ADD CONSTRAINT "shift_coverage_requests_from_driver_carrier_fk" FOREIGN KEY ("from_driver_id","carrier_id") REFERENCES "public"."drivers"("id","carrier_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_coverage_requests" ADD CONSTRAINT "shift_coverage_requests_target_driver_carrier_fk" FOREIGN KEY ("target_driver_id","carrier_id") REFERENCES "public"."drivers"("id","carrier_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "driver_shifts_carrier_starts_at_idx" ON "driver_shifts" USING btree ("carrier_id","starts_at");--> statement-breakpoint
CREATE INDEX "driver_shifts_driver_starts_at_idx" ON "driver_shifts" USING btree ("driver_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_sync_statuses_shift_unique" ON "schedule_sync_statuses" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "schedule_sync_statuses_carrier_status_idx" ON "schedule_sync_statuses" USING btree ("carrier_id","status");--> statement-breakpoint
CREATE INDEX "shift_coverage_requests_carrier_status_idx" ON "shift_coverage_requests" USING btree ("carrier_id","status");--> statement-breakpoint
CREATE INDEX "shift_coverage_requests_target_status_idx" ON "shift_coverage_requests" USING btree ("target_driver_id","status");