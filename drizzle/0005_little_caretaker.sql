ALTER TYPE "public"."shipment_source" ADD VALUE 'demo' BEFORE 'simulated';--> statement-breakpoint
ALTER TYPE "public"."shipment_source" ADD VALUE 'api';--> statement-breakpoint
CREATE TABLE "shipment_external_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"provider" varchar(80) NOT NULL,
	"reference_type" varchar(80) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "shipments_target_load_id_unique";--> statement-breakpoint
ALTER TABLE "shipment_external_references" ADD CONSTRAINT "shipment_external_references_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_external_references" ADD CONSTRAINT "shipment_external_references_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_external_references_provider_unique" ON "shipment_external_references" USING btree ("organization_id","provider","reference_type","external_id");--> statement-breakpoint
CREATE INDEX "shipment_external_references_shipment_idx" ON "shipment_external_references" USING btree ("organization_id","shipment_id");