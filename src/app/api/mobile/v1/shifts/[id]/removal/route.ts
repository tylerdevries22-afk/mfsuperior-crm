import { and, eq } from "drizzle-orm";

import { driverShifts } from "@/lib/db/schema";
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
import { enqueueScheduleSyncEvent } from "@/lib/mobile-api/schedule";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.shifts.remove", limit: 60, windowMs: 60_000 },
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
        operation: "driver.shift.remove",
        payload: { shiftId: shiftId.id },
      },
      async (transaction) => {
        const carrierId = requireAdmin(principal);
        const [existing] = await transaction
          .select()
          .from(driverShifts)
          .where(and(eq(driverShifts.id, shiftId.id), eq(driverShifts.carrierId, carrierId)))
          .for("update");
        if (!existing) {
          throw new MobileApiError(404, "NOT_FOUND", "That driver shift could not be found.");
        }
        const [removed] = await transaction
          .delete(driverShifts)
          .where(and(eq(driverShifts.id, shiftId.id), eq(driverShifts.carrierId, carrierId)))
          .returning({ id: driverShifts.id });
        if (!removed) {
          throw new MobileApiError(404, "NOT_FOUND", "That driver shift could not be found.");
        }
        await enqueueScheduleSyncEvent(transaction, principal.organizationId, existing, "removed");
        return { status: 200, data: { id: removed.id } };
      },
    );
    return mergeResponseHeaders(
      apiSuccess(result.data, requestId, { meta: { idempotencyReplayed: result.replayed } }),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "shifts.remove");
  }
}
