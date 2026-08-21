CREATE TYPE "public"."app_role" AS ENUM('admin', 'driver', 'customer');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending_upload', 'uploaded', 'verified', 'rejected', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."freight_request_status" AS ENUM('draft', 'submitted', 'reviewing', 'quoted', 'booked', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('not_configured', 'connected', 'degraded', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('invited', 'active', 'suspended', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TABLE "api_rate_limit_buckets" (
	"key_hash" varchar(64) NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "api_rate_limit_buckets_key_hash_window_started_at_pk" PRIMARY KEY("key_hash","window_started_at"),
	CONSTRAINT "api_rate_limit_buckets_count_check" CHECK ("api_rate_limit_buckets"."request_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "customer_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_name" varchar(200) NOT NULL,
	"contact_email" text,
	"contact_phone" varchar(50),
	"external_reference" varchar(120),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_shipment_access" (
	"organization_id" uuid NOT NULL,
	"customer_account_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_shipment_access_customer_account_id_shipment_id_pk" PRIMARY KEY("customer_account_id","shipment_id")
);
--> statement-breakpoint
CREATE TABLE "document_upload_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freight_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"shipment_id" uuid,
	"request_id" uuid,
	"uploaded_by_user_id" uuid,
	"kind" varchar(50) NOT NULL,
	"status" "document_status" DEFAULT 'pending_upload' NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"content_type" varchar(120) NOT NULL,
	"byte_size" integer NOT NULL,
	"storage_bucket" varchar(100) NOT NULL,
	"storage_path" text NOT NULL,
	"checksum_sha256" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freight_documents_storage_path_unique" UNIQUE("storage_path"),
	CONSTRAINT "freight_documents_byte_size_check" CHECK ("freight_documents"."byte_size" between 1 and 20971520)
);
--> statement-breakpoint
CREATE TABLE "freight_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_reference" varchar(120),
	"name" varchar(200) NOT NULL,
	"kind" varchar(40) DEFAULT 'other' NOT NULL,
	"address_line_1" varchar(200) NOT NULL,
	"address_line_2" varchar(200),
	"city" varchar(100) NOT NULL,
	"state" varchar(50) NOT NULL,
	"postal_code" varchar(20) NOT NULL,
	"country_code" varchar(2) DEFAULT 'US' NOT NULL,
	"latitude" varchar(30),
	"longitude" varchar(30),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freight_locations_kind_check" CHECK ("freight_locations"."kind" in ('pickup', 'delivery', 'terminal', 'customer', 'other'))
);
--> statement-breakpoint
CREATE TABLE "freight_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_account_id" uuid,
	"created_by_user_id" uuid,
	"shipment_id" uuid,
	"reference_number" varchar(120),
	"status" "freight_request_status" DEFAULT 'submitted' NOT NULL,
	"origin" jsonb NOT NULL,
	"destination" jsonb NOT NULL,
	"pickup_window_start" timestamp with time zone,
	"pickup_window_end" timestamp with time zone,
	"delivery_window_start" timestamp with time zone,
	"delivery_window_end" timestamp with time zone,
	"commodity" varchar(200),
	"weight_lbs" integer,
	"pallet_count" integer,
	"equipment_type" varchar(50),
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freight_requests_weight_check" CHECK ("freight_requests"."weight_lbs" is null or "freight_requests"."weight_lbs" between 0 and 200000),
	CONSTRAINT "freight_requests_pallet_check" CHECK ("freight_requests"."pallet_count" is null or "freight_requests"."pallet_count" between 0 and 1000)
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" varchar(80) NOT NULL,
	"status" "integration_status" DEFAULT 'not_configured' NOT NULL,
	"external_account_id" varchar(200),
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_succeeded_at" timestamp with time zone,
	"last_failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_mutation_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"operation" varchar(80) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_sync_states" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" varchar(120) NOT NULL,
	"cursor" text,
	"last_synced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_sync_states_organization_id_user_id_device_id_pk" PRIMARY KEY("organization_id","user_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" varchar(80) NOT NULL,
	"external_account_id" varchar(200),
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"encryption_key_version" varchar(40) NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"role" "app_role" NOT NULL,
	"driver_id" uuid,
	"customer_account_id" uuid,
	"invited_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "app_role" NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"driver_id" uuid,
	"customer_account_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"topic" varchar(120) NOT NULL,
	"aggregate_type" varchar(80) NOT NULL,
	"aggregate_id" text NOT NULL,
	"deduplication_key" varchar(160) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error_code" varchar(80),
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"status" "organization_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_subject" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider" varchar(40);--> statement-breakpoint
ALTER TABLE "carriers" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_shipment_access" ADD CONSTRAINT "customer_shipment_access_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_shipment_access" ADD CONSTRAINT "customer_shipment_access_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_shipment_access" ADD CONSTRAINT "customer_shipment_access_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_upload_intents" ADD CONSTRAINT "document_upload_intents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_upload_intents" ADD CONSTRAINT "document_upload_intents_document_id_freight_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."freight_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_upload_intents" ADD CONSTRAINT "document_upload_intents_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_documents" ADD CONSTRAINT "freight_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_documents" ADD CONSTRAINT "freight_documents_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_documents" ADD CONSTRAINT "freight_documents_request_id_freight_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."freight_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_documents" ADD CONSTRAINT "freight_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_locations" ADD CONSTRAINT "freight_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_requests" ADD CONSTRAINT "freight_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_requests" ADD CONSTRAINT "freight_requests_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_requests" ADD CONSTRAINT "freight_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_requests" ADD CONSTRAINT "freight_requests_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_mutation_receipts" ADD CONSTRAINT "mobile_mutation_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_mutation_receipts" ADD CONSTRAINT "mobile_mutation_receipts_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_sync_states" ADD CONSTRAINT "mobile_sync_states_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_sync_states" ADD CONSTRAINT "mobile_sync_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_rate_limit_buckets_expires_idx" ON "api_rate_limit_buckets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "customer_accounts_org_idx" ON "customer_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_accounts_org_external_unique" ON "customer_accounts" USING btree ("organization_id","external_reference") WHERE "customer_accounts"."external_reference" is not null;--> statement-breakpoint
CREATE INDEX "customer_shipment_access_org_idx" ON "customer_shipment_access" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_upload_intents_actor_key_unique" ON "document_upload_intents" USING btree ("organization_id","actor_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "freight_documents_org_created_idx" ON "freight_documents" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "freight_documents_shipment_idx" ON "freight_documents" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "freight_locations_org_name_idx" ON "freight_locations" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "freight_locations_org_external_unique" ON "freight_locations" USING btree ("organization_id","external_reference") WHERE "freight_locations"."external_reference" is not null;--> statement-breakpoint
CREATE INDEX "freight_requests_org_status_created_idx" ON "freight_requests" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "freight_requests_customer_created_idx" ON "freight_requests" USING btree ("customer_account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "freight_requests_org_reference_unique" ON "freight_requests" USING btree ("organization_id","reference_number") WHERE "freight_requests"."reference_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connections_org_provider_unique" ON "integration_connections" USING btree ("organization_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_mutation_receipts_actor_key_unique" ON "mobile_mutation_receipts" USING btree ("organization_id","actor_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "mobile_mutation_receipts_created_idx" ON "mobile_mutation_receipts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_connections_org_provider_unique" ON "oauth_connections" USING btree ("organization_id","provider");--> statement-breakpoint
CREATE INDEX "organization_invitations_org_email_idx" ON "organization_invitations" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_org_user_unique" ON "organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_status_idx" ON "organization_memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_default_user_unique" ON "organization_memberships" USING btree ("user_id") WHERE "organization_memberships"."is_default" = true and "organization_memberships"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_events_org_dedup_unique" ON "outbox_events" USING btree ("organization_id","deduplication_key");--> statement-breakpoint
CREATE INDEX "outbox_events_status_next_attempt_idx" ON "outbox_events" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "organizations_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "carriers_organization_unique" ON "carriers" USING btree ("organization_id") WHERE "carriers"."organization_id" is not null;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth_subject_unique" UNIQUE("auth_subject");