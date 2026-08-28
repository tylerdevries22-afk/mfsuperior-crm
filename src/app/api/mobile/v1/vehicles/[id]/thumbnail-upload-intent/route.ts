import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { vehicles } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { vehicleThumbnailUploadIntentSchema } from "@/lib/mobile-api/contracts";
import { requireAdmin } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
} from "@/lib/mobile-api/http";
import { parseRouteId } from "@/lib/mobile-api/shipment-mutations";
import {
  signVehicleThumbnailUpload,
  vehicleThumbnailPathFor,
  vehicleThumbnailUploadResponse,
} from "@/lib/mobile-api/upload-signer";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.vehicle_thumbnail_upload", limit: 20, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const vehicleId = parseRouteId((await context.params).id, requestId, "vehicle ID");
  if (!vehicleId.success) return vehicleId.response;
  const body = await parseStrictJson(request, vehicleThumbnailUploadIntentSchema, requestId);
  if (!body.success) return body.response;

  try {
    const carrierId = requireAdmin(principal);
    const [vehicle] = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.id, vehicleId.id), eq(vehicles.carrierId, carrierId)));
    if (!vehicle) {
      throw new MobileApiError(404, "NOT_FOUND", "That vehicle could not be found.");
    }

    const path = vehicleThumbnailPathFor(
      principal.organizationId,
      vehicle.id,
      body.data.fileName,
    );
    const signed = await signVehicleThumbnailUpload(path);
    return mergeResponseHeaders(
      apiSuccess(
        {
          path,
          upload: {
            ...vehicleThumbnailUploadResponse(signed),
            contentType: body.data.contentType,
          },
        },
        requestId,
      ),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "vehicles.thumbnail_upload_intent");
  }
}
