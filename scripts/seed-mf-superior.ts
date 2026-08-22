/**
 * scripts/seed-mf-superior.ts
 *
 * Seeds the first tenant: the MF Superior Products organization, its carrier
 * profile, and the initial admin invitation for info@mfsuperiorproducts.com.
 *
 * Every step is idempotent and refuses to overwrite an identifier it did not
 * create, so re-running is safe. Admins stay invitation-only: this script
 * mints an invitation, it never fabricates a membership.
 *
 * Usage (from the repository root):
 *   MF_SUPERIOR_SCAC=XXXX npx tsx scripts/seed-mf-superior.ts
 *
 * Flags:
 *   --rotate            revoke any redeemable admin invitation and mint a new one
 *   --ttl-days=<1-90>   invitation lifetime (default 14)
 *
 * The invitation token is printed exactly once, because only its SHA-256 hash
 * is stored. Deliver it over a channel the recipient controls, then have them
 * sign in and call POST /api/auth/sync with `{ "invitationToken": "..." }`.
 */

import { config } from "dotenv";
import { and, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  organizationInvitations,
  organizationMemberships,
  organizations,
  users,
} from "../src/lib/db/schema";
import { carriers } from "../src/lib/db/target-carrier-schema";
import {
  createInvitationSecret,
  DEFAULT_INVITATION_TTL_DAYS,
  invitationEmailSchema,
  invitationExpiresAt,
  MF_SUPERIOR_ADMIN_EMAIL,
  MF_SUPERIOR_ORGANIZATION,
  scacSchema,
} from "../src/lib/tenant/provisioning";

config({ path: ".env.local" });
config({ path: ".env" });

type Options = { rotate: boolean; ttlDays: number };

function parseOptions(argv: readonly string[]): Options {
  let rotate = false;
  let ttlDays = DEFAULT_INVITATION_TTL_DAYS;
  for (const argument of argv) {
    if (argument === "--rotate") {
      rotate = true;
      continue;
    }
    const ttlMatch = /^--ttl-days=(\d{1,3})$/.exec(argument);
    if (ttlMatch) {
      ttlDays = Number(ttlMatch[1]);
      continue;
    }
    throw new Error(`Unrecognized argument: ${argument}`);
  }
  return { rotate, ttlDays };
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Provision the database first, then re-run this script.",
    );
  }
  return databaseUrl;
}

function requireScac(): string {
  const parsed = scacSchema.safeParse(process.env.MF_SUPERIOR_SCAC ?? "");
  if (!parsed.success) {
    throw new Error(
      "MF_SUPERIOR_SCAC must be the real NMFTA-assigned Standard Carrier Alpha Code " +
        "(2-4 letters). It is stamped into EDI envelopes, so this script will not " +
        "invent a placeholder.",
    );
  }
  return parsed.data;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const databaseUrl = requireDatabaseUrl();
  const scac = requireScac();
  const adminEmail = invitationEmailSchema.parse(MF_SUPERIOR_ADMIN_EMAIL);
  const now = new Date();

  const queryClient = postgres(databaseUrl, { prepare: false, max: 1 });
  const db = drizzle(queryClient);

  try {
    const summary = await db.transaction(async (transaction) => {
      /* ── Organization ──────────────────────────────────────── */
      await transaction
        .insert(organizations)
        .values({
          slug: MF_SUPERIOR_ORGANIZATION.slug,
          name: MF_SUPERIOR_ORGANIZATION.name,
          status: "active",
        })
        .onConflictDoNothing({ target: organizations.slug });

      const [organization] = await transaction
        .select({
          id: organizations.id,
          name: organizations.name,
          status: organizations.status,
        })
        .from(organizations)
        .where(eq(organizations.slug, MF_SUPERIOR_ORGANIZATION.slug));
      if (!organization) {
        throw new Error(
          `Organization "${MF_SUPERIOR_ORGANIZATION.slug}" is missing immediately after upsert.`,
        );
      }
      if (organization.status !== "active") {
        throw new Error(
          `Organization "${MF_SUPERIOR_ORGANIZATION.slug}" exists with status "${organization.status}". ` +
            "Reactivate it deliberately before seeding; this script will not flip it.",
        );
      }

      /* ── Carrier profile ───────────────────────────────────── */
      await transaction
        .insert(carriers)
        .values({
          organizationId: organization.id,
          scac,
          name: MF_SUPERIOR_ORGANIZATION.name,
          status: "active",
        })
        .onConflictDoNothing();

      const [carrier] = await transaction
        .select({ id: carriers.id, scac: carriers.scac })
        .from(carriers)
        .where(eq(carriers.organizationId, organization.id));
      if (!carrier) {
        throw new Error(
          `A carrier already exists under SCAC "${scac}" for a different organization. ` +
            "Resolve the conflict before seeding.",
        );
      }
      if (carrier.scac !== scac) {
        throw new Error(
          `Organization "${MF_SUPERIOR_ORGANIZATION.slug}" already has carrier SCAC "${carrier.scac}", ` +
            `not "${scac}". This script will not rewrite an EDI identifier.`,
        );
      }

      /* ── Admin invitation ──────────────────────────────────── */
      const [existingAdmin] = await transaction
        .select({ membershipId: organizationMemberships.id })
        .from(organizationMemberships)
        .innerJoin(users, eq(users.id, organizationMemberships.userId))
        .where(
          and(
            eq(organizationMemberships.organizationId, organization.id),
            eq(organizationMemberships.role, "admin"),
            eq(organizationMemberships.status, "active"),
            sql`lower(${users.email}) = ${adminEmail}`,
          ),
        );
      if (existingAdmin && !options.rotate) {
        return {
          organizationId: organization.id,
          carrierId: carrier.id,
          invitation: null,
          note: `${adminEmail} already holds an active admin membership; no invitation minted.`,
        };
      }

      const redeemable = await transaction
        .select({ id: organizationInvitations.id })
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.organizationId, organization.id),
            eq(organizationInvitations.role, "admin"),
            sql`lower(${organizationInvitations.email}) = ${adminEmail}`,
            isNull(organizationInvitations.acceptedAt),
            isNull(organizationInvitations.revokedAt),
            sql`${organizationInvitations.expiresAt} > ${now}`,
          ),
        );

      if (redeemable.length > 0 && !options.rotate) {
        return {
          organizationId: organization.id,
          carrierId: carrier.id,
          invitation: null,
          note:
            `${redeemable.length} redeemable admin invitation(s) already exist for ${adminEmail}. ` +
            "Re-run with --rotate to revoke them and mint a replacement.",
        };
      }

      if (redeemable.length > 0) {
        await transaction
          .update(organizationInvitations)
          .set({ revokedAt: now })
          .where(
            and(
              eq(organizationInvitations.organizationId, organization.id),
              eq(organizationInvitations.role, "admin"),
              sql`lower(${organizationInvitations.email}) = ${adminEmail}`,
              isNull(organizationInvitations.acceptedAt),
              isNull(organizationInvitations.revokedAt),
            ),
          );
      }

      const secret = createInvitationSecret();
      const expiresAt = invitationExpiresAt(now, options.ttlDays);
      await transaction.insert(organizationInvitations).values({
        organizationId: organization.id,
        email: adminEmail,
        tokenHash: secret.tokenHash,
        role: "admin",
        expiresAt,
      });

      return {
        organizationId: organization.id,
        carrierId: carrier.id,
        invitation: { token: secret.token, expiresAt },
        note:
          redeemable.length > 0
            ? `Revoked ${redeemable.length} previous invitation(s).`
            : "First admin invitation minted.",
      };
    });

    console.log(`organization  ${MF_SUPERIOR_ORGANIZATION.slug} (${summary.organizationId})`);
    console.log(`carrier       ${scac} (${summary.carrierId})`);
    console.log(`note          ${summary.note}`);
    if (summary.invitation) {
      console.log("");
      console.log(`Admin invitation for ${adminEmail}`);
      console.log(`  expires  ${summary.invitation.expiresAt.toISOString()}`);
      console.log(`  token    ${summary.invitation.token}`);
      console.log("");
      console.log("Shown once — only its SHA-256 hash is stored. Redeem with:");
      console.log('  POST /api/auth/sync  { "invitationToken": "<token>" }');
    }
  } finally {
    await queryClient.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
