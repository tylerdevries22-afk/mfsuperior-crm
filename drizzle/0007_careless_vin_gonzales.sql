CREATE TYPE "public"."hos_duty_status" AS ENUM('off_duty', 'sleeper_berth', 'driving', 'on_duty_not_driving');--> statement-breakpoint
CREATE TABLE "driver_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"shipment_id" uuid,
	"status" "hos_duty_status" NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_status_events" ADD CONSTRAINT "driver_status_events_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_status_events" ADD CONSTRAINT "driver_status_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "driver_status_events_driver_recorded_at_idx" ON "driver_status_events" USING btree ("driver_id","recorded_at");--> statement-breakpoint
CREATE INDEX "driver_status_events_shipment_recorded_at_idx" ON "driver_status_events" USING btree ("shipment_id","recorded_at");