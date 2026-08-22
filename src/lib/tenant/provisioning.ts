import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * First-tenant provisioning contract.
 *
 * `POST /api/auth/sync` is the only code path that turns an invitation into a
 * membership, so anything written here has to match that route exactly: the
 * same slug grammar, the same lowercase email comparison, and the same
 * SHA-256 token hash. The helpers below are pure so both the seeding script
 * and the tests can exercise them without a database.
 */

/** Mirrors the grammar `organizations.slug` is validated against everywhere. */
export const organizationSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/);

/**
 * Standard Carrier Alpha Code. The NMFTA assigns two-to-four letters; the
 * column is wider, but accepting anything wider here would put an invalid
 * identifier into EDI envelopes.
 */
export const scacSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2,4}$/);

export const invitationEmailSchema = z.string().trim().toLowerCase().email();

/**
 * The default tenant. `CUSTOMER_SELF_REGISTRATION_ORGANIZATION_SLUG` falls back
 * to this same slug, so customer self-registration lands in the organization
 * seeded here rather than in a tenant that does not exist yet.
 */
export const MF_SUPERIOR_ORGANIZATION = {
  slug: "mf-superior",
  name: "MF Superior Products",
} as const;

/** The first human who can approve anyone else. */
export const MF_SUPERIOR_ADMIN_EMAIL = "info@mfsuperiorproducts.com";

/** Long enough for `syncBodySchema`, which requires 32-512 characters. */
const INVITATION_TOKEN_BYTES = 32;

export const DEFAULT_INVITATION_TTL_DAYS = 14;

export type InvitationSecret = {
  /** Shown to the operator once; never stored. */
  readonly token: string;
  /** Stored in `organization_invitations.token_hash`. */
  readonly tokenHash: string;
};

/**
 * Must stay byte-identical to `invitationHash` in the auth sync route — a
 * different digest here would mint invitations that can never be redeemed.
 */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createInvitationSecret(): InvitationSecret {
  const token = randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

/** Constant-time compare so verification never leaks the hash by timing. */
export function invitationTokenMatches(token: string, tokenHash: string): boolean {
  const candidate = Buffer.from(hashInvitationToken(token), "utf8");
  const expected = Buffer.from(tokenHash, "utf8");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function invitationExpiresAt(
  now: Date,
  ttlDays: number = DEFAULT_INVITATION_TTL_DAYS,
): Date {
  if (!Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 90) {
    throw new RangeError(
      `Invitation TTL must be a whole number of days between 1 and 90, received ${ttlDays}.`,
    );
  }
  return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
}

/**
 * An invitation is redeemable only while it is unaccepted, unrevoked, and
 * unexpired — the same three conditions `loadInvitation` filters on.
 */
export function invitationIsRedeemable(
  invitation: {
    expiresAt: Date;
    acceptedAt: Date | null;
    revokedAt: Date | null;
  },
  now: Date,
): boolean {
  if (invitation.acceptedAt !== null) return false;
  if (invitation.revokedAt !== null) return false;
  return invitation.expiresAt.getTime() > now.getTime();
}
