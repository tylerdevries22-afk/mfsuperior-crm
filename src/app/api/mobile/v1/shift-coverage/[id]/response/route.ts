import { and, eq } from "drizzle-orm";

import { driverShifts, shiftCoverageRequests } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { shiftCoverageResponseSchema } from "@/lib/mobile-api/contracts";
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
  enqueueScheduleSyncEvent,
  requireEligibleDriver,
  ensureSyncRow,
} from "@/lib/mobile-api/schedule";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.shift-coverage.response", limit: 60, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const coverageId = parseRouteId((await context.params).id, requestId, "coverage request ID");
  if (!coverageId.success) return coverageId.response;
  const body = await parseStrictJson(request, shiftCoverageResponseSchema, requestId);
  if (!body.success) return body.response;
  const idempotency = requireIdempotencyKey(request, requestId);
  if (!idempotency.success) return idempotency.response;

  try {
    const result = await executeIdempotentMutation(
      {
        principal,
        idempotencyKey: idempotency.key,
        operation: "driver.shift.coverage.respond",
        payload: { coverageId: coverageId.id, ...body.data },
      },
      async (transaction) => {
        const [coverage] = await transaction
          .select()
          .from(shiftCoverageRequests)
          .where(and(eq(shiftCoverageRequests.id, coverageId.id), coverageAccessPredicate(principal)))
          .for("update");
        if (!coverage) {
          throw new MobileApiError(404, "NOT_FOUND", "That coverage request could not be found.");
        }
        if (principal.role === "driver" && principal.driverId !== coverage.targetDriverId) {
          throw new MobileApiError(403, "ROLE_REQUIRED", "Only the requested driver can respond to coverage.");
        }
        if (coverage.status !== "pending") {
          throw new MobileApiError(409, "CONFLICT", "That coverage request has already been resolved.");
        }

        const [shift] = await transaction
          .select()
          .from(driverShifts)
          .where(and(
            eq(driverShifts.id, coverage.shiftId),
            eq(driverShifts.carrierId, coverage.carrierId),
          ))
          .for("update");
        if (!shift) {
          throw new MobileApiError(404, "NOT_FOUND", "The shift for this coverage request no longer exists.");
        }
        if (shift.driverId !== coverage.fromDriverId) {
          throw new MobileApiError(409, "CONFLICT", "The shift assignment changed before this request was answered.");
        }
        const respondedAt = new Date();
        if (body.data.response === "accepted") {
          if (shift.startsAt <= respondedAt) {
            throw new MobileApiError(409, "CONFLICT", "Coverage can only be accepted for a future shift.");
          }
          await requireEligibleDriver(
            transaction,
            principal,
            coverage.targetDriverId,
            shift.startsAt,
            shift.endsAt,
            shift.id,
          );
          await transaction
            .update(driverShifts)
            .set({ driverId: coverage.targetDriverId, updatedAt: respondedAt })
            .where(and(eq(driverShifts.id, shift.id), eq(driverShifts.carrierId, shift.carrierId)));
          await transaction
            .update(shiftCoverageRequests)
            .set({ respondedAt, status: "accepted" })
            .where(eq(shiftCoverageRequests.id, coverage.id));
          await transaction
            .update(shiftCoverageRequests)
            .set({ respondedAt, status: "closed" })
            .where(and(
              eq(shiftCoverageRequests.shiftId, shift.id),
              eq(shiftCoverageRequests.status, "pending"),
            ));
          await ensureSyncRow(transaction, shift.carrierId, shift.id);
          await enqueueScheduleSyncEvent(transaction, principal.organizationId, {
            ...shift,
            driverId: coverage.targetDriverId,
            updatedAt: respondedAt,
          }, "changed");
        } else {
          await transaction
            .update(shiftCoverageRequests)
            .set({ respondedAt, status: "declined" })
            .where(eq(shiftCoverageRequests.id, coverage.id));
        }
        return {
          status: 200,
          data: {
            driverId: body.data.response === "accepted" ? coverage.targetDriverId : shift.driverId,
            id: coverage.id,
            response: body.data.response,
            shiftId: shift.id,
          },
        };
      },
    );
    return mergeResponseHeaders(
      apiSuccess(result.data, requestId, { meta: { idempotencyReplayed: result.replayed } }),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "shift-coverage.response");
  }
}
