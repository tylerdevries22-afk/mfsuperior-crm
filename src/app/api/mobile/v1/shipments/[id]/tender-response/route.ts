import { outboxEvents } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { shipmentTenderResponseSchema } from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  parseStrictJson,
} from "@/lib/mobile-api/http";
import { executeIdempotentMutation } from "@/lib/mobile-api/idempotency";
import {
  applyShipmentStatus,
  lockAccessibleShipment,
  parseRouteId,
  requireIdempotencyKey,
} from "@/lib/mobile-api/shipment-mutations";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.shipments.tender", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const shipmentId = parseRouteId((await context.params).id, requestId, "shipment ID");
  if (!shipmentId.success) return shipmentId.response;
  const body = await parseStrictJson(request, shipmentTenderResponseSchema, requestId);
  if (!body.success) return body.response;
  const idempotency = requireIdempotencyKey(request, requestId);
  if (!idempotency.success) return idempotency.response;

  try {
    const result = await executeIdempotentMutation(
      {
        principal,
        idempotencyKey: idempotency.key,
        operation: "shipment.tender.respond",
        payload: { shipmentId: shipmentId.id, ...body.data },
      },
      async (transaction) => {
        const shipment = await lockAccessibleShipment(
          transaction,
          principal,
          shipmentId.id,
        );
        const nextStatus = body.data.response === "accepted" ? "accepted" : "cancelled";
        const recordedAt = new Date();
        const { eventId } = await applyShipmentStatus(transaction, principal, shipment, {
          eventType: body.data.response === "accepted"
            ? "tender_accepted"
            : "tender_declined",
          nextStatus,
          notes: body.data.notes,
          recordedAt,
          statusReason: body.data.response,
        });
        await transaction.insert(outboxEvents).values({
          organizationId: principal.organizationId,
          topic: `shipment.tender.${body.data.response}`,
          aggregateType: "shipment",
          aggregateId: shipment.id,
          deduplicationKey: `shipment:${shipment.id}:tender:${body.data.response}`,
          payload: { shipmentId: shipment.id, status: nextStatus },
        });
        return {
          status: 200,
          data: { id: shipment.id, status: nextStatus, eventId },
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
    return apiFailureResponse(error, requestId, "shipments.tender-response");
  }
}
