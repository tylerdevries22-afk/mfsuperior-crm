import { and, eq } from "drizzle-orm";
import { outboxEvents, shipmentEvents, shipments } from "@/lib/db/schema";
import { shipmentAccessPredicate } from "@/lib/mobile-api/access";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { shipmentAssignmentSchema } from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
} from "@/lib/mobile-api/http";
import { executeIdempotentMutation } from "@/lib/mobile-api/idempotency";
import {
  lockAccessibleShipment,
  parseRouteId,
  requireCarrierDriver,
  requireIdempotencyKey,
} from "@/lib/mobile-api/shipment-mutations";

type RouteContext = { params: Promise<{ id: string }> };

const ASSIGNABLE_STATUSES = new Set(["accepted", "dispatched"]);

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.shipments.assign", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const shipmentId = parseRouteId((await context.params).id, requestId, "shipment ID");
  if (!shipmentId.success) return shipmentId.response;
  const body = await parseStrictJson(request, shipmentAssignmentSchema, requestId);
  if (!body.success) return body.response;
  const idempotency = requireIdempotencyKey(request, requestId);
  if (!idempotency.success) return idempotency.response;

  try {
    const result = await executeIdempotentMutation(
      {
        principal,
        idempotencyKey: idempotency.key,
        operation: "shipment.driver.assign",
        payload: { shipmentId: shipmentId.id, ...body.data },
      },
      async (transaction) => {
        const shipment = await lockAccessibleShipment(
          transaction,
          principal,
          shipmentId.id,
        );
        if (!ASSIGNABLE_STATUSES.has(shipment.status)) {
          throw new MobileApiError(
            409,
            "CONFLICT",
            `A ${shipment.status} shipment cannot be reassigned.`,
          );
        }
        const driver = await requireCarrierDriver(
          transaction,
          principal,
          body.data.driverId,
        );
        const recordedAt = new Date();
        await transaction
          .update(shipments)
          .set({ driverId: driver.id, updatedAt: recordedAt })
          .where(
            and(
              eq(shipments.id, shipment.id),
              shipmentAccessPredicate(principal),
            ),
          );
        const [event] = await transaction
          .insert(shipmentEvents)
          .values({
            shipmentId: shipment.id,
            driverId: driver.id,
            eventType: "driver_assigned",
            statusReason: "assignment",
            notes: body.data.notes,
            recordedAt,
          })
          .returning({ id: shipmentEvents.id });
        await transaction.insert(outboxEvents).values({
          organizationId: principal.organizationId,
          topic: "shipment.driver.assigned",
          aggregateType: "shipment",
          aggregateId: shipment.id,
          deduplicationKey: `shipment:${shipment.id}:driver:${driver.id}`,
          payload: { shipmentId: shipment.id, driverId: driver.id },
        });
        return {
          status: 200,
          data: {
            id: shipment.id,
            driverId: driver.id,
            status: shipment.status,
            eventId: event.id,
          },
        };
      },
    );
    return mergeResponseHeaders(
      apiSuccess(result.data, requestId, {
        meta: { idempotencyReplayed: result.replayed },
      }),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "shipments.assignment");
  }
}
