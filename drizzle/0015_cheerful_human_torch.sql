CREATE TABLE "mobile_push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"expo_push_token" varchar(255) NOT NULL,
	"platform" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_transfer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"carrier_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"from_driver_id" uuid,
	"target_driver_id" uuid NOT NULL,
	"target_auth_subject" text NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"vehicle_unit_number" varchar(40) NOT NULL,
	"from_driver_name" varchar(200),
	"target_driver_name" varchar(200) NOT NULL,
	"note" varchar(1000) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "thumbnail_path" text;--> statement-breakpoint
ALTER TABLE "mobile_push_tokens" ADD CONSTRAINT "mobile_push_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_push_tokens" ADD CONSTRAINT "mobile_push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transfer_events" ADD CONSTRAINT "vehicle_transfer_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transfer_events" ADD CONSTRAINT "vehicle_transfer_events_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transfer_events" ADD CONSTRAINT "vehicle_transfer_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transfer_events" ADD CONSTRAINT "vehicle_transfer_events_from_driver_id_drivers_id_fk" FOREIGN KEY ("from_driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transfer_events" ADD CONSTRAINT "vehicle_transfer_events_target_driver_id_drivers_id_fk" FOREIGN KEY ("target_driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transfer_events" ADD CONSTRAINT "vehicle_transfer_events_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_push_tokens_user_token_unique" ON "mobile_push_tokens" USING btree ("organization_id","user_id","expo_push_token");--> statement-breakpoint
CREATE INDEX "mobile_push_tokens_user_idx" ON "mobile_push_tokens" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "vehicle_transfer_events_target_created_idx" ON "vehicle_transfer_events" USING btree ("target_driver_id","created_at");--> statement-breakpoint
CREATE INDEX "vehicle_transfer_events_org_created_idx" ON "vehicle_transfer_events" USING btree ("organization_id","created_at");