-- Tenant backfill and validation constraints for operational rows.
--
-- `shipmentAccessPredicate` scopes every mobile read by carrier, which is only
-- a tenant boundary while each carrier belongs to exactly one organization and
-- no operational row can name a carrier, driver, or shipment from another one.
-- Until now that invariant was enforced only in application code. This
-- migration backfills the missing tenant links and then makes the invariant
-- structural.
--
-- Backfill policy: an orphan carrier is given its own SUSPENDED organization so
-- the row survives without silently granting anyone access. Orphan shipments
-- are NOT guessed — assigning freight to the wrong tenant is exactly the leak
-- these constraints exist to prevent, so the migration raises instead.

ALTER TABLE "customer_shipment_access" DROP CONSTRAINT "customer_shipment_access_shipment_id_shipments_id_fk";
--> statement-breakpoint
ALTER TABLE "shipment_external_references" DROP CONSTRAINT "shipment_external_references_shipment_id_shipments_id_fk";
--> statement-breakpoint
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_carrier_id_carriers_id_fk";
--> statement-breakpoint
DROP INDEX "carriers_organization_unique";
--> statement-breakpoint

-- 1. Give every orphan carrier its own suspended organization.
INSERT INTO "organizations" ("slug", "name", "status", "metadata")
SELECT
  'carrier-' || lower(regexp_replace("carriers"."scac", '[^a-zA-Z0-9]', '-', 'g'))
    || '-' || substr(replace("carriers"."id"::text, '-', ''), 1, 8),
  "carriers"."name",
  'suspended',
  jsonb_build_object(
    'backfill', '0010_tenant_backfill_constraints',
    'reason', 'orphan_carrier',
    'carrierId', "carriers"."id"
  )
FROM "carriers"
WHERE "carriers"."organization_id" IS NULL;
--> statement-breakpoint
UPDATE "carriers"
SET "organization_id" = "organizations"."id",
    "updated_at" = now()
FROM "organizations"
WHERE "carriers"."organization_id" IS NULL
  AND "organizations"."metadata" ->> 'carrierId' = "carriers"."id"::text
  AND "organizations"."metadata" ->> 'backfill' = '0010_tenant_backfill_constraints';
--> statement-breakpoint
ALTER TABLE "carriers" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint

-- 2. Uniqueness targets the composite foreign keys below depend on.
CREATE UNIQUE INDEX "carriers_organization_unique" ON "carriers" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_id_organization_unique" UNIQUE("id","organization_id");
--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_id_carrier_unique" UNIQUE("id","carrier_id");
--> statement-breakpoint

-- 3. Refuse to guess a tenant for freight that has none.
DO $$
DECLARE orphan_count bigint;
BEGIN
  SELECT count(*) INTO orphan_count FROM "shipments" WHERE "carrier_id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Cannot pin tenancy: % shipment(s) have no carrier_id. Assign each one to its owning carrier, then re-run this migration.',
      orphan_count
      USING ERRCODE = 'not_null_violation';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "carrier_id" SET NOT NULL;
--> statement-breakpoint

-- 4. Backfill the shipment tenant pin from the carrier that already owns it.
ALTER TABLE "shipments" ADD COLUMN "organization_id" uuid;
--> statement-breakpoint
UPDATE "shipments"
SET "organization_id" = "carriers"."organization_id"
FROM "carriers"
WHERE "carriers"."id" = "shipments"."carrier_id"
  AND "shipments"."organization_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "shipments" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_id_organization_unique" UNIQUE("id","organization_id");
--> statement-breakpoint

-- 5. Surface cross-carrier driver assignments with an actionable message
--    before the foreign key reports them as an anonymous violation.
DO $$
DECLARE crossed_count bigint;
BEGIN
  SELECT count(*) INTO crossed_count
  FROM "shipments"
  JOIN "drivers" ON "drivers"."id" = "shipments"."driver_id"
  WHERE "drivers"."carrier_id" <> "shipments"."carrier_id";
  IF crossed_count > 0 THEN
    RAISE EXCEPTION
      'Cannot pin tenancy: % shipment(s) name a driver belonging to a different carrier. Clear or reassign driver_id, then re-run this migration.',
      crossed_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;
END $$;
--> statement-breakpoint

-- 6. Make every cross-tenant operational row structurally impossible.
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_organization_fk" FOREIGN KEY ("carrier_id","organization_id") REFERENCES "public"."carriers"("id","organization_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_driver_carrier_fk" FOREIGN KEY ("driver_id","carrier_id") REFERENCES "public"."drivers"("id","carrier_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_shipment_access" ADD CONSTRAINT "customer_shipment_access_shipment_organization_fk" FOREIGN KEY ("shipment_id","organization_id") REFERENCES "public"."shipments"("id","organization_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "freight_documents" ADD CONSTRAINT "freight_documents_shipment_organization_fk" FOREIGN KEY ("shipment_id","organization_id") REFERENCES "public"."shipments"("id","organization_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shipment_external_references" ADD CONSTRAINT "shipment_external_references_shipment_organization_fk" FOREIGN KEY ("shipment_id","organization_id") REFERENCES "public"."shipments"("id","organization_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "shipments_org_status_idx" ON "shipments" USING btree ("organization_id","status");
