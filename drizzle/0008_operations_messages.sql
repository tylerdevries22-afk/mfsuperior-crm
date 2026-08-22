CREATE TYPE "public"."operations_message_thread_kind" AS ENUM('shipment', 'dispatch', 'support');--> statement-breakpoint
CREATE TABLE "operations_message_reads" (
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operations_message_reads_message_id_user_id_pk" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "operations_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"thread_key" varchar(120) NOT NULL,
	"thread_kind" "operations_message_thread_kind" NOT NULL,
	"shipment_id" uuid,
	"sender_user_id" uuid NOT NULL,
	"recipient_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operations_message_reads" ADD CONSTRAINT "operations_message_reads_message_id_operations_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."operations_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_message_reads" ADD CONSTRAINT "operations_message_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_messages" ADD CONSTRAINT "operations_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_messages" ADD CONSTRAINT "operations_messages_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_messages" ADD CONSTRAINT "operations_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operations_message_reads_user_idx" ON "operations_message_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "operations_messages_org_thread_sent_idx" ON "operations_messages" USING btree ("organization_id","thread_key","sent_at");--> statement-breakpoint
CREATE INDEX "operations_messages_org_sent_idx" ON "operations_messages" USING btree ("organization_id","sent_at");--> statement-breakpoint
CREATE INDEX "operations_messages_shipment_sent_idx" ON "operations_messages" USING btree ("shipment_id","sent_at");