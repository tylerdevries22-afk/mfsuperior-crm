import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import {
  customerShipmentAccess,
  freightDocuments,
} from "@/lib/db/schema";
import {
  carriers,
  drivers,
  shipmentExternalReferences,
  shipments,
} from "@/lib/db/target-carrier-schema";
import {
  createInvitationSecret,
  invitationEmailSchema,
  invitationExpiresAt,
  invitationIsRedeemable,
  invitationTokenMatches,
  MF_SUPERIOR_ADMIN_EMAIL,
  MF_SUPERIOR_ORGANIZATION,
  organizationSlugSchema,
  scacSchema,
} from "@/lib/tenant/provisioning";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function notNull(table: PgTable, column: string): boolean {
  const found = getTableConfig(table).columns.find((c) => c.name === column);
  if (!found) throw new Error(`Column ${column} is missing.`);
  return found.notNull;
}

function foreignKeyColumns(
  table: PgTable,
  name: string,
): { columns: string[]; foreignColumns: string[]; onDelete?: string } {
  const found = getTableConfig(table).foreignKeys.find(
    (fk) => fk.getName() === name,
  );
  if (!found) throw new Error(`Foreign key ${name} is missing.`);
  const reference = found.reference();
  return {
    columns: reference.columns.map((c) => c.name),
    foreignColumns: reference.foreignColumns.map((c) => c.name),
    onDelete: found.onDelete,
  };
}

function uniqueConstraintNames(table: PgTable): string[] {
  return getTableConfig(table)
    .uniqueConstraints.map((u) => u.name)
    .filter((name): name is string => typeof name === "string");
}

describe("first-tenant provisioning contract", () => {
  it("hashes invitation tokens exactly the way the auth sync route does", () => {
    const secret = createInvitationSecret();
    // POST /api/auth/sync looks the invitation up by this digest; any drift
    // here mints invitations that can never be redeemed.
    expect(secret.tokenHash).toBe(
      createHash("sha256").update(secret.token).digest("hex"),
    );
    expect(secret.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(invitationTokenMatches(secret.token, secret.tokenHash)).toBe(true);
    expect(invitationTokenMatches(`${secret.token}x`, secret.tokenHash)).toBe(
      false,
    );
    expect(invitationTokenMatches(secret.token, "short")).toBe(false);
  });

  it("mints distinct tokens inside the sync body length bounds", () => {
    const first = createInvitationSecret();
    const second = createInvitationSecret();
    expect(first.token).not.toBe(second.token);
    // `syncBodySchema` accepts 32-512 characters.
    for (const { token } of [first, second]) {
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(token.length).toBeLessThanOrEqual(512);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("bounds the invitation lifetime and rejects nonsense TTLs", () => {
    const now = new Date("2026-08-21T00:00:00.000Z");
    expect(invitationExpiresAt(now, 14).toISOString()).toBe(
      "2026-09-04T00:00:00.000Z",
    );
    expect(invitationExpiresAt(now).toISOString()).toBe(
      "2026-09-04T00:00:00.000Z",
    );
    expect(invitationExpiresAt(now, 1).getTime()).toBeGreaterThan(now.getTime());
    expect(() => invitationExpiresAt(now, 0)).toThrow(RangeError);
    expect(() => invitationExpiresAt(now, 91)).toThrow(RangeError);
    expect(() => invitationExpiresAt(now, 1.5)).toThrow(RangeError);
  });

  it("treats accepted, revoked, and expired invitations as spent", () => {
    const now = new Date("2026-08-21T00:00:00.000Z");
    const live = {
      expiresAt: new Date("2026-09-04T00:00:00.000Z"),
      acceptedAt: null,
      revokedAt: null,
    };
    expect(invitationIsRedeemable(live, now)).toBe(true);
    expect(invitationIsRedeemable({ ...live, acceptedAt: now }, now)).toBe(false);
    expect(invitationIsRedeemable({ ...live, revokedAt: now }, now)).toBe(false);
    expect(
      invitationIsRedeemable({ ...live, expiresAt: new Date(now) }, now),
    ).toBe(false);
  });

  it("seeds the organization that customer self-registration falls back to", () => {
    // src/lib/env.ts defaults CUSTOMER_SELF_REGISTRATION_ORGANIZATION_SLUG to
    // this slug, so seeding a different one would strand every self-registered
    // customer in a tenant that does not exist.
    expect(MF_SUPERIOR_ORGANIZATION.slug).toBe("mf-superior");
    expect(organizationSlugSchema.safeParse(MF_SUPERIOR_ORGANIZATION.slug).success).toBe(
      true,
    );
    expect(organizationSlugSchema.safeParse("MF-Superior").success).toBe(false);
    expect(organizationSlugSchema.safeParse("-mf").success).toBe(false);
  });

  it("normalizes the admin email to the lowercase form the route compares", () => {
    expect(MF_SUPERIOR_ADMIN_EMAIL).toBe("info@mfsuperiorproducts.com");
    expect(invitationEmailSchema.parse("  INFO@MFSuperiorProducts.com ")).toBe(
      MF_SUPERIOR_ADMIN_EMAIL,
    );
    expect(invitationEmailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("only accepts a well-formed Standard Carrier Alpha Code", () => {
    expect(scacSchema.parse("mfsp")).toBe("MFSP");
    expect(scacSchema.parse(" MF ")).toBe("MF");
    expect(scacSchema.safeParse("M").success).toBe(false);
    expect(scacSchema.safeParse("TOOLONG").success).toBe(false);
    expect(scacSchema.safeParse("MF1").success).toBe(false);
  });
});

describe("operational tenant boundary", () => {
  it("pins every carrier and shipment to a non-null organization", () => {
    expect(notNull(carriers, "organization_id")).toBe(true);
    expect(notNull(shipments, "organization_id")).toBe(true);
    // shipmentAccessPredicate scopes reads by carrier alone, so a shipment
    // without a carrier would sit outside every tenant.
    expect(notNull(shipments, "carrier_id")).toBe(true);
  });

  it("makes a shipment structurally unable to name another tenant's carrier", () => {
    expect(uniqueConstraintNames(carriers)).toContain(
      "carriers_id_organization_unique",
    );
    expect(foreignKeyColumns(shipments, "shipments_carrier_organization_fk")).toEqual({
      columns: ["carrier_id", "organization_id"],
      foreignColumns: ["id", "organization_id"],
      onDelete: "restrict",
    });
  });

  it("makes a shipment structurally unable to name another carrier's driver", () => {
    expect(uniqueConstraintNames(drivers)).toContain("drivers_id_carrier_unique");
    expect(foreignKeyColumns(shipments, "shipments_driver_carrier_fk")).toEqual({
      columns: ["driver_id", "carrier_id"],
      foreignColumns: ["id", "carrier_id"],
      // MATCH SIMPLE: the single-column ON DELETE SET NULL key nulls driver_id
      // first, which satisfies this key instead of blocking the delete.
      onDelete: "no action",
    });
    expect(
      foreignKeyColumns(shipments, "shipments_driver_id_drivers_id_fk").onDelete,
    ).toBe("set null");
  });

  it("scopes every shipment-linked child row to the shipment's own organization", () => {
    expect(uniqueConstraintNames(shipments)).toContain(
      "shipments_id_organization_unique",
    );
    for (const [table, name] of [
      [customerShipmentAccess, "customer_shipment_access_shipment_organization_fk"],
      [freightDocuments, "freight_documents_shipment_organization_fk"],
      [
        shipmentExternalReferences,
        "shipment_external_references_shipment_organization_fk",
      ],
    ] as const) {
      const key = foreignKeyColumns(table, name);
      expect(key.columns).toEqual(["shipment_id", "organization_id"]);
      expect(key.foreignColumns).toEqual(["id", "organization_id"]);
    }
    // A composite SET NULL would try to null the non-nullable organization pin.
    expect(
      foreignKeyColumns(
        freightDocuments,
        "freight_documents_shipment_organization_fk",
      ).onDelete,
    ).toBe("no action");
  });
});

describe("migration 0010 backfill ordering", () => {
  const sql = readFileSync(
    path.join(repositoryRoot, "drizzle/0010_tenant_backfill_constraints.sql"),
    "utf8",
  );
  const at = (needle: string): number => {
    const index = sql.indexOf(needle);
    expect(index, `migration is missing: ${needle}`).toBeGreaterThan(-1);
    return index;
  };

  it("backfills orphan carriers before demanding a non-null organization", () => {
    expect(at('INSERT INTO "organizations"')).toBeLessThan(
      at('ALTER TABLE "carriers" ALTER COLUMN "organization_id" SET NOT NULL'),
    );
    // The backfilled tenant must not be usable until an operator says so:
    // loadInvitation and loadMembershipCandidates both require status 'active'.
    expect(sql).toContain("'suspended'");
  });

  it("adds the shipment tenant pin nullable, backfills it, then locks it", () => {
    expect(at('ADD COLUMN "organization_id" uuid;')).toBeLessThan(
      at('UPDATE "shipments"'),
    );
    expect(at('UPDATE "shipments"')).toBeLessThan(
      at('ALTER TABLE "shipments" ALTER COLUMN "organization_id" SET NOT NULL'),
    );
  });

  it("refuses to guess a tenant for freight that has none", () => {
    expect(sql).toContain("RAISE EXCEPTION");
    expect(sql).toContain('WHERE "carrier_id" IS NULL');
    expect(at('WHERE "carrier_id" IS NULL')).toBeLessThan(
      at('ALTER TABLE "shipments" ALTER COLUMN "carrier_id" SET NOT NULL'),
    );
  });

  it("creates each unique target before the foreign key that references it", () => {
    expect(at('"carriers_id_organization_unique" UNIQUE')).toBeLessThan(
      at('ADD CONSTRAINT "shipments_carrier_organization_fk"'),
    );
    expect(at('"drivers_id_carrier_unique" UNIQUE')).toBeLessThan(
      at('ADD CONSTRAINT "shipments_driver_carrier_fk"'),
    );
    const shipmentUnique = at('"shipments_id_organization_unique" UNIQUE');
    for (const child of [
      'ADD CONSTRAINT "customer_shipment_access_shipment_organization_fk"',
      'ADD CONSTRAINT "freight_documents_shipment_organization_fk"',
      'ADD CONSTRAINT "shipment_external_references_shipment_organization_fk"',
    ]) {
      expect(shipmentUnique).toBeLessThan(at(child));
    }
  });
});
