ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "partner_slug" varchar(64);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipments_partner_slug_idx" ON "shipments" USING btree ("partner_slug","created_at");
