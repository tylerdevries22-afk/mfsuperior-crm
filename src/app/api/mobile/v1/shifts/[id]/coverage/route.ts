import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { driverShifts, shiftCoverageRequests } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { shiftCoverageRequestSchema } from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
} from "@/lib/mobile-api/http";
import { executeIdempotentMutation } from "@/lib/mobile-api/idempotency";
import { parseRouteId, requireIdempotencyKey } from "@/lib/mobile-api/shipment-mutations";
import {
  coverageAccessPredicate,
  requireEligibleDriver,
  shiftAccessPredicate,
  toCoverageRequest,
} from "@/lib/mobile-api/schedule";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.shift-coverage.write", limit: 60, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const shiftId = parseRouteId((await context.params).id, requestId, "shift ID");
  if (!shiftId.success) return shiftId.response;
  const body = await parseStrictJson(request, shiftCoverageRequestSchema, requestId);
  if (!body.success) return body.response;
  const idempotency = requireIdempotencyKey(request, requestId);
  if (!idempotency.success) return idempotency.response;

  try {
    const result = await executeIdempotentMutation(
      {
        principal,
        idempotencyKey: idempotency.key,
        operation: "driver.shift.coverage.request",
        payload: { shiftId: shiftId.id, ...body.data },
      },
      async (transaction) => {
        const [shift] = await transaction
          .select()
          .from(driverShifts)
          .where(and(eq(driverShifts.id, shiftId.id), shiftAccessPredicate(principal)))
          .for("update");
        if (!shift) {
          throw new MobileApiError(404, "NOT_FOUND", "That driver shift could not be found.");
        }
        const coverable = shift.status === "scheduled"
          || shift.status === "confirmed"
          || shift.status === "in_progress";
        if (!coverable) {
          throw new MobileApiError(409, "CONFLICT", "Only an active scheduled shift can be covered.");
        }
        if (shift.startsAt <= new Date()) {
          throw new MobileApiError(409, "CONFLICT", "Coverage can only be requested for a future shift.");
        }
        if (principal.role === "driver" && principal.driverId !== shift.driverId) {
          throw new MobileApiError(403, "ROLE_REQUIRED", "A driver can only request coverage for their own shift.");
        }
        if (body.data.targetDriverId === shift.driverId) {
          throw new MobileApiError(409, "CONFLICT", "The current driver cannot be a coverage target.");
        }

        await requireEligibleDriver(
          transaction,
          principal,
          body.data.targetDriverId,
          shift.startsAt,
          shift.endsAt,
          shift.id,
        );
        const [existing] = await transaction
          .select({ id: shiftCoverageRequests.id })
          .from(shiftCoverageRequests)
          .where(and(
            eq(shiftCoverageRequests.shiftId, shift.id),
            eq(shiftCoverageRequests.targetDriverId, body.data.targetDriverId),
            eq(shiftCoverageRequests.status, "pending"),
          ))
          .limit(1);
        if (existing) {
          throw new MobileApiError(409, "CONFLICT", "A coverage request is already waiting for that driver.");
        }

        const [row] = await transaction
          .insert(shiftCoverageRequests)
          .values({
            carrierId: shift.carrierId,
            fromDriverId: shift.driverId,
            requestedByUserId: principal.userId,
            shiftId: shift.id,
            targetDriverId: body.data.targetDriverId,
          })
          .returning({ id: shiftCoverageRequests.id });
        return { status: 200, data: { id: row.id } };
      },
    );
    return mergeResponseHeaders(
      apiSuccess(result.data, requestId, { meta: { idempotencyReplayed: result.replayed } }),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "shift-coverage.write");
  }
}

export async function GET(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver"],
    requireCarrier: true,
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const shiftId = parseRouteId((await context.params).id, requestId, "shift ID");
  if (!shiftId.success) return shiftId.response;

  try {
    const rows = await db
      .select()
      .from(shiftCoverageRequests)
      .where(and(
        eq(shiftCoverageRequests.shiftId, shiftId.id),
        coverageAccessPredicate(principal),
      ))
      .orderBy(desc(shiftCoverageRequests.createdAt));
    return mergeResponseHeaders(
      apiSuccess(rows.map(toCoverageRequest), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "shift-coverage.shift-list");
  }
}
