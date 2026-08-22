import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { driverAvailabilityBlocks } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import {
  availabilityBlockWriteSchema,
  availabilityQuerySchema,
} from "@/lib/mobile-api/contracts";
import {
  availabilityBlockAccessPredicate,
  requireCarrierId,
  resolveAvailabilityDriverId,
} from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  parseStrictJson,
  parseStrictQuery,
} from "@/lib/mobile-api/http";

/**
 * A driver's availability calendar.
 *
 * Drivers read and write their own; admins read and write anyone's inside
 * their carrier. Writing is never blocked by a clash with an assigned load —
 * a driver saying they cannot work is information dispatch needs, and refusing
 * to record it would push the truth out of the system. The mobile client
 * surfaces the conflict instead.
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
    const filters = [availabilityBlockAccessPredicate(principal)];
    // An admin narrowing to one driver still reads through the carrier pin.
    if (query.data.driverId) {
      filters.push(eq(driverAvailabilityBlocks.driverId, query.data.driverId));
    }
    if (query.data.from) {
      filters.push(gte(driverAvailabilityBlocks.endsAt, new Date(query.data.from)));
    }
    if (query.data.to) {
      filters.push(lte(driverAvailabilityBlocks.startsAt, new Date(query.data.to)));
    }

    const rows = await db
      .select()
      .from(driverAvailabilityBlocks)
      .where(and(...filters))
      .orderBy(asc(driverAvailabilityBlocks.startsAt))
      .limit(query.data.limit);

    return mergeResponseHeaders(
      apiSuccess(rows.map(toAvailabilityBlock), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "availability.list");
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.availability.write", limit: 60, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const body = await parseStrictJson(request, availabilityBlockWriteSchema, requestId);
  if (!body.success) return body.response;

  try {
    const carrierId = requireCarrierId(principal);
    const driverId = resolveAvailabilityDriverId(principal, body.data.driverId);
    const values = {
      carrierId,
      driverId,
      endsAt: new Date(body.data.endsAt),
      kind: body.data.kind,
      note: body.data.note ?? null,
      startsAt: new Date(body.data.startsAt),
      updatedAt: new Date(),
    };

    // The composite driver/carrier foreign key refuses a driver from another
    // carrier, so an admin cannot write across a tenant boundary even if the
    // role check above were wrong.
    const [row] = body.data.id
      ? await db
          .update(driverAvailabilityBlocks)
          .set(values)
          .where(and(
            eq(driverAvailabilityBlocks.id, body.data.id),
            eq(driverAvailabilityBlocks.carrierId, carrierId),
            eq(driverAvailabilityBlocks.driverId, driverId),
          ))
          .returning()
      : await db.insert(driverAvailabilityBlocks).values(values).returning();

    if (!row) {
      return apiFailureResponse(
        new Error("not found"),
        requestId,
        "availability.write",
      );
    }
    return mergeResponseHeaders(
      apiSuccess(toAvailabilityBlock(row), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "availability.write");
  }
}

function toAvailabilityBlock(row: typeof driverAvailabilityBlocks.$inferSelect) {
  return {
    createdAt: row.createdAt.toISOString(),
    driverId: row.driverId,
    endsAt: row.endsAt.toISOString(),
    id: row.id,
    kind: row.kind,
    note: row.note,
    ruleId: row.ruleId,
    startsAt: row.startsAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
