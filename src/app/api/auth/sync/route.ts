import { createHash } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
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

const syncBodySchema = z
  .object({
    invitationToken: z.string().trim().min(32).max(512).optional(),
  })
  .strict();

function invitationHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function redeemInvitation(
  subject: string,
  email: string,
  token: string,
): Promise<void> {
  const tokenHash = invitationHash(token);
  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${subject}, 0))`,
    );
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

    const [subjectUser] = await transaction
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.authSubject, subject));
    const [emailUser] = subjectUser
      ? [subjectUser]
      : await transaction
          .select({ id: users.id, authSubject: users.authSubject, email: users.email })
          .from(users)
          .where(sql`lower(${users.email}) = ${email}`)
          .limit(1);
    if (emailUser && "authSubject" in emailUser && emailUser.authSubject) {
      throw new MobileApiError(
        409,
        "CONFLICT",
        "This email is already linked to another authenticated identity.",
      );
    }
    const userId = emailUser?.id;
    const [user] = userId
      ? await transaction
          .update(users)
          .set({ authSubject: subject, authProvider: "supabase", emailVerified: new Date() })
          .where(eq(users.id, userId))
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
    const [existingDefault] = await transaction
      .select({ id: organizationMemberships.id })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.userId, user.id),
          eq(organizationMemberships.status, "active"),
          eq(organizationMemberships.isDefault, true),
        ),
      )
      .limit(1);
    await transaction
      .insert(organizationMemberships)
      .values({
        organizationId: invitation.organizationId,
        userId: user.id,
        role: invitation.role,
        status: "active",
        driverId: invitation.driverId,
        customerAccountId: invitation.customerAccountId,
        isDefault: !existingDefault,
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
          updatedAt: new Date(),
        },
      });
    await transaction
      .update(organizationInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(organizationInvitations.id, invitation.id));
  });
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
    const limiter = await new PersistentRateLimiter().consume({
      key: `auth.sync:${identity.subject ?? identity.userId ?? identity.email}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!limiter.allowed) {
      throw new MobileApiError(429, "RATE_LIMITED", "Too many sync attempts.");
    }
    if (parsed.data.invitationToken) {
      if (!identity.subject) {
        throw new MobileApiError(
          409,
          "CONFLICT",
          "Invitation redemption requires Supabase authentication.",
        );
      }
      await redeemInvitation(
        identity.subject,
        identity.email,
        parsed.data.invitationToken,
      );
    }

    const headers = new Headers(request.headers);
    headers.set("x-request-id", requestId);
    const authorization = await authorizeMobileRequest(
      new Request(request.url, { method: request.method, headers }),
      { roles: ["admin", "driver", "customer"], rateLimit: false },
      {
        verifyIdentity: async () => identity,
        loadMemberships: loadMembershipCandidates,
        rateLimiter: new PersistentRateLimiter(),
      },
    );
    if (!authorization.authorized) return authorization.response;
    return mergeResponseHeaders(
      apiSuccess(
        {
          userId: authorization.principal.userId,
          organizationId: authorization.principal.organizationId,
          organizationSlug: authorization.principal.organizationSlug,
          role: authorization.principal.role,
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
