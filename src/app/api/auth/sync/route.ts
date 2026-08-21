import { createHash } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { createRequestSupabaseClient } from "@/lib/auth/supabase/server-client";
import { db } from "@/lib/db/client";
import {
  customerAccessRequests,
  freightRequests,
  organizationInvitations,
  organizationMemberships,
  organizations,
  users,
} from "@/lib/db/schema";
import {
  authorizeMobileRequest,
  loadMembershipCandidates,
  requestOriginIsAllowed,
  verifyRequestIdentity,
  type VerifiedIdentity,
} from "@/lib/mobile-api/authorize";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
  requestIdFor,
} from "@/lib/mobile-api/http";
import { PersistentRateLimiter } from "@/lib/mobile-api/rate-limit";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const syncBodySchema = z
  .object({
    invitationToken: z.string().trim().min(32).max(512).optional(),
    customerCompanyName: z.string().trim().min(1).max(200).optional(),
  })
  .strict();
const organizationSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/);
type SyncBody = z.output<typeof syncBodySchema>;

function invitationHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function selfRegistrationOrganizationSlug(): string {
  const parsed = organizationSlugSchema.safeParse(
    process.env.CUSTOMER_SELF_REGISTRATION_ORGANIZATION_SLUG ?? "mf-superior",
  );
  if (!parsed.success) {
    throw new MobileApiError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "Customer self-registration has not been configured.",
    );
  }
  return parsed.data;
}

async function requireVerifiedPermanentUser(
  request: Request,
  identity: VerifiedIdentity,
): Promise<void> {
  if (!identity.subject) {
    throw new MobileApiError(
      403,
      "MEMBERSHIP_REQUIRED",
      "Self-registration requires a verified Supabase email identity.",
    );
  }
  const requestClient = createRequestSupabaseClient(request);
  const bearer = request.headers.get("authorization")?.slice("Bearer ".length);
  const result = await requestClient?.client.auth.getUser(bearer);
  const user = result?.data.user;
  if (
    result?.error ||
    !user ||
    user.id !== identity.subject ||
    user.email?.trim().toLowerCase() !== identity.email ||
    !user.email_confirmed_at ||
    user.is_anonymous
  ) {
    throw new MobileApiError(
      403,
      "MEMBERSHIP_REQUIRED",
      "Verify your email address before requesting customer access.",
    );
  }
}

async function resolveUser(
  transaction: Transaction,
  subject: string,
  email: string,
): Promise<string> {
  const [subjectUser] = await transaction
    .select({ id: users.id, authSubject: users.authSubject })
    .from(users)
    .where(eq(users.authSubject, subject))
    .limit(1);
  const [emailUser] = subjectUser
    ? [subjectUser]
    : await transaction
        .select({ id: users.id, authSubject: users.authSubject })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
  if (emailUser?.authSubject && emailUser.authSubject !== subject) {
    throw new MobileApiError(
      409,
      "CONFLICT",
      "This email is already linked to another authenticated identity.",
    );
  }
  const [user] = emailUser
    ? await transaction
        .update(users)
        .set({
          authSubject: subject,
          authProvider: "supabase",
          email,
          emailVerified: new Date(),
        })
        .where(eq(users.id, emailUser.id))
        .returning({ id: users.id })
    : await transaction
        .insert(users)
        .values({
          authSubject: subject,
          authProvider: "supabase",
          email,
          emailVerified: new Date(),
        })
        .returning({ id: users.id });
  return user.id;
}

async function loadInvitation(
  transaction: Transaction,
  email: string,
  tokenHash: string,
) {
  const [invitation] = await transaction
    .select({
      id: organizationInvitations.id,
      organizationId: organizationInvitations.organizationId,
      role: organizationInvitations.role,
      driverId: organizationInvitations.driverId,
      customerAccountId: organizationInvitations.customerAccountId,
    })
    .from(organizationInvitations)
    .innerJoin(
      organizations,
      eq(organizationInvitations.organizationId, organizations.id),
    )
    .where(
      and(
        eq(organizationInvitations.tokenHash, tokenHash),
        sql`lower(${organizationInvitations.email}) = ${email}`,
        gt(organizationInvitations.expiresAt, new Date()),
        isNull(organizationInvitations.acceptedAt),
        isNull(organizationInvitations.revokedAt),
        eq(organizations.status, "active"),
      ),
    )
    .for("update");
  if (!invitation) {
    throw new MobileApiError(
      403,
      "MEMBERSHIP_REQUIRED",
      "The organization invitation is invalid or expired.",
    );
  }
  return invitation;
}

function validateInvitationBindings(
  invitation: Awaited<ReturnType<typeof loadInvitation>>,
): void {
  if (invitation.role === "driver" && !invitation.driverId) {
    throw new MobileApiError(
      409,
      "CONFLICT",
      "The driver invitation is missing its driver assignment.",
    );
  }
  if (invitation.role === "customer" && !invitation.customerAccountId) {
    throw new MobileApiError(
      409,
      "CONFLICT",
      "The customer invitation is missing its customer account.",
    );
  }
}

async function hasActiveDefaultMembership(
  transaction: Transaction,
  userId: string,
): Promise<boolean> {
  const [existingDefault] = await transaction
    .select({ id: organizationMemberships.id })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.status, "active"),
        eq(organizationMemberships.isDefault, true),
      ),
    )
    .limit(1);
  return Boolean(existingDefault);
}

async function upsertInvitationMembership(
  transaction: Transaction,
  invitation: Awaited<ReturnType<typeof loadInvitation>>,
  userId: string,
): Promise<void> {
  const hasDefault = await hasActiveDefaultMembership(transaction, userId);
  await transaction
    .insert(organizationMemberships)
    .values({
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role,
      status: "active",
      driverId: invitation.driverId,
      customerAccountId: invitation.customerAccountId,
      isDefault: !hasDefault,
    })
    .onConflictDoUpdate({
      target: [
        organizationMemberships.organizationId,
        organizationMemberships.userId,
      ],
      set: {
        role: invitation.role,
        status: "active",
        driverId: invitation.driverId,
        customerAccountId: invitation.customerAccountId,
        isDefault: !hasDefault,
        updatedAt: new Date(),
      },
    });
}

async function resolvePendingInvitationAccess(
  transaction: Transaction,
  invitation: Awaited<ReturnType<typeof loadInvitation>>,
  userId: string,
): Promise<void> {
  const resolvedAt = new Date();
  if (invitation.role === "customer" && invitation.customerAccountId) {
    await transaction
      .update(freightRequests)
      .set({
        customerAccountId: invitation.customerAccountId,
        updatedAt: resolvedAt,
      })
      .where(
        and(
          eq(freightRequests.organizationId, invitation.organizationId),
          eq(freightRequests.createdByUserId, userId),
          isNull(freightRequests.customerAccountId),
        ),
      );
  }
  await transaction
    .update(customerAccessRequests)
    .set({
      status: invitation.role === "customer" ? "approved" : "cancelled",
      linkedCustomerAccountId:
        invitation.role === "customer" ? invitation.customerAccountId : null,
      reviewNotes: "Resolved by organization invitation redemption.",
      reviewedAt: resolvedAt,
      updatedAt: resolvedAt,
    })
    .where(
      and(
        eq(customerAccessRequests.organizationId, invitation.organizationId),
        eq(customerAccessRequests.userId, userId),
        eq(customerAccessRequests.status, "pending"),
      ),
    );
}

async function redeemInvitation(
  subject: string,
  email: string,
  token: string,
): Promise<void> {
  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${subject}, 0))`,
    );
    const invitation = await loadInvitation(
      transaction,
      email,
      invitationHash(token),
    );
    validateInvitationBindings(invitation);
    const userId = await resolveUser(transaction, subject, email);
    await upsertInvitationMembership(transaction, invitation, userId);
    await resolvePendingInvitationAccess(transaction, invitation, userId);
    await transaction
      .update(organizationInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(organizationInvitations.id, invitation.id));
  });
}

async function selfRegistrationOrganizationId(
  transaction: Transaction,
  organizationSlug: string,
): Promise<string> {
  const [organization] = await transaction
    .select({ id: organizations.id })
    .from(organizations)
    .where(
      and(
        eq(organizations.slug, organizationSlug),
        eq(organizations.status, "active"),
      ),
    )
    .limit(1);
  if (!organization) {
    throw new MobileApiError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "Customer self-registration is temporarily unavailable.",
    );
  }
  return organization.id;
}

async function insertPendingMembership(
  transaction: Transaction,
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const [membership] = await transaction
    .insert(organizationMemberships)
    .values({
      organizationId,
      userId,
      role: "customer",
      status: "pending",
      isDefault: false,
    })
    .onConflictDoNothing()
    .returning({ id: organizationMemberships.id });
  return membership?.id ?? null;
}

async function createPendingCustomerAccess(
  subject: string,
  email: string,
  requestedCompanyName?: string,
): Promise<void> {
  const organizationSlug = selfRegistrationOrganizationSlug();
  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${subject}, 0))`,
    );
    const organizationId = await selfRegistrationOrganizationId(
      transaction,
      organizationSlug,
    );
    const userId = await resolveUser(transaction, subject, email);
    const membershipId = await insertPendingMembership(
      transaction,
      organizationId,
      userId,
    );
    if (!membershipId) return;
    await transaction.insert(customerAccessRequests).values({
      organizationId,
      userId,
      membershipId,
      requestedCompanyName,
    });
  });
}

async function enforceSyncRateLimit(identity: VerifiedIdentity): Promise<void> {
  const limiter = await new PersistentRateLimiter().consume({
    key: `auth.sync:${identity.subject ?? identity.userId ?? identity.email}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!limiter.allowed) {
    throw new MobileApiError(429, "RATE_LIMITED", "Too many sync attempts.");
  }
}

async function synchronizeMembership(
  request: Request,
  identity: VerifiedIdentity,
  input: SyncBody,
): Promise<void> {
  const memberships = await loadMembershipCandidates(identity);
  if (!input.invitationToken && memberships.length > 0) return;
  await requireVerifiedPermanentUser(request, identity);
  if (input.invitationToken) {
    await redeemInvitation(
      identity.subject ?? "",
      identity.email,
      input.invitationToken,
    );
    return;
  }
  await createPendingCustomerAccess(
    identity.subject ?? "",
    identity.email,
    input.customerCompanyName,
  );
}

async function authorizeSynchronizedIdentity(
  request: Request,
  requestId: string,
  identity: VerifiedIdentity,
) {
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  return authorizeMobileRequest(
    new Request(request.url, { method: request.method, headers }),
    {
      roles: ["admin", "driver", "customer"],
      allowPendingCustomer: true,
      rateLimit: false,
    },
    {
      verifyIdentity: async () => identity,
      loadMemberships: loadMembershipCandidates,
      rateLimiter: new PersistentRateLimiter(),
    },
  );
}

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const identity = await verifyRequestIdentity(request);
    if (!requestOriginIsAllowed(request, identity.credentialKind)) {
      throw new MobileApiError(
        403,
        "CSRF_REJECTED",
        "The request origin is not allowed.",
      );
    }
    const parsed = await parseStrictJson(request, syncBodySchema, requestId);
    if (!parsed.success) {
      return mergeResponseHeaders(parsed.response, identity.responseHeaders);
    }
    await enforceSyncRateLimit(identity);
    await synchronizeMembership(request, identity, parsed.data);
    const authorization = await authorizeSynchronizedIdentity(
      request,
      requestId,
      identity,
    );
    if (!authorization.authorized) return authorization.response;
    return mergeResponseHeaders(
      apiSuccess(
        {
          userId: authorization.principal.userId,
          organizationId: authorization.principal.organizationId,
          organizationSlug: authorization.principal.organizationSlug,
          role: authorization.principal.role,
          membershipStatus: authorization.principal.membershipStatus,
          accessState:
            authorization.principal.membershipStatus === "pending"
              ? "pending_customer_approval"
              : "active",
          carrierId: authorization.principal.carrierId,
          driverId: authorization.principal.driverId,
          customerAccountId: authorization.principal.customerAccountId,
        },
        requestId,
      ),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "auth.sync");
  }
}
