import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { createRequestSupabaseClient } from "@/lib/auth/supabase/server-client";
import { db } from "@/lib/db/client";
import {
  carriers,
  customerAccounts,
  drivers,
  organizationMemberships,
  organizations,
  users,
} from "@/lib/db/schema";
import {
  apiError,
  apiFailureResponse,
  mergeResponseHeaders,
  MobileApiError,
  requestIdFor,
} from "./http";
import {
  PersistentRateLimiter,
  type RateLimiter,
  type RateLimitDecision,
} from "./rate-limit";

export const runtimeRoles = ["admin", "driver", "customer"] as const;
export type RuntimeRole = (typeof runtimeRoles)[number];
export type CredentialKind = "bearer" | "supabase-cookie" | "authjs-cookie";
export type MembershipStatus =
  | "invited"
  | "pending"
  | "active"
  | "suspended"
  | "revoked";
export type AuthorizedMembershipStatus = "pending" | "active";

export type MobilePrincipal = {
  userId: string;
  authSubject: string | null;
  email: string;
  organizationId: string;
  organizationSlug: string;
  role: RuntimeRole;
  membershipStatus: AuthorizedMembershipStatus;
  carrierId: string | null;
  driverId: string | null;
  customerAccountId: string | null;
  credentialKind: CredentialKind;
};

export type VerifiedIdentity = {
  subject: string | null;
  userId: string | null;
  email: string;
  credentialKind: CredentialKind;
  assuranceLevel: "aal1" | "aal2" | null;
  responseHeaders: Headers;
};

export type MembershipCandidate = Omit<
  MobilePrincipal,
  "credentialKind" | "membershipStatus"
> & {
  membershipStatus: MembershipStatus;
  organizationStatus: "active" | "suspended" | "archived";
  isDefault: boolean;
  driverCarrierId: string | null;
  customerOrganizationId: string | null;
};

export type OrganizationSelector =
  | { kind: "id"; value: string }
  | { kind: "slug"; value: string }
  | null;

export type AuthorizeOptions = {
  roles?: ReadonlyArray<RuntimeRole>;
  allowPendingCustomer?: boolean;
  requireCarrier?: boolean;
  requireMfa?: boolean;
  rateLimit?: { scope: string; limit: number; windowMs: number } | false;
};

export type AuthorizeDependencies = {
  verifyIdentity: (request: Request) => Promise<VerifiedIdentity>;
  loadMemberships: (
    identity: VerifiedIdentity,
  ) => Promise<ReadonlyArray<MembershipCandidate>>;
  rateLimiter: RateLimiter;
};

export type AuthorizationResult =
  | {
      authorized: true;
      principal: MobilePrincipal;
      requestId: string;
      responseHeaders: Headers;
      rateLimit: RateLimitDecision | null;
    }
  | { authorized: false; response: Response; requestId: string };

const bearerSchema = z.string().regex(/^Bearer [^\s]{20,8192}$/i);
const claimsSchema = z
  .object({
    sub: z.string().min(1).max(255),
    email: z.email().max(320),
    aal: z.enum(["aal1", "aal2"]).optional(),
  })
  .passthrough();
const organizationIdSchema = z.uuid();
const organizationSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/);

function organizationSelector(request: Request): OrganizationSelector {
  const id = request.headers.get("x-organization-id");
  const slug = request.headers.get("x-organization-slug");
  if (id && slug) {
    throw new MobileApiError(
      400,
      "VALIDATION_ERROR",
      "Send either x-organization-id or x-organization-slug, not both.",
    );
  }
  if (id) {
    const parsed = organizationIdSchema.safeParse(id);
    if (!parsed.success) {
      throw new MobileApiError(
        400,
        "VALIDATION_ERROR",
        "The organization ID header is invalid.",
      );
    }
    return { kind: "id", value: parsed.data };
  }
  if (slug) {
    const parsed = organizationSlugSchema.safeParse(slug);
    if (!parsed.success) {
      throw new MobileApiError(
        400,
        "VALIDATION_ERROR",
        "The organization slug header is invalid.",
      );
    }
    return { kind: "slug", value: parsed.data };
  }
  return null;
}

export function requestOriginIsAllowed(
  request: Request,
  credentialKind: CredentialKind,
  configuredOrigins = process.env.MOBILE_ALLOWED_ORIGINS,
): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    return true;
  }
  if (credentialKind === "bearer") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;
  const sameOrigin = new URL(request.url).origin;
  if (origin === sameOrigin) return true;
  return (configuredOrigins ?? "")
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .includes(origin);
}

async function loadAuthJsIdentity(): Promise<VerifiedIdentity | null> {
  if (process.env.AUTHJS_ROLLBACK_ENABLED !== "true") return null;
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email?.trim().toLowerCase();
  if (!userId || !email) return null;
  return {
    subject: null,
    userId,
    email,
    credentialKind: "authjs-cookie",
    assuranceLevel: null,
    responseHeaders: new Headers(),
  };
}

/** Verifies the JWT cryptographically; getSession() is intentionally unused. */
export async function verifyRequestIdentity(
  request: Request,
): Promise<VerifiedIdentity> {
  const authorization = request.headers.get("authorization");
  if (authorization && !bearerSchema.safeParse(authorization).success) {
    throw new MobileApiError(
      401,
      "AUTHENTICATION_REQUIRED",
      "The bearer authorization header is invalid.",
    );
  }
  const bearer = authorization?.slice("Bearer ".length);
  const requestClient = createRequestSupabaseClient(request);
  if (!requestClient) {
    if (!bearer) {
      const rollbackIdentity = await loadAuthJsIdentity();
      if (rollbackIdentity) return rollbackIdentity;
    }
    throw new MobileApiError(
      503,
      "AUTH_NOT_CONFIGURED",
      "Supabase authentication has not been configured.",
    );
  }

  const result = await requestClient.client.auth.getClaims(bearer);
  if (result.error || !result.data?.claims) {
    if (!bearer) {
      const rollbackIdentity = await loadAuthJsIdentity();
      if (rollbackIdentity) return rollbackIdentity;
    }
    throw new MobileApiError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Sign in to continue.",
    );
  }
  const claims = claimsSchema.safeParse(result.data.claims);
  if (!claims.success) {
    throw new MobileApiError(
      401,
      "AUTHENTICATION_REQUIRED",
      "The authenticated identity is incomplete.",
    );
  }
  return {
    subject: claims.data.sub,
    userId: null,
    email: claims.data.email.trim().toLowerCase(),
    credentialKind: bearer ? "bearer" : "supabase-cookie",
    assuranceLevel: claims.data.aal ?? null,
    responseHeaders: requestClient.responseHeaders,
  };
}

export async function loadMembershipCandidates(
  identity: VerifiedIdentity,
): Promise<ReadonlyArray<MembershipCandidate>> {
  const identityFilter = identity.userId
    ? eq(users.id, identity.userId)
    : eq(users.authSubject, identity.subject ?? "");
  return db
    .select({
      userId: users.id,
      authSubject: users.authSubject,
      email: users.email,
      organizationId: organizations.id,
      organizationSlug: organizations.slug,
      organizationStatus: organizations.status,
      role: organizationMemberships.role,
      membershipStatus: organizationMemberships.status,
      isDefault: organizationMemberships.isDefault,
      carrierId: carriers.id,
      driverId: organizationMemberships.driverId,
      driverCarrierId: drivers.carrierId,
      customerAccountId: organizationMemberships.customerAccountId,
      customerOrganizationId: customerAccounts.organizationId,
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(organizationMemberships.userId, users.id))
    .innerJoin(
      organizations,
      eq(organizationMemberships.organizationId, organizations.id),
    )
    .leftJoin(carriers, eq(carriers.organizationId, organizations.id))
    .leftJoin(drivers, eq(organizationMemberships.driverId, drivers.id))
    .leftJoin(
      customerAccounts,
      eq(organizationMemberships.customerAccountId, customerAccounts.id),
    )
    .where(identityFilter)
    .orderBy(asc(organizationMemberships.createdAt))
    .limit(20);
}

/** Deterministic membership selection prevents cross-tenant fallback. */
export function selectMembershipCandidate(
  candidates: ReadonlyArray<MembershipCandidate>,
  selector: OrganizationSelector,
  options: Pick<AuthorizeOptions, "allowPendingCustomer"> = {},
): MembershipCandidate & { membershipStatus: AuthorizedMembershipStatus } {
  const eligible = candidates.filter(
    (candidate) =>
      (candidate.membershipStatus === "active" ||
        (options.allowPendingCustomer === true &&
          candidate.membershipStatus === "pending" &&
          candidate.role === "customer" &&
          !candidate.driverId &&
          !candidate.customerAccountId)) &&
      candidate.organizationStatus === "active" &&
      (!selector ||
        (selector.kind === "id"
          ? candidate.organizationId === selector.value
          : candidate.organizationSlug === selector.value)),
  );
  if (eligible.length === 0) {
    throw new MobileApiError(
      403,
      "MEMBERSHIP_REQUIRED",
      "An active organization membership is required.",
    );
  }

  const selected = eligible.length === 1
    ? eligible[0]
    : eligible.find((candidate) => candidate.isDefault);
  if (!selected) {
    throw new MobileApiError(
      409,
      "ORGANIZATION_REQUIRED",
      "Select an organization for this request.",
    );
  }
  if (
    selected.role === "driver" &&
    (!selected.driverId || selected.driverCarrierId !== selected.carrierId)
  ) {
    throw new MobileApiError(
      403,
      "MEMBERSHIP_REQUIRED",
      "The driver membership is not linked to this organization.",
    );
  }
  if (
    selected.role === "customer" &&
    selected.membershipStatus === "active" &&
    (!selected.customerAccountId ||
      selected.customerOrganizationId !== selected.organizationId)
  ) {
    throw new MobileApiError(
      403,
      "MEMBERSHIP_REQUIRED",
      "The customer membership is not linked to this organization.",
    );
  }
  return selected as MembershipCandidate & {
    membershipStatus: AuthorizedMembershipStatus;
  };
}

const defaultDependencies: AuthorizeDependencies = {
  verifyIdentity: verifyRequestIdentity,
  loadMemberships: loadMembershipCandidates,
  rateLimiter: new PersistentRateLimiter(),
};

export async function authorizeMobileRequest(
  request: Request,
  options: AuthorizeOptions = {},
  dependencies: AuthorizeDependencies = defaultDependencies,
): Promise<AuthorizationResult> {
  const requestId = requestIdFor(request);
  let responseHeaders = new Headers();
  try {
    const selector = organizationSelector(request);
    const identity = await dependencies.verifyIdentity(request);
    responseHeaders = identity.responseHeaders;
    if (!requestOriginIsAllowed(request, identity.credentialKind)) {
      throw new MobileApiError(
        403,
        "CSRF_REJECTED",
        "The request origin is not allowed.",
      );
    }
    if (options.requireMfa && identity.assuranceLevel !== "aal2") {
      throw new MobileApiError(
        403,
        "MFA_REQUIRED",
        "Multi-factor authentication is required for this operation.",
      );
    }
    const selected = selectMembershipCandidate(
      await dependencies.loadMemberships(identity),
      selector,
      { allowPendingCustomer: options.allowPendingCustomer },
    );
    if (options.roles && !options.roles.includes(selected.role)) {
      throw new MobileApiError(
        403,
        "ROLE_REQUIRED",
        "Your role cannot perform this operation.",
      );
    }
    if (options.requireCarrier && !selected.carrierId) {
      throw new MobileApiError(
        503,
        "DEPENDENCY_UNAVAILABLE",
        "The organization carrier profile is not configured.",
      );
    }

    const configuredRateLimit = options.rateLimit === undefined
      ? { scope: "mobile", limit: 120, windowMs: 60_000 }
      : options.rateLimit;
    const rateLimit = configuredRateLimit
      ? await dependencies.rateLimiter.consume({
          key: `${configuredRateLimit.scope}:${selected.organizationId}:${selected.userId}`,
          limit: configuredRateLimit.limit,
          windowMs: configuredRateLimit.windowMs,
        })
      : null;
    if (rateLimit && !rateLimit.allowed) {
      return {
        authorized: false,
        requestId,
        response: apiError(
          429,
          {
            code: "RATE_LIMITED",
            message: "Too many requests. Wait and try again.",
          },
          requestId,
          {
            "retry-after": String(
              Math.max(1, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1_000)),
            ),
          },
        ),
      };
    }

    return {
      authorized: true,
      requestId,
      responseHeaders: identity.responseHeaders,
      rateLimit,
      principal: {
        userId: selected.userId,
        authSubject: selected.authSubject,
        email: selected.email,
        organizationId: selected.organizationId,
        organizationSlug: selected.organizationSlug,
        role: selected.role,
        membershipStatus: selected.membershipStatus,
        carrierId: selected.carrierId,
        driverId: selected.driverId,
        customerAccountId: selected.customerAccountId,
        credentialKind: identity.credentialKind,
      },
    };
  } catch (error) {
    return {
      authorized: false,
      requestId,
      response: mergeResponseHeaders(
        apiFailureResponse(error, requestId, "authorize"),
        responseHeaders,
      ),
    };
  }
}

export function principalCanAccessCarrier(
  principal: MobilePrincipal,
  carrierId: string | null,
): boolean {
  return carrierId !== null && principal.carrierId === carrierId;
}
