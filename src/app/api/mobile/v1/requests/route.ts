import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { freightRequests, outboxEvents } from "@/lib/db/schema";
import { freightRequestAccessPredicate } from "@/lib/mobile-api/access";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import {
  freightRequestCreateSchema,
  idempotencyKeySchema,
  mobileRequestQuerySchema,
} from "@/lib/mobile-api/contracts";
import {
  apiError,
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  parseStrictJson,
  parseStrictQuery,
} from "@/lib/mobile-api/http";
import {
  executeIdempotentMutation,
  type JsonValue,
} from "@/lib/mobile-api/idempotency";

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function requestResponse(row: typeof freightRequests.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    customerAccountId: row.customerAccountId,
    shipmentId: row.shipmentId,
    referenceNumber: row.referenceNumber,
    status: row.status,
    origin: row.origin as JsonValue,
    destination: row.destination as JsonValue,
    pickupWindowStart: row.pickupWindowStart?.toISOString() ?? null,
    pickupWindowEnd: row.pickupWindowEnd?.toISOString() ?? null,
    deliveryWindowStart: row.deliveryWindowStart?.toISOString() ?? null,
    deliveryWindowEnd: row.deliveryWindowEnd?.toISOString() ?? null,
    commodity: row.commodity,
    weightLbs: row.weightLbs,
    palletCount: row.palletCount,
    equipmentType: row.equipmentType,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "customer"],
    allowPendingCustomer: true,
  });
  if (!authorization.authorized) return authorization.response;
  const query = parseStrictQuery(
    request,
    mobileRequestQuerySchema,
    authorization.requestId,
  );
  if (!query.success) return query.response;
  const filters = [freightRequestAccessPredicate(authorization.principal)];
  if (query.data.status) {
    filters.push(eq(freightRequests.status, query.data.status));
  }
  const where = and(...filters);
  const offset = (query.data.page - 1) * query.data.limit;

  try {
    const [rows, [count]] = await Promise.all([
      db
        .select()
        .from(freightRequests)
        .where(where)
        .orderBy(desc(freightRequests.createdAt))
        .limit(query.data.limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(freightRequests)
        .where(where),
    ]);
    const total = Number(count.count);
    return mergeResponseHeaders(
      apiSuccess(rows.map(requestResponse), authorization.requestId, {
        meta: {
          page: query.data.page,
          limit: query.data.limit,
          total,
          totalPages: Math.ceil(total / query.data.limit),
        },
      }),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, authorization.requestId, "requests.list");
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "customer"],
    allowPendingCustomer: true,
    rateLimit: { scope: "mobile.requests.create", limit: 20, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const body = await parseStrictJson(
    request,
    freightRequestCreateSchema,
    authorization.requestId,
  );
  if (!body.success) return body.response;
  const idempotencyKey = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!idempotencyKey.success) {
    return apiError(
      400,
      {
        code: "VALIDATION_ERROR",
        message: "A valid Idempotency-Key header is required.",
      },
      authorization.requestId,
    );
  }

  try {
    const result = await executeIdempotentMutation(
      {
        principal: authorization.principal,
        idempotencyKey: idempotencyKey.data,
        operation: "freight_request.create",
        payload: body.data,
      },
      async (transaction) => {
        const [created] = await transaction
          .insert(freightRequests)
          .values({
            organizationId: authorization.principal.organizationId,
            customerAccountId: authorization.principal.customerAccountId,
            createdByUserId: authorization.principal.userId,
            referenceNumber: body.data.referenceNumber,
            origin: body.data.origin,
            destination: body.data.destination,
            pickupWindowStart: toDate(body.data.pickupWindowStart),
            pickupWindowEnd: toDate(body.data.pickupWindowEnd),
            deliveryWindowStart: toDate(body.data.deliveryWindowStart),
            deliveryWindowEnd: toDate(body.data.deliveryWindowEnd),
            commodity: body.data.commodity,
            weightLbs: body.data.weightLbs,
            palletCount: body.data.palletCount,
            equipmentType: body.data.equipmentType,
            notes: body.data.notes,
          })
          .returning();
        await transaction.insert(outboxEvents).values({
          organizationId: authorization.principal.organizationId,
          topic: "freight_request.created",
          aggregateType: "freight_request",
          aggregateId: created.id,
          deduplicationKey: `freight-request:${created.id}:created`,
          payload: { requestId: created.id },
        });
        return { status: 201, data: requestResponse(created) };
      },
    );
    return mergeResponseHeaders(
      apiSuccess(result.data, authorization.requestId, {
        status: result.status,
        meta: { idempotencyReplayed: result.replayed },
      }),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, authorization.requestId, "requests.create");
  }
}
