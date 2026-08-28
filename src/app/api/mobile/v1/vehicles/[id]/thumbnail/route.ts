import { and, eq } from "drizzle-orm";
import { vehicles } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { vehicleThumbnailFinalizeSchema } from "@/lib/mobile-api/contracts";
import { requireAdmin } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
} from "@/lib/mobile-api/http";
import { executeIdempotentMutation } from "@/lib/mobile-api/idempotency";
import { parseRouteId } from "@/lib/mobile-api/shipment-mutations";
import { toVehicle } from "@/lib/mobile-api/route-serializers";
import {
  signVehicleThumbnailReads,
  vehicleThumbnailPathBelongsTo,
} from "@/lib/mobile-api/upload-signer";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.vehicle_thumbnail_finalize", limit: 20, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const vehicleId = parseRouteId((await context.params).id, requestId, "vehicle ID");
  if (!vehicleId.success) return vehicleId.response;
  const body = await parseStrictJson(request, vehicleThumbnailFinalizeSchema, requestId);
  if (!body.success) return body.response;
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) {
    return apiFailureResponse(
      new MobileApiError(400, "VALIDATION_ERROR", "An Idempotency-Key header is required."),
      requestId,
      "vehicles.thumbnail_finalize",
    );
  }

  try {
    const carrierId = requireAdmin(principal);
    const result = await executeIdempotentMutation(
      {
        idempotencyKey,
        operation: "vehicle.thumbnail.finalize",
        payload: body.data,
        principal,
      },
      async (transaction) => {
        if (!vehicleThumbnailPathBelongsTo(body.data.path, principal.organizationId, vehicleId.id)) {
          throw new MobileApiError(400, "VALIDATION_ERROR", "That vehicle image path is invalid.");
        }
        const [updated] = await transaction
          .update(vehicles)
          .set({ thumbnailPath: body.data.path, updatedAt: new Date() })
          .where(and(eq(vehicles.id, vehicleId.id), eq(vehicles.carrierId, carrierId)))
          .returning();
        if (!updated) {
          throw new MobileApiError(404, "NOT_FOUND", "That vehicle could not be found.");
        }
        return { status: 200, data: { id: updated.id, vehicle: toVehicle(updated) } };
      },
    );
    const thumbnailUrls = await signVehicleThumbnailReads([body.data.path]);
    return mergeResponseHeaders(
      apiSuccess(
        { ...result.data.vehicle, thumbnailUrl: thumbnailUrls.get(body.data.path) ?? null },
        requestId,
        { meta: { idempotencyReplayed: result.replayed } },
      ),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "vehicles.thumbnail_finalize");
  }
}
