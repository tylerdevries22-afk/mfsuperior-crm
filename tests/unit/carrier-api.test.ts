import { afterEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { z } from "zod";
import { readSupabasePublicConfig } from "@/lib/auth/supabase/config";
import {
  authorizeMobileRequest,
  principalCanAccessCarrier,
  selectMembershipCandidate,
  type AuthorizeDependencies,
  type MembershipCandidate,
  type MobilePrincipal,
} from "@/lib/mobile-api/authorize";
import {
  driverCreateSchema,
  shipmentCreateSchema,
} from "@/app/api/carrier/_lib/validation";
import {
  freightRequestCreateSchema,
  offlineMutationBatchSchema,
} from "@/lib/mobile-api/contracts";
import { fetchWithRetry } from "@/lib/mobile-api/external-fetch";
import {
  freightRequestAccessPredicate,
  shipmentAccessPredicate,
} from "@/lib/mobile-api/access";
import {
  apiSuccess,
  parseStrictJson,
  parseStrictQuery,
} from "@/lib/mobile-api/http";
import { canonicalRequestHash } from "@/lib/mobile-api/idempotency";
import {
  PersistentRateLimiter,
  type RateLimitStore,
} from "@/lib/mobile-api/rate-limit";
import {
  decodeSyncCursor,
  encodeSyncCursor,
} from "@/lib/mobile-api/sync-cursor";
import { storagePathFor } from "@/lib/mobile-api/upload-signer";

const organizationId = "550e8400-e29b-41d4-a716-446655440000";
const otherOrganizationId = "550e8400-e29b-41d4-a716-446655440001";
const userId = "550e8400-e29b-41d4-a716-446655440002";
const carrierId = "550e8400-e29b-41d4-a716-446655440003";

const membership: MembershipCandidate = {
  userId,
  authSubject: "supabase-user",
  email: "ops@example.com",
  organizationId,
  organizationSlug: "mf-superior",
  organizationStatus: "active",
  role: "admin",
  membershipStatus: "active",
  isDefault: true,
  carrierId,
  driverId: null,
  driverCarrierId: null,
  customerAccountId: null,
  customerOrganizationId: null,
};

const pendingCustomerMembership: MembershipCandidate = {
  ...membership,
  email: "pending@example.com",
  role: "customer",
  membershipStatus: "pending",
  isDefault: false,
  driverId: null,
  driverCarrierId: null,
  customerAccountId: null,
  customerOrganizationId: null,
};

function dependencies(
  candidate: MembershipCandidate = membership,
  credentialKind: "bearer" | "supabase-cookie" = "bearer",
  assuranceLevel: "aal1" | "aal2" | null = "aal2",
): AuthorizeDependencies {
  return {
    verifyIdentity: async () => ({
      subject: "supabase-user",
      userId: null,
      email: "ops@example.com",
      credentialKind,
      assuranceLevel,
      responseHeaders: new Headers(),
    }),
    loadMemberships: async () => [candidate],
    rateLimiter: {
      consume: async ({ limit }) => ({
        allowed: true,
        limit,
        remaining: limit - 1,
        resetAt: new Date(Date.now() + 60_000),
      }),
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("membership-backed authorization", () => {
  it("authorizes a mapped admin and rejects a disallowed runtime role", async () => {
    const request = new Request("https://crm.example/api/carrier/dashboard", {
      headers: { authorization: `Bearer ${"a".repeat(32)}` },
    });
    const allowed = await authorizeMobileRequest(
      request,
      { roles: ["admin"], requireCarrier: true },
      dependencies(),
    );
    expect(allowed.authorized).toBe(true);
    if (allowed.authorized) {
      expect(allowed.principal).toMatchObject({
        organizationId,
        carrierId,
        role: "admin",
      });
    }

    const denied = await authorizeMobileRequest(
      request,
      { roles: ["driver"] },
      dependencies(),
    );
    expect(denied.authorized).toBe(false);
    if (!denied.authorized) expect(denied.response.status).toBe(403);
  });

  it("rejects cross-tenant selection and mismatched driver bindings", () => {
    expect(() =>
      selectMembershipCandidate([membership], {
        kind: "id",
        value: otherOrganizationId,
      }),
    ).toThrow(/active organization membership/i);

    expect(() =>
      selectMembershipCandidate(
        [
          {
            ...membership,
            role: "driver",
            driverId: "550e8400-e29b-41d4-a716-446655440004",
            driverCarrierId: "550e8400-e29b-41d4-a716-446655440005",
          },
        ],
        null,
      ),
    ).toThrow(/not linked/i);
  });

  it("enforces origin checks for cookie mutations but not bearer mutations", async () => {
    const cookieMutation = new Request("https://crm.example/api/carrier/drivers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const denied = await authorizeMobileRequest(
      cookieMutation,
      { roles: ["admin"] },
      dependencies(membership, "supabase-cookie"),
    );
    expect(denied.authorized).toBe(false);
    if (!denied.authorized) expect(denied.response.status).toBe(403);

    const bearer = await authorizeMobileRequest(
      cookieMutation,
      { roles: ["admin"] },
      dependencies(),
    );
    expect(bearer.authorized).toBe(true);
  });

  it("uses carrier identity equality as a final BOLA guard", () => {
    const principal = {
      ...membership,
      membershipStatus: "active" as const,
      credentialKind: "bearer" as const,
    } satisfies MobilePrincipal;
    expect(principalCanAccessCarrier(principal, carrierId)).toBe(true);
    expect(principalCanAccessCarrier(principal, null)).toBe(false);
    expect(principalCanAccessCarrier(principal, otherOrganizationId)).toBe(false);
  });

  it("allows a pending customer only when the endpoint opts in", async () => {
    expect(() =>
      selectMembershipCandidate([pendingCustomerMembership], null),
    ).toThrow(/active organization membership/i);
    expect(
      selectMembershipCandidate([pendingCustomerMembership], null, {
        allowPendingCustomer: true,
      }).membershipStatus,
    ).toBe("pending");

    const request = new Request("https://crm.example/api/mobile/v1/requests", {
      headers: { authorization: `Bearer ${"a".repeat(32)}` },
    });
    const denied = await authorizeMobileRequest(
      request,
      { roles: ["customer"] },
      dependencies(pendingCustomerMembership),
    );
    expect(denied.authorized).toBe(false);

    const allowed = await authorizeMobileRequest(
      request,
      { roles: ["customer"], allowPendingCustomer: true },
      dependencies(pendingCustomerMembership),
    );
    expect(allowed.authorized).toBe(true);
    if (allowed.authorized) {
      expect(allowed.principal).toMatchObject({
        role: "customer",
        membershipStatus: "pending",
        customerAccountId: null,
      });
    }
  });

  it("never promotes a pending admin/driver or grants pending shipment access", async () => {
    expect(() =>
      selectMembershipCandidate(
        [{ ...pendingCustomerMembership, role: "admin" }],
        null,
        { allowPendingCustomer: true },
      ),
    ).toThrow(/active organization membership/i);
    expect(() =>
      selectMembershipCandidate(
        [{ ...pendingCustomerMembership, role: "driver" }],
        null,
        { allowPendingCustomer: true },
      ),
    ).toThrow(/active organization membership/i);

    const shipmentAuthorization = await authorizeMobileRequest(
      new Request("https://crm.example/api/mobile/v1/shipments", {
        headers: { authorization: `Bearer ${"a".repeat(32)}` },
      }),
      { roles: ["admin", "driver", "customer"], requireCarrier: true },
      dependencies(pendingCustomerMembership),
    );
    expect(shipmentAuthorization.authorized).toBe(false);
    if (!shipmentAuthorization.authorized) {
      expect(shipmentAuthorization.response.status).toBe(403);
    }
  });

  it("requires aal2 for customer-access administration", async () => {
    const request = new Request(
      "https://crm.example/api/mobile/v1/customer-access-requests",
      { headers: { authorization: `Bearer ${"a".repeat(32)}` } },
    );
    const denied = await authorizeMobileRequest(
      request,
      { roles: ["admin"], requireMfa: true },
      dependencies(membership, "bearer", "aal1"),
    );
    expect(denied.authorized).toBe(false);
    if (!denied.authorized) {
      expect(await denied.response.json()).toMatchObject({
        error: { code: "MFA_REQUIRED" },
      });
    }

    const allowed = await authorizeMobileRequest(
      request,
      { roles: ["admin"], requireMfa: true },
      dependencies(membership, "bearer", "aal2"),
    );
    expect(allowed.authorized).toBe(true);
  });

  it("scopes pending request reads to the creator and shipment reads to false", () => {
    const principal = {
      ...pendingCustomerMembership,
      membershipStatus: "pending" as const,
      credentialKind: "bearer" as const,
    } satisfies MobilePrincipal;
    const dialect = new PgDialect();
    const requestQuery = dialect.sqlToQuery(
      freightRequestAccessPredicate(principal),
    );
    expect(requestQuery.sql).toContain("created_by_user_id");
    expect(requestQuery.params).toEqual([organizationId, userId]);
    expect(dialect.sqlToQuery(shipmentAccessPredicate(principal)).sql).toBe(
      "false",
    );
  });
});

describe("strict API contracts", () => {
  it("bounds queries and rejects unknown fields", () => {
    const schema = z
      .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
      .strict();
    expect(
      parseStrictQuery(
        new Request("https://crm.example/api?limit=100"),
        schema,
        "request-1234",
      ),
    ).toEqual({ success: true, data: { limit: 100 } });
    expect(
      parseStrictQuery(
        new Request("https://crm.example/api?limit=101&admin=true"),
        schema,
        "request-1234",
      ).success,
    ).toBe(false);
  });

  it("rejects oversized or tenant-injecting JSON bodies", async () => {
    const tenantInjection = await parseStrictJson(
      new Request("https://crm.example/api/carrier/drivers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          carrierId: otherOrganizationId,
          firstName: "Brenna",
          lastName: "Driver",
        }),
      }),
      driverCreateSchema,
      "request-1234",
    );
    expect(tenantInjection.success).toBe(false);

    const oversized = await parseStrictJson(
      new Request("https://crm.example/api", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(65 * 1024),
        },
        body: "{}",
      }),
      z.object({}).strict(),
      "request-1234",
    );
    expect(oversized.success).toBe(false);
    if (!oversized.success) expect(oversized.response.status).toBe(413);
  });

  it("validates shipment, request-window, and offline mutation boundaries", () => {
    const shipment = {
      origin: { city: "Denver", state: "CO" },
      destination: { city: "Minneapolis", state: "MN" },
    };
    expect(shipmentCreateSchema.safeParse(shipment).success).toBe(true);
    expect(
      shipmentCreateSchema.safeParse({ ...shipment, carrierId }).success,
    ).toBe(false);
    expect(
      freightRequestCreateSchema.safeParse({
        origin: {
          addressLine1: "1 Main St",
          city: "Denver",
          state: "CO",
          postalCode: "80202",
        },
        destination: {
          addressLine1: "2 Main St",
          city: "Boulder",
          state: "CO",
          postalCode: "80301",
        },
        pickupWindowStart: "2026-08-22T15:00:00Z",
        pickupWindowEnd: "2026-08-22T14:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      offlineMutationBatchSchema.safeParse({ mutations: [] }).success,
    ).toBe(false);
  });

  it("always emits request metadata in the structured envelope", async () => {
    const response = apiSuccess({ count: 2 }, "request-1234", {
      meta: { page: 1 },
    });
    expect(await response.json()).toEqual({
      data: { count: 2 },
      error: null,
      meta: { requestId: "request-1234", page: 1 },
    });
  });
});

describe("resilience and idempotency", () => {
  it("retries one transient external response with a timeout policy", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await fetchWithRetry("https://example.com", undefined, {
      timeoutMs: 500,
      retryDelayMs: 0,
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("hashes canonical request content for idempotency conflict detection", () => {
    expect(canonicalRequestHash({ a: 1, b: [2, 3] })).toBe(
      canonicalRequestHash({ b: [2, 3], a: 1 }),
    );
    expect(canonicalRequestHash({ a: 1 })).not.toBe(
      canonicalRequestHash({ a: 2 }),
    );
  });

  it("persists hashed limiter keys and rejects requests over the limit", async () => {
    let count = 0;
    let observedHash = "";
    const store: RateLimitStore = {
      increment: async (keyHash) => {
        observedHash = keyHash;
        count += 1;
        return count;
      },
    };
    const limiter = new PersistentRateLimiter(store);
    const first = await limiter.consume({ key: "raw-user-id", limit: 1, windowMs: 60_000 });
    const second = await limiter.consume({ key: "raw-user-id", limit: 1, windowMs: 60_000 });
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(observedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(observedHash).not.toContain("raw-user-id");
  });

  it("round-trips opaque sync cursors and rejects tampering", () => {
    const watermark = new Date("2026-08-21T18:00:00.000Z");
    expect(decodeSyncCursor(encodeSyncCursor(watermark))).toEqual(watermark);
    expect(() => decodeSyncCursor("v1.not-valid-json")).toThrow(/invalid/i);
  });

  it("fails closed without Supabase config and scopes storage paths", () => {
    expect(readSupabasePublicConfig({})).toBeNull();
    expect(
      readSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "http://unsafe.example",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "x".repeat(40),
      }),
    ).toBeNull();
    expect(
      storagePathFor(organizationId, userId, "../../ Signed BOL (1).pdf"),
    ).toBe(`${organizationId}/${userId}/..-..-Signed-BOL-1-.pdf`);
  });
});
