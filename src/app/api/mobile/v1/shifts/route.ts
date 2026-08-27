import { and, asc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { driverShifts } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { availabilityQuerySchema, driverShiftWriteSchema } from "@/lib/mobile-api/contracts";
import { requireAdmin } from "@/lib/mobile-api/fleet-access";
import {
  enqueueScheduleSyncEvent,
  ensureSyncRow,
  requireEligibleDriver,
  requireShift,
  shiftAccessPredicate,
  toDriverShift,
} from "@/lib/mobile-api/schedule";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
  parseStrictQuery,
} from "@/lib/mobile-api/http";
import { executeIdempotentMutation } from "@/lib/mobile-api/idempotency";
import { requireIdempotencyKey } from "@/lib/mobile-api/shipment-mutations";

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
    const filters = [shiftAccessPredicate(principal)];
    if (query.data.driverId) filters.push(eq(driverShifts.driverId, query.data.driverId));
    if (query.data.from) filters.push(gte(driverShifts.endsAt, new Date(query.data.from)));
    if (query.data.to) filters.push(lte(driverShifts.startsAt, new Date(query.data.to)));
    const rows = await db.select().from(driverShifts).where(and(...filters)).orderBy(asc(driverShifts.startsAt)).limit(query.data.limit);
    return mergeResponseHeaders(apiSuccess(rows.map(toDriverShift), requestId), authorization.responseHeaders);
  } catch (error) {
    return apiFailureResponse(error, requestId, "shifts.list");
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.shifts.write", limit: 60, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const body = await parseStrictJson(request, driverShiftWriteSchema, requestId);
  if (!body.success) return body.response;
  const idempotency = requireIdempotencyKey(request, requestId);
  if (!idempotency.success) return idempotency.response;

  try {
    const result = await executeIdempotentMutation(
      { principal, idempotencyKey: idempotency.key, operation: "driver.shift.set", payload: body.data },
      async (transaction) => {
        const carrierId = requireAdmin(principal);
        const startsAt = new Date(body.data.startsAt);
        const endsAt = new Date(body.data.endsAt);
        const existing = body.data.id
          ? await requireShift(transaction, principal, body.data.id)
          : null;
        await requireEligibleDriver(transaction, principal, body.data.driverId, startsAt, endsAt, existing?.id);
        const [shift] = existing
          ? await transaction.update(driverShifts).set({
              driverId: body.data.driverId,
              endsAt,
              note: body.data.note ?? null,
              startsAt,
              status: body.data.status ?? existing.status,
              updatedAt: new Date(),
            }).where(and(eq(driverShifts.id, existing.id), eq(driverShifts.carrierId, carrierId))).returning()
          : await transaction.insert(driverShifts).values({
              carrierId,
              driverId: body.data.driverId,
              endsAt,
              note: body.data.note ?? null,
              startsAt,
              status: body.data.status ?? "scheduled",
            }).returning();
        if (!shift) throw new MobileApiError(404, "NOT_FOUND", "That driver shift could not be found.");
        await ensureSyncRow(transaction, carrierId, shift.id);
        await enqueueScheduleSyncEvent(transaction, principal.organizationId, shift, "changed");
        return { status: 200, data: { id: shift.id } };
      },
    );
    return mergeResponseHeaders(apiSuccess(result.data, requestId, { meta: { idempotencyReplayed: result.replayed } }), authorization.responseHeaders);
  } catch (error) {
    return apiFailureResponse(error, requestId, "shifts.write");
  }
}
