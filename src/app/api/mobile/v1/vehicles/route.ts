import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { vehicles } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { vehicleQuerySchema, vehicleWriteSchema } from "@/lib/mobile-api/contracts";
import { requireAdmin, vehicleAccessPredicate } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
  parseStrictQuery,
} from "@/lib/mobile-api/http";
import { toVehicle } from "@/lib/mobile-api/route-serializers";
import { signVehicleThumbnailReads } from "@/lib/mobile-api/upload-signer";

/** The fleet register. Carrier-scoped and admin-only. */
export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const query = parseStrictQuery(request, vehicleQuerySchema, requestId);
  if (!query.success) return query.response;

  try {
    const filters = [vehicleAccessPredicate(principal)];
    if (query.data.status) filters.push(eq(vehicles.status, query.data.status));
    if (query.data.type) filters.push(eq(vehicles.type, query.data.type));

    const rows = await db
      .select()
      .from(vehicles)
      .where(and(...filters))
      .orderBy(asc(vehicles.unitNumber))
      .limit(query.data.limit);
    const thumbnailUrls = await signVehicleThumbnailReads(
      rows.flatMap((row) => row.thumbnailPath ? [row.thumbnailPath] : []),
    );

    return mergeResponseHeaders(
      apiSuccess(
        rows.map((row) => toVehicle(
          row,
          row.thumbnailPath ? thumbnailUrls.get(row.thumbnailPath) ?? null : null,
        )),
        requestId,
      ),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "vehicles.list");
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.vehicles.write", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const body = await parseStrictJson(request, vehicleWriteSchema, requestId);
  if (!body.success) return body.response;

  try {
    const carrierId = requireAdmin(principal);
    const values = {
      assignedDriverId: body.data.assignedDriverId ?? null,
      carrierId,
      make: body.data.make,
      model: body.data.model,
      odometerMiles: body.data.odometerMiles,
      plateNumber: body.data.plateNumber,
      plateState: body.data.plateState,
      status: body.data.status,
      type: body.data.type,
      unitNumber: body.data.unitNumber,
      updatedAt: new Date(),
      vin: body.data.vin,
      year: body.data.year,
    };

    // A duplicate unit number or VIN raises 23505, which apiFailureResponse
    // maps to a 409 rather than leaking the constraint name.
    const [row] = body.data.id
      ? await db
          .update(vehicles)
          .set(values)
          .where(and(eq(vehicles.id, body.data.id), eq(vehicles.carrierId, carrierId)))
          .returning()
      : await db.insert(vehicles).values(values).returning();

    if (!row) {
      throw new MobileApiError(404, "NOT_FOUND", "That vehicle could not be found.");
    }
    return mergeResponseHeaders(
      apiSuccess(toVehicle(row), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "vehicles.write");
  }
}
