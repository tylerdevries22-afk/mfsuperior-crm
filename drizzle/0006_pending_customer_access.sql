CREATE TYPE "public"."customer_access_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."membership_status" ADD VALUE 'pending' BEFORE 'active';--> statement-breakpoint
CREATE TABLE "customer_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"status" "customer_access_request_status" DEFAULT 'pending' NOT NULL,
	"requested_company_name" varchar(200),
	"linked_customer_account_id" uuid,
	"reviewed_by_user_id" uuid,
	"review_notes" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_access_requests" ADD CONSTRAINT "customer_access_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_access_requests" ADD CONSTRAINT "customer_access_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_access_requests" ADD CONSTRAINT "customer_access_requests_membership_id_organization_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organization_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_access_requests" ADD CONSTRAINT "customer_access_requests_linked_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("linked_customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_access_requests" ADD CONSTRAINT "customer_access_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_access_requests_org_user_unique" ON "customer_access_requests" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_access_requests_membership_unique" ON "customer_access_requests" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "customer_access_requests_org_status_idx" ON "customer_access_requests" USING btree ("organization_id","status","requested_at");