import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { maintenanceOrders, vehicles } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { maintenanceCreateSchema, maintenanceQuerySchema } from "@/lib/mobile-api/contracts";
import { requireAdmin } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
  parseStrictQuery,
} from "@/lib/mobile-api/http";

/** Shop work orders. Carrier-scoped and admin-only. */
export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const query = parseStrictQuery(request, maintenanceQuerySchema, requestId);
  if (!query.success) return query.response;

  try {
    const carrierId = requireAdmin(principal);
    const filters = [eq(maintenanceOrders.carrierId, carrierId)];
    if (query.data.vehicleId) filters.push(eq(maintenanceOrders.vehicleId, query.data.vehicleId));
    if (query.data.status) filters.push(eq(maintenanceOrders.status, query.data.status));

    const rows = await db
      .select()
      .from(maintenanceOrders)
      .where(and(...filters))
      .orderBy(desc(maintenanceOrders.openedAt))
      .limit(query.data.limit);

    return mergeResponseHeaders(
      apiSuccess(rows.map(toMaintenanceOrder), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "maintenance.list");
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.maintenance.create", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const body = await parseStrictJson(request, maintenanceCreateSchema, requestId);
  if (!body.success) return body.response;

  try {
    const carrierId = requireAdmin(principal);
    const created = await db.transaction(async (transaction) => {
      const [vehicle] = await transaction
        .select()
        .from(vehicles)
        .where(and(eq(vehicles.id, body.data.vehicleId), eq(vehicles.carrierId, carrierId)))
        .for("update");
      if (!vehicle) {
        throw new MobileApiError(404, "NOT_FOUND", "That vehicle could not be found.");
      }

      const [order] = await transaction
        .insert(maintenanceOrders)
        .values({
          carrierId,
          costCents: body.data.costCents ?? null,
          description: body.data.description,
          kind: body.data.kind,
          odometerMiles: body.data.odometerMiles ?? vehicle.odometerMiles,
          reportedByDriverId: body.data.reportedByDriverId ?? null,
          scheduledFor: body.data.scheduledFor ? new Date(body.data.scheduledFor) : null,
          severity: body.data.severity,
          status: body.data.scheduledFor ? "scheduled" : "open",
          summary: body.data.summary,
          vehicleId: vehicle.id,
        })
        .returning();

      // A critical order grounds the unit and releases its driver in the same
      // transaction, so the fleet board and the dispatch board can never
      // disagree about whether the truck can run.
      if (body.data.severity === "critical") {
        await transaction
          .update(vehicles)
          .set({ assignedDriverId: null, status: "out_of_service", updatedAt: new Date() })
          .where(and(eq(vehicles.id, vehicle.id), eq(vehicles.carrierId, carrierId)));
      }
      return order;
    });

    return mergeResponseHeaders(
      apiSuccess(toMaintenanceOrder(created), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "maintenance.create");
  }
}

export function toMaintenanceOrder(row: typeof maintenanceOrders.$inferSelect) {
  return {
    completedAt: row.completedAt?.toISOString() ?? null,
    costCents: row.costCents,
    description: row.description,
    id: row.id,
    kind: row.kind,
    odometerMiles: row.odometerMiles,
    openedAt: row.openedAt.toISOString(),
    reportedByDriverId: row.reportedByDriverId,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    severity: row.severity,
    status: row.status,
    summary: row.summary,
    updatedAt: row.updatedAt.toISOString(),
    vehicleId: row.vehicleId,
  };
}
