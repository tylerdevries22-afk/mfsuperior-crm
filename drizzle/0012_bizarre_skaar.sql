CREATE TYPE "public"."availability_kind" AS ENUM('available', 'unavailable', 'time_off', 'preferred');--> statement-breakpoint
CREATE TYPE "public"."compliance_kind" AS ENUM('registration', 'ifta', 'annual_inspection', 'insurance', 'cdl', 'medical_card', 'hazmat_endorsement');--> statement-breakpoint
CREATE TYPE "public"."compliance_subject" AS ENUM('vehicle', 'driver');--> statement-breakpoint
CREATE TYPE "public"."maintenance_kind" AS ENUM('repair', 'preventive', 'inspection');--> statement-breakpoint
CREATE TYPE "public"."maintenance_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('open', 'scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payout_line_item_kind" AS ENUM('linehaul', 'accessorial', 'detention', 'fuel', 'advance', 'deduction');--> statement-breakpoint
CREATE TYPE "public"."payout_rail" AS ENUM('apple_cash', 'venmo', 'cash_app', 'zelle');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('active', 'in_shop', 'out_of_service', 'retired');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('tractor', 'trailer');--> statement-breakpoint
CREATE TABLE "compliance_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"subject_type" "compliance_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"kind" "compliance_kind" NOT NULL,
	"identifier" varchar(120) NOT NULL,
	"issuing_state" varchar(10) NOT NULL,
	"issued_on" timestamp with time zone NOT NULL,
	"expires_on" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_documents_window_check" CHECK ("compliance_documents"."expires_on" > "compliance_documents"."issued_on")
);
--> statement-breakpoint
CREATE TABLE "driver_availability_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"kind" "availability_kind" NOT NULL,
	"note" text,
	"rule_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_availability_blocks_span_check" CHECK ("driver_availability_blocks"."ends_at" > "driver_availability_blocks"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "driver_availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"kind" "availability_kind" NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_availability_rules_weekday_check" CHECK ("driver_availability_rules"."weekday" between 0 and 6),
	CONSTRAINT "driver_availability_rules_span_check" CHECK ("driver_availability_rules"."start_minute" >= 0 and "driver_availability_rules"."end_minute" <= 1440 and "driver_availability_rules"."end_minute" > "driver_availability_rules"."start_minute")
);
--> statement-breakpoint
CREATE TABLE "driver_payout_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"payout_id" uuid NOT NULL,
	"shipment_id" uuid,
	"kind" "payout_line_item_kind" NOT NULL,
	"description" varchar(300) NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_payout_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"rail" "payout_rail" NOT NULL,
	"handle" varchar(200) NOT NULL,
	"label" varchar(80),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"gross_cents" integer NOT NULL,
	"deduction_cents" integer DEFAULT 0 NOT NULL,
	"net_cents" integer NOT NULL,
	"rail" "payout_rail",
	"issued_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_payouts_id_carrier_unique" UNIQUE("id","carrier_id"),
	CONSTRAINT "driver_payouts_period_check" CHECK ("driver_payouts"."period_end" > "driver_payouts"."period_start"),
	CONSTRAINT "driver_payouts_net_check" CHECK ("driver_payouts"."net_cents" = "driver_payouts"."gross_cents" - "driver_payouts"."deduction_cents")
);
--> statement-breakpoint
CREATE TABLE "maintenance_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"kind" "maintenance_kind" NOT NULL,
	"status" "maintenance_status" DEFAULT 'open' NOT NULL,
	"severity" "maintenance_severity" DEFAULT 'medium' NOT NULL,
	"summary" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduled_for" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"odometer_miles" integer,
	"vendor_name" varchar(200),
	"cost_cents" integer,
	"reported_by_driver_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_orders_cost_check" CHECK ("maintenance_orders"."cost_cents" is null or "maintenance_orders"."cost_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"unit_number" varchar(40) NOT NULL,
	"type" "vehicle_type" NOT NULL,
	"vin" varchar(17) NOT NULL,
	"make" varchar(60) NOT NULL,
	"model" varchar(80) NOT NULL,
	"year" integer NOT NULL,
	"plate_number" varchar(20) NOT NULL,
	"plate_state" varchar(10) NOT NULL,
	"status" "vehicle_status" DEFAULT 'active' NOT NULL,
	"odometer_miles" integer DEFAULT 0 NOT NULL,
	"assigned_driver_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_id_carrier_unique" UNIQUE("id","carrier_id"),
	CONSTRAINT "vehicles_year_check" CHECK ("vehicles"."year" between 1950 and 2100),
	CONSTRAINT "vehicles_odometer_check" CHECK ("vehicles"."odometer_miles" >= 0)
);
--> statement-breakpoint
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_availability_blocks" ADD CONSTRAINT "driver_availability_blocks_driver_carrier_fk" FOREIGN KEY ("driver_id","carrier_id") REFERENCES "public"."drivers"("id","carrier_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_availability_rules" ADD CONSTRAINT "driver_availability_rules_driver_carrier_fk" FOREIGN KEY ("driver_id","carrier_id") REFERENCES "public"."drivers"("id","carrier_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_payout_line_items" ADD CONSTRAINT "driver_payout_line_items_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_payout_line_items" ADD CONSTRAINT "driver_payout_line_items_payout_carrier_fk" FOREIGN KEY ("payout_id","carrier_id") REFERENCES "public"."driver_payouts"("id","carrier_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_payout_methods" ADD CONSTRAINT "driver_payout_methods_driver_carrier_fk" FOREIGN KEY ("driver_id","carrier_id") REFERENCES "public"."drivers"("id","carrier_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_payouts" ADD CONSTRAINT "driver_payouts_driver_carrier_fk" FOREIGN KEY ("driver_id","carrier_id") REFERENCES "public"."drivers"("id","carrier_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_orders" ADD CONSTRAINT "maintenance_orders_reported_by_driver_id_drivers_id_fk" FOREIGN KEY ("reported_by_driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_orders" ADD CONSTRAINT "maintenance_orders_vehicle_carrier_fk" FOREIGN KEY ("vehicle_id","carrier_id") REFERENCES "public"."vehicles"("id","carrier_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_assigned_driver_id_drivers_id_fk" FOREIGN KEY ("assigned_driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_carrier_fk" FOREIGN KEY ("assigned_driver_id","carrier_id") REFERENCES "public"."drivers"("id","carrier_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compliance_documents_carrier_expires_on_idx" ON "compliance_documents" USING btree ("carrier_id","expires_on");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_documents_subject_kind_unique" ON "compliance_documents" USING btree ("carrier_id","subject_type","subject_id","kind");--> statement-breakpoint
CREATE INDEX "driver_availability_blocks_driver_starts_at_idx" ON "driver_availability_blocks" USING btree ("driver_id","starts_at");--> statement-breakpoint
CREATE INDEX "driver_availability_blocks_carrier_starts_at_idx" ON "driver_availability_blocks" USING btree ("carrier_id","starts_at");--> statement-breakpoint
CREATE INDEX "driver_availability_rules_driver_weekday_idx" ON "driver_availability_rules" USING btree ("driver_id","weekday");--> statement-breakpoint
CREATE INDEX "driver_payout_line_items_payout_idx" ON "driver_payout_line_items" USING btree ("payout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_payout_methods_driver_rail_unique" ON "driver_payout_methods" USING btree ("driver_id","rail");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_payout_methods_driver_default_unique" ON "driver_payout_methods" USING btree ("driver_id") WHERE "driver_payout_methods"."is_default";--> statement-breakpoint
CREATE INDEX "driver_payouts_driver_period_end_idx" ON "driver_payouts" USING btree ("driver_id","period_end");--> statement-breakpoint
CREATE INDEX "driver_payouts_carrier_status_idx" ON "driver_payouts" USING btree ("carrier_id","status");--> statement-breakpoint
CREATE INDEX "maintenance_orders_vehicle_opened_at_idx" ON "maintenance_orders" USING btree ("vehicle_id","opened_at");--> statement-breakpoint
CREATE INDEX "maintenance_orders_carrier_status_idx" ON "maintenance_orders" USING btree ("carrier_id","status");--> statement-breakpoint
CREATE INDEX "vehicles_carrier_status_idx" ON "vehicles" USING btree ("carrier_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_carrier_unit_unique" ON "vehicles" USING btree ("carrier_id","unit_number");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_carrier_vin_unique" ON "vehicles" USING btree ("carrier_id","vin");