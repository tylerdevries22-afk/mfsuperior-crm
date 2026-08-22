import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { driverAvailabilityRules } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import {
  availabilityQuerySchema,
  availabilityRuleWriteSchema,
} from "@/lib/mobile-api/contracts";
import {
  availabilityRuleAccessPredicate,
  requireCarrierId,
  resolveAvailabilityDriverId,
} from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
  parseStrictQuery,
} from "@/lib/mobile-api/http";

/**
 * Standing weekly availability patterns.
 *
 * Stored as minutes from local midnight rather than instants, so a rule that
 * runs 8am–4pm still runs 8am–4pm on the two days a year the clocks move.
 */
export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver"],
    requireCarrier: true,
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const query = parseStrictQuery(request, availabilityQuerySchema, requestId);
  if (!query.success) return query.response;

  try {
    const filters = [availabilityRuleAccessPredicate(principal)];
    if (query.data.driverId) {
      filters.push(eq(driverAvailabilityRules.driverId, query.data.driverId));
    }
    const rows = await db
      .select()
      .from(driverAvailabilityRules)
      .where(and(...filters))
      .orderBy(asc(driverAvailabilityRules.weekday), asc(driverAvailabilityRules.startMinute))
      .limit(query.data.limit);

    return mergeResponseHeaders(
      apiSuccess(rows.map(toAvailabilityRule), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "availability-rules.list");
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.availability-rules.write", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const body = await parseStrictJson(request, availabilityRuleWriteSchema, requestId);
  if (!body.success) return body.response;

  try {
    const carrierId = requireCarrierId(principal);
    const driverId = resolveAvailabilityDriverId(principal, body.data.driverId);
    const values = {
      carrierId,
      driverId,
      effectiveFrom: new Date(body.data.effectiveFrom),
      effectiveUntil: body.data.effectiveUntil ? new Date(body.data.effectiveUntil) : null,
      endMinute: body.data.endMinute,
      kind: body.data.kind,
      startMinute: body.data.startMinute,
      updatedAt: new Date(),
      weekday: body.data.weekday,
    };

    const [row] = body.data.id
      ? await db
          .update(driverAvailabilityRules)
          .set(values)
          .where(and(
            eq(driverAvailabilityRules.id, body.data.id),
            eq(driverAvailabilityRules.carrierId, carrierId),
            eq(driverAvailabilityRules.driverId, driverId),
          ))
          .returning()
      : await db.insert(driverAvailabilityRules).values(values).returning();

    if (!row) {
      throw new MobileApiError(404, "NOT_FOUND", "That weekly pattern could not be found.");
    }
    return mergeResponseHeaders(
      apiSuccess(toAvailabilityRule(row), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "availability-rules.write");
  }
}

function toAvailabilityRule(row: typeof driverAvailabilityRules.$inferSelect) {
  return {
    createdAt: row.createdAt.toISOString(),
    driverId: row.driverId,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveUntil: row.effectiveUntil?.toISOString() ?? null,
    endMinute: row.endMinute,
    id: row.id,
    kind: row.kind,
    startMinute: row.startMinute,
    updatedAt: row.updatedAt.toISOString(),
    weekday: row.weekday,
  };
}
