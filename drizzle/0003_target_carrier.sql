CREATE TYPE "public"."carrier_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."driver_status" AS ENUM('available', 'on_duty', 'off_duty', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."edi_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."edi_status" AS ENUM('received', 'parsed', 'processed', 'error', 'acknowledged');--> statement-breakpoint
CREATE TYPE "public"."geofence_type" AS ENUM('store', 'distribution_center', 'pickup', 'delivery', 'other');--> statement-breakpoint
CREATE TYPE "public"."shipment_source" AS ENUM('manual', 'simulated', 'edi');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('tendered', 'accepted', 'dispatched', 'at_pickup', 'in_transit', 'at_delivery', 'delivered', 'cancelled', 'exception');--> statement-breakpoint
-- This CRM table predates migration tracking and may already have been created
-- by ensureSchemaUpToDate(). Keep its migration safe for those deployments.
CREATE TABLE IF NOT EXISTS "quick_add_backlog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"company_name" text NOT NULL,
	"website" text,
	"industry" varchar(60),
	"vertical" text,
	"refrigerated" boolean DEFAULT false NOT NULL,
	"chain" boolean DEFAULT false NOT NULL,
	"source" varchar(32) NOT NULL,
	"source_note" text,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scac" varchar(10) NOT NULL,
	"name" varchar(200) NOT NULL,
	"dot_number" varchar(20),
	"contact_email" text,
	"contact_phone" varchar(50),
	"target_vendor_id" varchar(100),
	"edi_qualifier" varchar(50),
	"edi_id" varchar(50),
	"status" "carrier_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carriers_scac_unique" UNIQUE("scac")
);
--> statement-breakpoint
CREATE TABLE "driver_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"shipment_id" uuid,
	"latitude" varchar(30) NOT NULL,
	"longitude" varchar(30) NOT NULL,
	"accuracy" integer,
	"speed" integer,
	"heading" integer,
	"altitude" integer,
	"battery_level" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" text,
	"phone" varchar(50),
	"license_number" varchar(100),
	"license_state" varchar(10),
	"cdl_type" varchar(20),
	"status" "driver_status" DEFAULT 'available' NOT NULL,
	"current_lat" varchar(30),
	"current_lng" varchar(30),
	"location_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edi_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_type" varchar(10) NOT NULL,
	"direction" "edi_direction" DEFAULT 'inbound' NOT NULL,
	"sender_id" varchar(100),
	"receiver_id" varchar(100),
	"control_number" varchar(20),
	"group_control_number" varchar(20),
	"transaction_set_control_number" varchar(20),
	"shipment_id" uuid,
	"status" "edi_status" DEFAULT 'received' NOT NULL,
	"error_message" text,
	"raw_content" text,
	"parsed_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edi_transactions_type_check" CHECK ("edi_transactions"."transaction_type" in ('204', '210', '214', '990', '997'))
);
--> statement-breakpoint
CREATE TABLE "geofences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "geofence_type" DEFAULT 'store' NOT NULL,
	"address" varchar(300),
	"city" varchar(100),
	"state" varchar(10),
	"zip" varchar(20),
	"latitude" varchar(30) NOT NULL,
	"longitude" varchar(30) NOT NULL,
	"radius_meters" integer DEFAULT 500 NOT NULL,
	"target_store_id" varchar(50),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "geofences_radius_meters_check" CHECK ("geofences"."radius_meters" between 25 and 50000)
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_code" varchar(10),
	"status_reason" varchar(100),
	"latitude" varchar(30),
	"longitude" varchar(30),
	"location_address" varchar(300),
	"odometer_miles" integer,
	"notes" text,
	"photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signature_url" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"driver_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid,
	"driver_id" uuid,
	"target_load_id" varchar(100),
	"target_po_number" varchar(100),
	"bol_number" varchar(100),
	"pro_number" varchar(100),
	"scac" varchar(10),
	"origin" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"destination" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"intermediate_stops" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"commodity" varchar(200),
	"weight_lbs" integer,
	"pallet_count" integer,
	"equipment_type" varchar(50),
	"special_instructions" text,
	"rate_cents" integer,
	"fuel_surcharge_cents" integer,
	"accessorials_cents" integer,
	"status" "shipment_status" DEFAULT 'tendered' NOT NULL,
	"status_code" varchar(10),
	"estimated_pickup_at" timestamp with time zone,
	"estimated_delivery_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"source" "shipment_source" DEFAULT 'manual' NOT NULL,
	"edi_raw" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_templates" ALTER COLUMN "send_mode" SET DEFAULT 'auto_send';--> statement-breakpoint
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edi_transactions" ADD CONSTRAINT "edi_transactions_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quick_add_backlog_email_unique" ON "quick_add_backlog" USING btree ("email");--> statement-breakpoint
CREATE INDEX "carriers_status_idx" ON "carriers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "driver_locations_driver_recorded_at_idx" ON "driver_locations" USING btree ("driver_id","recorded_at");--> statement-breakpoint
CREATE INDEX "driver_locations_shipment_recorded_at_idx" ON "driver_locations" USING btree ("shipment_id","recorded_at");--> statement-breakpoint
CREATE INDEX "drivers_carrier_status_idx" ON "drivers" USING btree ("carrier_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_carrier_license_unique" ON "drivers" USING btree ("carrier_id","license_number") WHERE "drivers"."license_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "edi_transactions_control_unique" ON "edi_transactions" USING btree ("direction","sender_id","control_number") WHERE "edi_transactions"."sender_id" is not null and "edi_transactions"."control_number" is not null;--> statement-breakpoint
CREATE INDEX "edi_transactions_status_created_at_idx" ON "edi_transactions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "edi_transactions_shipment_idx" ON "edi_transactions" USING btree ("shipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "geofences_target_store_id_unique" ON "geofences" USING btree ("target_store_id") WHERE "geofences"."target_store_id" is not null;--> statement-breakpoint
CREATE INDEX "shipment_events_shipment_recorded_at_idx" ON "shipment_events" USING btree ("shipment_id","recorded_at");--> statement-breakpoint
CREATE INDEX "shipment_events_driver_recorded_at_idx" ON "shipment_events" USING btree ("driver_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_target_load_id_unique" ON "shipments" USING btree ("target_load_id") WHERE "shipments"."target_load_id" is not null;--> statement-breakpoint
CREATE INDEX "shipments_status_created_at_idx" ON "shipments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "shipments_driver_status_idx" ON "shipments" USING btree ("driver_id","status");
