CREATE TYPE "public"."freight_request_type" AS ENUM('quote', 'pickup', 'delivery', 'exception');--> statement-breakpoint
ALTER TABLE "freight_requests" ADD COLUMN "subject" varchar(200);--> statement-breakpoint
ALTER TABLE "freight_requests" ADD COLUMN "request_type" "freight_request_type" DEFAULT 'quote' NOT NULL;