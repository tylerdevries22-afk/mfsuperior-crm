import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { maintenanceOrders, vehicles } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { maintenanceUpdateSchema } from "@/lib/mobile-api/contracts";
import { requireAdmin } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
} from "@/lib/mobile-api/http";
import { parseRouteId } from "@/lib/mobile-api/shipment-mutations";
import { toMaintenanceOrder } from "@/lib/mobile-api/route-serializers";

type RouteContext = { params: Promise<{ id: string }> };

const CLOSED = new Set(["completed", "cancelled"]);

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.maintenance.update", limit: 60, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const orderId = parseRouteId((await context.params).id, requestId, "work order ID");
  if (!orderId.success) return orderId.response;
  const body = await parseStrictJson(request, maintenanceUpdateSchema, requestId);
  if (!body.success) return body.response;

  try {
    const carrierId = requireAdmin(principal);
    const updated = await db.transaction(async (transaction) => {
      const [order] = await transaction
        .select()
        .from(maintenanceOrders)
        .where(and(
          eq(maintenanceOrders.id, orderId.id),
          eq(maintenanceOrders.carrierId, carrierId),
        ))
        .for("update");
      if (!order) {
        throw new MobileApiError(404, "NOT_FOUND", "That work order could not be found.");
      }
      if (CLOSED.has(order.status)) {
        throw new MobileApiError(
          409,
          "CONFLICT",
          "A closed work order cannot be changed. Open a new one instead.",
        );
      }

      const status = body.data.status ?? order.status;
      const [row] = await transaction
        .update(maintenanceOrders)
        .set({
          completedAt: status === "completed"
            ? body.data.completedAt ? new Date(body.data.completedAt) : new Date()
            : order.completedAt,
          costCents: body.data.costCents ?? order.costCents,
          description: body.data.description ?? order.description,
          scheduledFor: body.data.scheduledFor
            ? new Date(body.data.scheduledFor)
            : order.scheduledFor,
          severity: body.data.severity ?? order.severity,
          status,
          updatedAt: new Date(),
          vendorName: body.data.vendorName ?? order.vendorName,
        })
        .where(and(
          eq(maintenanceOrders.id, orderId.id),
          eq(maintenanceOrders.carrierId, carrierId),
        ))
        .returning();

      if (CLOSED.has(status)) {
        // Closing the last open order on a unit puts it back in service. Any
        // other still-open order keeps it down.
        const stillDown = await transaction
          .select({ id: maintenanceOrders.id })
          .from(maintenanceOrders)
          .where(and(
            eq(maintenanceOrders.vehicleId, order.vehicleId),
            eq(maintenanceOrders.carrierId, carrierId),
            ne(maintenanceOrders.id, order.id),
            ne(maintenanceOrders.status, "completed"),
            ne(maintenanceOrders.status, "cancelled"),
          ))
          .limit(1);

        if (stillDown.length === 0) {
          await transaction
            .update(vehicles)
            .set({ status: "active", updatedAt: new Date() })
            .where(and(
              eq(vehicles.id, order.vehicleId),
              eq(vehicles.carrierId, carrierId),
              ne(vehicles.status, "retired"),
            ));
        }
      }
      return row;
    });

    return mergeResponseHeaders(
      apiSuccess(toMaintenanceOrder(updated), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "maintenance.update");
  }
}
