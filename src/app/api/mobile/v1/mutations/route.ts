import { and, eq } from "drizzle-orm";
import { canTransitionShipmentStatus } from "@/app/api/carrier/_lib/validation";
import { db } from "@/lib/db/client";
import {
  driverLocations,
  drivers,
  driverStatusEvents,
  freightDocuments,
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
    await requireAccessibleShipment(transaction, principal, mutation.payload.shipmentId);
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

async function requireAccessibleShipment(
  transaction: Transaction,
  principal: MobilePrincipal,
  shipmentId: string,
): Promise<{ id: string }> {
  const [shipment] = await transaction
    .select({ id: shipments.id })
    .from(shipments)
    .where(and(eq(shipments.id, shipmentId), shipmentAccessPredicate(principal)));
  if (!shipment) throw new MobileApiError(404, "NOT_FOUND", "Shipment not found.");
  return shipment;
}

async function updateDriverDutyStatus(
  transaction: Transaction,
  principal: MobilePrincipal,
  mutation: Extract<OfflineMutation, { operation: "driver.duty_status.update" }>,
): Promise<JsonValue> {
  if (principal.role !== "driver" || !principal.driverId) {
    throw new MobileApiError(403, "ROLE_REQUIRED", "A linked driver role is required.");
  }
  if (mutation.payload.shipmentId) {
    await requireAccessibleShipment(transaction, principal, mutation.payload.shipmentId);
  }
  const recordedAt = new Date(mutation.occurredAt);
  const [event] = await transaction
    .insert(driverStatusEvents)
    .values({
      driverId: principal.driverId,
      shipmentId: mutation.payload.shipmentId,
      status: mutation.payload.status,
      recordedAt,
    })
    .returning({ id: driverStatusEvents.id });
  await transaction
    .update(drivers)
    .set({
      status: mutation.payload.status === "off_duty" || mutation.payload.status === "sleeper_berth"
        ? "off_duty"
        : "on_duty",
      updatedAt: new Date(),
    })
    .where(eq(drivers.id, principal.driverId));
  return { id: event.id, status: mutation.payload.status };
}

async function reportShipmentException(
  transaction: Transaction,
  principal: MobilePrincipal,
  mutation: Extract<OfflineMutation, { operation: "shipment.exception.report" }>,
): Promise<JsonValue> {
  if (principal.role === "customer") {
    throw new MobileApiError(403, "ROLE_REQUIRED", "Customers cannot report shipment exceptions.");
  }
  const shipment = await requireAccessibleShipment(
    transaction,
    principal,
    mutation.payload.shipmentId,
  );
  const [event] = await transaction
    .insert(shipmentEvents)
    .values({
      shipmentId: shipment.id,
      driverId: principal.driverId,
      eventType: "exception_reported",
      eventCode: mutation.payload.severity,
      statusReason: mutation.payload.category,
      notes: mutation.payload.description,
      recordedAt: new Date(mutation.occurredAt),
    })
    .returning({ id: shipmentEvents.id });
  return { id: event.id, shipmentId: shipment.id };
}

/** Verifies org ownership and links an uploaded document to its shipment. */
async function linkShipmentDocument(
  transaction: Transaction,
  principal: MobilePrincipal,
  shipmentId: string,
  documentId: string,
  kinds: readonly string[],
): Promise<{ id: string; storagePath: string }> {
  const [document] = await transaction
    .select({
      id: freightDocuments.id,
      kind: freightDocuments.kind,
      shipmentId: freightDocuments.shipmentId,
      storagePath: freightDocuments.storagePath,
    })
    .from(freightDocuments)
    .where(
      and(
        eq(freightDocuments.id, documentId),
        eq(freightDocuments.organizationId, principal.organizationId),
      ),
    );
  if (!document) throw new MobileApiError(404, "NOT_FOUND", "Document not found.");
  if (!kinds.includes(document.kind)) {
    throw new MobileApiError(
      400,
      "VALIDATION_ERROR",
      `Document kind ${document.kind} cannot be used for this operation.`,
    );
  }
  if (document.shipmentId && document.shipmentId !== shipmentId) {
    throw new MobileApiError(
      409,
      "CONFLICT",
      "The document is already linked to another shipment.",
    );
  }
  if (!document.shipmentId) {
    await transaction
      .update(freightDocuments)
      .set({ shipmentId, updatedAt: new Date() })
      .where(eq(freightDocuments.id, document.id));
  }
  return { id: document.id, storagePath: document.storagePath };
}

async function attachShipmentPhoto(
  transaction: Transaction,
  principal: MobilePrincipal,
  mutation: Extract<OfflineMutation, { operation: "shipment.photo.attach" }>,
): Promise<JsonValue> {
  if (principal.role === "customer") {
    throw new MobileApiError(403, "ROLE_REQUIRED", "Customers cannot attach shipment photos.");
  }
  const shipment = await requireAccessibleShipment(
    transaction,
    principal,
    mutation.payload.shipmentId,
  );
  const document = await linkShipmentDocument(
    transaction,
    principal,
    shipment.id,
    mutation.payload.documentId,
    ["photo", "damage_photo"],
  );
  const [event] = await transaction
    .insert(shipmentEvents)
    .values({
      shipmentId: shipment.id,
      driverId: principal.driverId,
      eventType: "photo_attached",
      photoUrls: [document.storagePath],
      recordedAt: new Date(mutation.occurredAt),
    })
    .returning({ id: shipmentEvents.id });
  return { id: document.id, eventId: event.id };
}

async function recordShipmentSignature(
  transaction: Transaction,
  principal: MobilePrincipal,
  mutation: Extract<OfflineMutation, { operation: "shipment.signature.record" }>,
): Promise<JsonValue> {
  if (principal.role === "customer") {
    throw new MobileApiError(403, "ROLE_REQUIRED", "Customers cannot record shipment signatures.");
  }
  const shipment = await requireAccessibleShipment(
    transaction,
    principal,
    mutation.payload.shipmentId,
  );
  const document = await linkShipmentDocument(
    transaction,
    principal,
    shipment.id,
    mutation.payload.documentId,
    ["signature"],
  );
  const [event] = await transaction
    .insert(shipmentEvents)
    .values({
      shipmentId: shipment.id,
      driverId: principal.driverId,
      eventType: "signature_recorded",
      signatureUrl: document.storagePath,
      recordedAt: new Date(mutation.occurredAt),
    })
    .returning({ id: shipmentEvents.id });
  return { id: document.id, eventId: event.id };
}

async function submitShipmentPod(
  transaction: Transaction,
  principal: MobilePrincipal,
  mutation: Extract<OfflineMutation, { operation: "shipment.pod.submit" }>,
): Promise<JsonValue> {
  if (principal.role === "customer") {
    throw new MobileApiError(403, "ROLE_REQUIRED", "Customers cannot submit proof of delivery.");
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
  if (!canTransitionShipmentStatus(current.status, "delivered")) {
    throw new MobileApiError(
      409,
      "CONFLICT",
      `Shipment cannot transition from ${current.status} to delivered.`,
    );
  }
  const signature = mutation.payload.signatureDocumentId
    ? await linkShipmentDocument(
      transaction,
      principal,
      current.id,
      mutation.payload.signatureDocumentId,
      ["signature"],
    )
    : null;
  const photos = mutation.payload.photoDocumentIds?.length
    ? await Promise.all(
      mutation.payload.photoDocumentIds.map((documentId) =>
        linkShipmentDocument(
          transaction,
          principal,
          current.id,
          documentId,
          ["photo", "damage_photo", "proof_of_delivery"],
        )),
    )
    : [];
  const recordedAt = new Date(mutation.occurredAt);
  await transaction
    .update(shipments)
    .set({ status: "delivered", deliveredAt: recordedAt, updatedAt: new Date() })
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
    eventCode: "delivered",
    statusReason: mutation.payload.recipientName,
    notes: mutation.payload.notes,
    photoUrls: photos.map((photo) => photo.storagePath),
    signatureUrl: signature?.storagePath,
    recordedAt,
  });
  return { id: current.id, status: "delivered" };
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
    case "driver.duty_status.update":
      return updateDriverDutyStatus(transaction, principal, mutation);
    case "shipment.exception.report":
      return reportShipmentException(transaction, principal, mutation);
    case "shipment.photo.attach":
      return attachShipmentPhoto(transaction, principal, mutation);
    case "shipment.signature.record":
      return recordShipmentSignature(transaction, principal, mutation);
    case "shipment.pod.submit":
      return submitShipmentPod(transaction, principal, mutation);
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
