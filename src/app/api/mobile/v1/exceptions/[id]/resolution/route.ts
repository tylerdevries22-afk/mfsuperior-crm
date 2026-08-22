import { and, eq } from "drizzle-orm";
import { outboxEvents, shipmentEvents } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { shipmentExceptionResolutionSchema } from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
} from "@/lib/mobile-api/http";
import { executeIdempotentMutation } from "@/lib/mobile-api/idempotency";
import {
  applyShipmentStatus,
  lockAccessibleShipment,
  parseRouteId,
  requireIdempotencyKey,
  type MobileTransaction,
} from "@/lib/mobile-api/shipment-mutations";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Exceptions are shipment events, so a resolution is a second event whose
 * `statusReason` carries the resolved exception id.
 */
async function loadOpenException(
  transaction: MobileTransaction,
  exceptionId: string,
): Promise<{ id: string; shipmentId: string }> {
  const [exception] = await transaction
    .select({ id: shipmentEvents.id, shipmentId: shipmentEvents.shipmentId })
    .from(shipmentEvents)
    .where(
      and(
        eq(shipmentEvents.id, exceptionId),
        eq(shipmentEvents.eventType, "exception_reported"),
      ),
    )
    .limit(1);
  if (!exception) {
    throw new MobileApiError(404, "NOT_FOUND", "Exception report not found.");
  }
  const [resolved] = await transaction
    .select({ id: shipmentEvents.id })
    .from(shipmentEvents)
    .where(
      and(
        eq(shipmentEvents.eventType, "exception_resolved"),
        eq(shipmentEvents.statusReason, exception.id),
      ),
    )
    .limit(1);
  if (resolved) {
    throw new MobileApiError(
      409,
      "CONFLICT",
      "This exception has already been resolved.",
    );
  }
  return exception;
}

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: {
      scope: "mobile.exceptions.resolve",
      limit: 30,
      windowMs: 60_000,
    },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const exceptionId = parseRouteId(
    (await context.params).id,
    requestId,
    "exception ID",
  );
  if (!exceptionId.success) return exceptionId.response;
  const body = await parseStrictJson(
    request,
    shipmentExceptionResolutionSchema,
    requestId,
  );
  if (!body.success) return body.response;
  const idempotency = requireIdempotencyKey(request, requestId);
  if (!idempotency.success) return idempotency.response;

  try {
    const result = await executeIdempotentMutation(
      {
        principal,
        idempotencyKey: idempotency.key,
        operation: "shipment.exception.resolve",
        payload: { exceptionId: exceptionId.id, ...body.data },
      },
      async (transaction) => {
        const exception = await loadOpenException(transaction, exceptionId.id);
        // Access is enforced through the shipment, never the event id alone.
        const shipment = await lockAccessibleShipment(
          transaction,
          principal,
          exception.shipmentId,
        );
        const recordedAt = new Date();
        const { eventId } = await applyShipmentStatus(
          transaction,
          principal,
          shipment,
          {
            eventType: "exception_resolved",
            nextStatus: body.data.resumeStatus,
            notes: body.data.resolutionNote,
            recordedAt,
            statusReason: exception.id,
          },
        );
        await transaction.insert(outboxEvents).values({
          organizationId: principal.organizationId,
          topic: "shipment.exception.resolved",
          aggregateType: "shipment",
          aggregateId: shipment.id,
          deduplicationKey: `shipment:${shipment.id}:exception:${exception.id}:resolved`,
          payload: {
            shipmentId: shipment.id,
            exceptionId: exception.id,
            status: body.data.resumeStatus,
          },
        });
        return {
          status: 200,
          data: {
            id: exception.id,
            shipmentId: shipment.id,
            status: body.data.resumeStatus,
            eventId,
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
    return apiFailureResponse(error, requestId, "exceptions.resolution");
  }
}
