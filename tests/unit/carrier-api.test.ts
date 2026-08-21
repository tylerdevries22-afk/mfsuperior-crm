import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));

import { fetchCarrierData } from "@/app/(app)/carrier/_lib/api-client";
import {
  databaseErrorResponse,
  parseJsonBody,
  parseQuery,
  requireCarrierDispatcher,
  successResponse,
} from "@/app/api/carrier/_lib/http";
import {
  canTransitionShipmentStatus,
  driverCreateSchema,
  driverListQuerySchema,
  shipmentCreateSchema,
} from "@/app/api/carrier/_lib/validation";

type ErrorEnvelope = {
  data: null;
  error: { code: string; message: string };
  meta: null;
};

async function errorEnvelope(response: Response) {
  return (await response.json()) as ErrorEnvelope;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("carrier API boundaries", () => {
  it("requires authentication and an explicitly allowlisted dispatcher", async () => {
    const anonymous = await requireCarrierDispatcher(async () => null, "ops@example.com");
    expect(anonymous.authorized).toBe(false);
    if (!anonymous.authorized) {
      expect(anonymous.response.status).toBe(401);
      expect((await errorEnvelope(anonymous.response)).error.code).toBe(
        "AUTHENTICATION_REQUIRED",
      );
    }

    const session = async () => ({
      user: { id: "operator-1", email: "OPS@example.com" },
    });
    const unconfigured = await requireCarrierDispatcher(session, "");
    expect(unconfigured.authorized).toBe(false);
    if (!unconfigured.authorized) expect(unconfigured.response.status).toBe(503);

    const forbidden = await requireCarrierDispatcher(session, "other@example.com");
    expect(forbidden.authorized).toBe(false);
    if (!forbidden.authorized) expect(forbidden.response.status).toBe(403);

    const allowed = await requireCarrierDispatcher(session, "ops@example.com");
    expect(allowed).toMatchObject({
      authorized: true,
      principal: { userId: "operator-1", role: "dispatcher" },
    });

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unavailable = await requireCarrierDispatcher(
      async () => { throw new Error("session store unavailable"); },
      "ops@example.com",
    );
    expect(unavailable.authorized).toBe(false);
    if (!unavailable.authorized) {
      expect(unavailable.response.status).toBe(503);
      expect((await errorEnvelope(unavailable.response)).error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("bounds list queries and rejects unknown query parameters", async () => {
    const valid = parseQuery(
      new Request("https://crm.example/api/carrier/drivers?page=2&limit=100"),
      driverListQuerySchema,
    );
    expect(valid).toEqual({
      success: true,
      data: { page: 2, limit: 100 },
    });

    const oversized = parseQuery(
      new Request("https://crm.example/api/carrier/drivers?limit=101"),
      driverListQuerySchema,
    );
    expect(oversized.success).toBe(false);
    if (!oversized.success) expect(oversized.response.status).toBe(400);

    const unknown = parseQuery(
      new Request("https://crm.example/api/carrier/drivers?admin=true"),
      driverListQuerySchema,
    );
    expect(unknown.success).toBe(false);
  });

  it("rate limits an authenticated dispatcher within a fixed window", async () => {
    const session = async () => ({
      user: { id: "rate-operator", email: "rate@example.com" },
    });
    for (let requestNumber = 0; requestNumber < 60; requestNumber += 1) {
      const result = await requireCarrierDispatcher(session, "rate@example.com");
      expect(result.authorized).toBe(true);
    }
    const limited = await requireCarrierDispatcher(session, "rate@example.com");
    expect(limited.authorized).toBe(false);
    if (!limited.authorized) {
      expect(limited.response.status).toBe(429);
      expect((await errorEnvelope(limited.response)).error.code).toBe("RATE_LIMITED");
    }
  });

  it("validates JSON media type, size, shape, and database conflicts", async () => {
    const validRequest = new Request("https://crm.example/api/carrier/drivers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        carrierId: "550e8400-e29b-41d4-a716-446655440000",
        firstName: "Brenna",
        lastName: "Driver",
      }),
    });
    const valid = await parseJsonBody(validRequest, driverCreateSchema);
    expect(valid.success).toBe(true);

    const unknownField = await parseJsonBody(
      new Request("https://crm.example/api/carrier/drivers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          carrierId: "550e8400-e29b-41d4-a716-446655440000",
          firstName: "Brenna",
          lastName: "Driver",
          isAdmin: true,
        }),
      }),
      driverCreateSchema,
    );
    expect(unknownField.success).toBe(false);

    const oversized = await parseJsonBody(
      new Request("https://crm.example/api/carrier/drivers", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(65 * 1024),
        },
        body: "{}",
      }),
      z.object({}).strict(),
    );
    expect(oversized.success).toBe(false);
    if (!oversized.success) expect(oversized.response.status).toBe(413);

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const conflict = databaseErrorResponse({ code: "23505" }, "test.create");
    expect(conflict.status).toBe(409);
  });

  it("enforces shipment payload limits and lifecycle transitions", () => {
    const baseShipment = {
      origin: { city: "Denver", state: "CO" },
      destination: { city: "Minneapolis", state: "MN" },
    };
    expect(shipmentCreateSchema.safeParse(baseShipment).success).toBe(true);
    expect(
      shipmentCreateSchema.safeParse({
        ...baseShipment,
        intermediateStops: Array.from({ length: 21 }, () => ({
          city: "Denver",
          state: "CO",
        })),
      }).success,
    ).toBe(false);
    expect(shipmentCreateSchema.safeParse({ ...baseShipment, status: "delivered" }).success).toBe(false);
    expect(canTransitionShipmentStatus("tendered", "accepted")).toBe(true);
    expect(canTransitionShipmentStatus("tendered", "delivered")).toBe(false);
    expect(canTransitionShipmentStatus("delivered", "in_transit")).toBe(false);
  });

  it("uses the structured envelope and retries one transient client request", async () => {
    const success = successResponse({ count: 2 }, { page: 1 });
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({
      data: { count: 2 },
      error: null,
      meta: { page: 1 },
    });

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            data: null,
            error: { code: "INTERNAL_ERROR", message: "Try again." },
            meta: null,
          },
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { count: 3 }, error: null, meta: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCarrierData<{ count: number }>("/api/carrier/dashboard"))
      .resolves.toEqual({ count: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
