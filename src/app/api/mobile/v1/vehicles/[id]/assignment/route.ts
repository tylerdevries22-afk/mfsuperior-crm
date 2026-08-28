import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { vehicles } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { vehicleAssignmentSchema } from "@/lib/mobile-api/contracts";
import { requireAdmin } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
} from "@/lib/mobile-api/http";
import { parseRouteId, requireCarrierDriver } from "@/lib/mobile-api/shipment-mutations";
import { toVehicle } from "@/lib/mobile-api/route-serializers";
import { signVehicleThumbnailReads } from "@/lib/mobile-api/upload-signer";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.vehicles.assign", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const vehicleId = parseRouteId((await context.params).id, requestId, "vehicle ID");
  if (!vehicleId.success) return vehicleId.response;
  const body = await parseStrictJson(request, vehicleAssignmentSchema, requestId);
  if (!body.success) return body.response;

  try {
    const carrierId = requireAdmin(principal);
    const updated = await db.transaction(async (transaction) => {
      const [vehicle] = await transaction
        .select()
        .from(vehicles)
        .where(and(eq(vehicles.id, vehicleId.id), eq(vehicles.carrierId, carrierId)))
        .for("update");
      if (!vehicle) {
        throw new MobileApiError(404, "NOT_FOUND", "That vehicle could not be found.");
      }

      if (body.data.driverId) {
        // Confirms the driver belongs to this carrier before the composite
        // foreign key would refuse it, so the caller gets a clear 404 rather
        // than an opaque conflict.
        await requireCarrierDriver(transaction, principal, body.data.driverId);
        if (vehicle.status === "in_shop" || vehicle.status === "out_of_service") {
          throw new MobileApiError(
            409,
            "CONFLICT",
            `Unit ${vehicle.unitNumber} is ${vehicle.status === "in_shop" ? "in the shop" : "out of service"} and cannot be assigned.`,
          );
        }
      }

      const [row] = await transaction
        .update(vehicles)
        .set({ assignedDriverId: body.data.driverId, updatedAt: new Date() })
        .where(and(eq(vehicles.id, vehicleId.id), eq(vehicles.carrierId, carrierId)))
        .returning();
      return row;
    });

    const thumbnailUrls = await signVehicleThumbnailReads(
      updated.thumbnailPath ? [updated.thumbnailPath] : [],
    );
    return mergeResponseHeaders(
      apiSuccess(toVehicle(
        updated,
        updated.thumbnailPath ? thumbnailUrls.get(updated.thumbnailPath) ?? null : null,
      ), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "vehicles.assign");
  }
}
