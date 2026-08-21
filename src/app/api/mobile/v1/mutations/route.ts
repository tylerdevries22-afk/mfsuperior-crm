import { and, eq } from "drizzle-orm";
import { canTransitionShipmentStatus } from "@/app/api/carrier/_lib/validation";
import { db } from "@/lib/db/client";
import {
  driverLocations,
  drivers,
  freightRequests,
  outboxEvents,
  shipmentEvents,
  shipments,
} from "@/lib/db/schema";
import { shipmentAccessPredicate } from "@/lib/mobile-api/access";
import {
  authorizeMobileRequest,
  type MobilePrincipal,
} from "@/lib/mobile-api/authorize";
import {
  offlineMutationBatchSchema,
  type FreightRequestCreate,
  type OfflineMutation,
} from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
} from "@/lib/mobile-api/http";
import {
  executeIdempotentMutation,
  type JsonValue,
} from "@/lib/mobile-api/idempotency";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function requestDates(payload: FreightRequestCreate) {
  const date = (value: string | null | undefined) =>
    value ? new Date(value) : null;
  return {
    pickupWindowStart: date(payload.pickupWindowStart),
    pickupWindowEnd: date(payload.pickupWindowEnd),
    deliveryWindowStart: date(payload.deliveryWindowStart),
    deliveryWindowEnd: date(payload.deliveryWindowEnd),
  };
}

async function createFreightRequest(
  transaction: Transaction,
  principal: MobilePrincipal,
  payload: FreightRequestCreate,
): Promise<JsonValue> {
  if (principal.role === "driver") {
    throw new MobileApiError(403, "ROLE_REQUIRED", "Drivers cannot create freight requests.");
  }
  const [created] = await transaction
    .insert(freightRequests)
    .values({
      organizationId: principal.organizationId,
      customerAccountId: principal.customerAccountId,
      createdByUserId: principal.userId,
      referenceNumber: payload.referenceNumber,
      origin: payload.origin,
      destination: payload.destination,
      ...requestDates(payload),
      commodity: payload.commodity,
      weightLbs: payload.weightLbs,
      palletCount: payload.palletCount,
      equipmentType: payload.equipmentType,
      notes: payload.notes,
    })
    .returning({ id: freightRequests.id, status: freightRequests.status });
  await transaction.insert(outboxEvents).values({
    organizationId: principal.organizationId,
    topic: "freight_request.created",
    aggregateType: "freight_request",
    aggregateId: created.id,
    deduplicationKey: `freight-request:${created.id}:created`,
    payload: { requestId: created.id },
  });
  return { id: created.id, status: created.status };
}

async function updateShipmentStatus(
  transaction: Transaction,
  principal: MobilePrincipal,
  mutation: Extract<OfflineMutation, { operation: "shipment.status.update" }>,
): Promise<JsonValue> {
  if (principal.role === "customer") {
    throw new MobileApiError(403, "ROLE_REQUIRED", "Customers cannot update shipment status.");
  }
  const [current] = await transaction
    .select({ id: shipments.id, status: shipments.status, driverId: shipments.driverId })
    .from(shipments)
    .where(
      and(
        eq(shipments.id, mutation.payload.shipmentId),
        shipmentAccessPredicate(principal),
      ),
    )
    .for("update");
  if (!current) throw new MobileApiError(404, "NOT_FOUND", "Shipment not found.");
  if (!canTransitionShipmentStatus(current.status, mutation.payload.status)) {
    throw new MobileApiError(
      409,
      "CONFLICT",
      `Shipment cannot transition from ${current.status} to ${mutation.payload.status}.`,
    );
  }
  const recordedAt = new Date(mutation.occurredAt);
  const timestamps = mutation.payload.status === "delivered"
    ? { deliveredAt: recordedAt }
    : mutation.payload.status === "in_transit"
      ? { pickedUpAt: recordedAt }
      : {};
  await transaction
    .update(shipments)
    .set({ status: mutation.payload.status, updatedAt: new Date(), ...timestamps })
    .where(
      and(
        eq(shipments.id, current.id),
        shipmentAccessPredicate(principal),
      ),
    );
  await transaction.insert(shipmentEvents).values({
    shipmentId: current.id,
    driverId: current.driverId,
    eventType: "status_changed",
    eventCode: mutation.payload.status,
    latitude: mutation.payload.latitude?.toString(),
    longitude: mutation.payload.longitude?.toString(),
    notes: mutation.payload.notes,
    recordedAt,
  });
  return { id: current.id, status: mutation.payload.status };
}

async function recordDriverLocation(
  transaction: Transaction,
  principal: MobilePrincipal,
  mutation: Extract<OfflineMutation, { operation: "driver.location.record" }>,
): Promise<JsonValue> {
  if (principal.role !== "driver" || !principal.driverId) {
    throw new MobileApiError(403, "ROLE_REQUIRED", "A linked driver role is required.");
  }
  if (mutation.payload.shipmentId) {
    const [shipment] = await transaction
      .select({ id: shipments.id })
      .from(shipments)
      .where(
        and(
          eq(shipments.id, mutation.payload.shipmentId),
          shipmentAccessPredicate(principal),
        ),
      );
    if (!shipment) throw new MobileApiError(404, "NOT_FOUND", "Shipment not found.");
  }
  const recordedAt = new Date(mutation.occurredAt);
  const [location] = await transaction
    .insert(driverLocations)
    .values({
      driverId: principal.driverId,
      shipmentId: mutation.payload.shipmentId,
      latitude: mutation.payload.latitude.toString(),
      longitude: mutation.payload.longitude.toString(),
      accuracy: mutation.payload.accuracy,
      speed: mutation.payload.speed,
      heading: mutation.payload.heading,
      batteryLevel: mutation.payload.batteryLevel,
      recordedAt,
    })
    .returning({ id: driverLocations.id });
  await transaction
    .update(drivers)
    .set({
      currentLat: mutation.payload.latitude.toString(),
      currentLng: mutation.payload.longitude.toString(),
      locationUpdatedAt: recordedAt,
      updatedAt: new Date(),
    })
    .where(eq(drivers.id, principal.driverId));
  return { id: location.id, recordedAt: recordedAt.toISOString() };
}

function executeMutation(
  transaction: Transaction,
  principal: MobilePrincipal,
  mutation: OfflineMutation,
): Promise<JsonValue> {
  switch (mutation.operation) {
    case "freight_request.create":
      return createFreightRequest(transaction, principal, mutation.payload);
    case "shipment.status.update":
      return updateShipmentStatus(transaction, principal, mutation);
    case "driver.location.record":
      return recordDriverLocation(transaction, principal, mutation);
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver", "customer"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.mutations", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const body = await parseStrictJson(
    request,
    offlineMutationBatchSchema,
    authorization.requestId,
  );
  if (!body.success) return body.response;

  try {
    const results: JsonValue[] = [];
    for (const mutation of body.data.mutations) {
      const result = await executeIdempotentMutation(
        {
          principal: authorization.principal,
          idempotencyKey: mutation.idempotencyKey,
          operation: mutation.operation,
          payload: mutation,
        },
        async (transaction) => ({
          status: 200,
          data: await executeMutation(
            transaction,
            authorization.principal,
            mutation,
          ),
        }),
      );
      results.push({
        idempotencyKey: mutation.idempotencyKey,
        operation: mutation.operation,
        replayed: result.replayed,
        result: result.data,
      });
    }
    return mergeResponseHeaders(
      apiSuccess({ results }, authorization.requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, authorization.requestId, "mutations.apply");
  }
}
