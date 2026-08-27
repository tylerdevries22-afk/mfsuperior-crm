import { and, eq } from "drizzle-orm";

import { scheduleSyncStatuses } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { requireAdmin } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
} from "@/lib/mobile-api/http";
import { executeIdempotentMutation } from "@/lib/mobile-api/idempotency";
import { parseRouteId, requireIdempotencyKey } from "@/lib/mobile-api/shipment-mutations";
import { enqueueScheduleSyncEvent, ensureSyncRow, requireShift } from "@/lib/mobile-api/schedule";

type RouteContext = { params: Promise<{ id: string }> };

const TARGET_NOT_CONFIGURED = "Target credentials are not configured yet.";

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.schedule-sync.retry", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const shiftId = parseRouteId((await context.params).id, requestId, "shift ID");
  if (!shiftId.success) return shiftId.response;
  const idempotency = requireIdempotencyKey(request, requestId);
  if (!idempotency.success) return idempotency.response;

  try {
    const result = await executeIdempotentMutation(
      {
        principal,
        idempotencyKey: idempotency.key,
        operation: "schedule-sync.retry",
        payload: { shiftId: shiftId.id },
      },
      async (transaction) => {
        const carrierId = requireAdmin(principal);
        const shift = await requireShift(transaction, principal, shiftId.id);
        const existing = await ensureSyncRow(transaction, carrierId, shift.id);
        const [row] = await transaction
          .update(scheduleSyncStatuses)
          .set({
            attempts: existing.attempts + 1,
            lastAttemptAt: new Date(),
            lastError: TARGET_NOT_CONFIGURED,
            status: "pending",
            updatedAt: new Date(),
          })
          .where(and(
            eq(scheduleSyncStatuses.shiftId, shift.id),
            eq(scheduleSyncStatuses.carrierId, carrierId),
          ))
          .returning({ id: scheduleSyncStatuses.id });
        if (!row) {
          throw new MobileApiError(500, "INTERNAL_ERROR", "The sync status could not be updated.");
        }
        await enqueueScheduleSyncEvent(transaction, principal.organizationId, shift, "retry");
        return { status: 200, data: { id: row.id, status: "pending" as const } };
      },
    );
    return mergeResponseHeaders(
      apiSuccess(result.data, requestId, { meta: { idempotencyReplayed: result.replayed } }),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "schedule-sync.retry");
  }
}
