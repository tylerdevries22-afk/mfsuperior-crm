import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, drivers, shipmentEvents, shipments } from "@/lib/db/schema";
import {
  databaseErrorResponse,
  errorResponse,
  parseJsonBody,
  requireCarrierAdmin,
  successResponse,
  withCarrierAuthHeaders,
} from "../../_lib/http";
import {
  canTransitionShipmentStatus,
  shipmentIdSchema,
  shipmentUpdateSchema,
  type ShipmentUpdate,
} from "../../_lib/validation";

type ShipmentContext = { params: Promise<{ id: string }> };

async function validatedShipmentId(context: ShipmentContext) {
  const { id } = await context.params;
  return shipmentIdSchema.safeParse(id);
}

async function loadShipment(id: string, carrierId: string) {
  const [shipment] = await db
    .select({
      id: shipments.id,
      carrierId: shipments.carrierId,
      driverId: shipments.driverId,
      targetLoadId: shipments.targetLoadId,
      targetPoNumber: shipments.targetPoNumber,
      bolNumber: shipments.bolNumber,
      proNumber: shipments.proNumber,
      scac: shipments.scac,
      origin: shipments.origin,
      destination: shipments.destination,
      intermediateStops: shipments.intermediateStops,
      commodity: shipments.commodity,
      weightLbs: shipments.weightLbs,
      palletCount: shipments.palletCount,
      equipmentType: shipments.equipmentType,
      specialInstructions: shipments.specialInstructions,
      rateCents: shipments.rateCents,
      fuelSurchargeCents: shipments.fuelSurchargeCents,
      accessorialsCents: shipments.accessorialsCents,
      status: shipments.status,
      statusCode: shipments.statusCode,
      estimatedPickupAt: shipments.estimatedPickupAt,
      estimatedDeliveryAt: shipments.estimatedDeliveryAt,
      pickedUpAt: shipments.pickedUpAt,
      deliveredAt: shipments.deliveredAt,
      source: shipments.source,
      createdAt: shipments.createdAt,
      updatedAt: shipments.updatedAt,
    })
    .from(shipments)
    .where(and(eq(shipments.id, id), eq(shipments.carrierId, carrierId)));
  if (!shipment) return null;

  const events = await db
    .select()
    .from(shipmentEvents)
    .where(eq(shipmentEvents.shipmentId, id))
    .orderBy(desc(shipmentEvents.recordedAt))
    .limit(200);
  return { ...shipment, events };
}

export async function GET(request: Request, context: ShipmentContext) {
  const authorization = await requireCarrierAdmin(request);
  if (!authorization.authorized) return authorization.response;
  const id = await validatedShipmentId(context);
  if (!id.success) {
    return errorResponse(
      400,
      {
        code: "VALIDATION_ERROR",
        message: "The shipment ID is invalid.",
      },
      authorization.requestId,
    );
  }

  try {
    const shipment = await loadShipment(
      id.data,
      authorization.principal.carrierId,
    );
    if (!shipment) {
      return errorResponse(
        404,
        { code: "NOT_FOUND", message: "Shipment not found." },
        authorization.requestId,
      );
    }
    return withCarrierAuthHeaders(
      successResponse(shipment, authorization.requestId),
      authorization,
    );
  } catch (error) {
    return databaseErrorResponse(
      error,
      "shipments.detail",
      authorization.requestId,
    );
  }
}

async function updateShipment(
  id: string,
  carrierId: string,
  update: ShipmentUpdate,
  actorUserId: string,
) {
  return db.transaction(async (transaction) => {
    const [current] = await transaction
      .select({
        carrierId: shipments.carrierId,
        driverId: shipments.driverId,
        status: shipments.status,
        estimatedPickupAt: shipments.estimatedPickupAt,
        estimatedDeliveryAt: shipments.estimatedDeliveryAt,
        pickedUpAt: shipments.pickedUpAt,
        deliveredAt: shipments.deliveredAt,
      })
      .from(shipments)
      .where(and(eq(shipments.id, id), eq(shipments.carrierId, carrierId)))
      .for("update");
    if (!current) return { kind: "not_found" as const };

    if (
      update.status &&
      !canTransitionShipmentStatus(current.status, update.status)
    ) {
      return { kind: "invalid_transition" as const, current: current.status };
    }

    const { notes, statusReason, ...requestedUpdate } = update;
    const columnUpdate: Partial<typeof shipments.$inferInsert> = requestedUpdate;
    if (typeof update.driverId === "string") {
      const [driver] = await transaction
        .select({ carrierId: drivers.carrierId })
        .from(drivers)
        .where(
          and(
            eq(drivers.id, update.driverId),
            eq(drivers.carrierId, carrierId),
          ),
        );
      if (!driver) return { kind: "driver_not_found" as const };
    }
    const now = new Date();
    if (
      update.status === "in_transit" &&
      current.pickedUpAt === null
    ) {
      columnUpdate.pickedUpAt = now;
    }
    if (
      update.status === "delivered" &&
      current.deliveredAt === null
    ) {
      columnUpdate.deliveredAt = now;
    }

    const [shipment] = await transaction
      .update(shipments)
      .set({ ...columnUpdate, updatedAt: now })
      .where(and(eq(shipments.id, id), eq(shipments.carrierId, carrierId)))
      .returning();

    if (update.status) {
      await transaction.insert(shipmentEvents).values({
        shipmentId: id,
        driverId: shipment.driverId,
        eventType: "status_changed",
        eventCode: update.statusCode,
        statusReason,
        notes,
        recordedAt: now,
      });
    }

    await transaction.insert(auditLog).values({
      actorUserId,
      entity: "shipment",
      entityId: id,
      action: "update",
      beforeJson: current,
      afterJson: { ...columnUpdate, notes, statusReason },
    });

    return { kind: "updated" as const, shipment };
  });
}

export async function PATCH(request: Request, context: ShipmentContext) {
  const authorization = await requireCarrierAdmin(request);
  if (!authorization.authorized) return authorization.response;
  const id = await validatedShipmentId(context);
  if (!id.success) {
    return errorResponse(
      400,
      {
        code: "VALIDATION_ERROR",
        message: "The shipment ID is invalid.",
      },
      authorization.requestId,
    );
  }
  const body = await parseJsonBody(
    request,
    shipmentUpdateSchema,
    authorization.requestId,
  );
  if (!body.success) return body.response;

  try {
    const result = await updateShipment(
      id.data,
      authorization.principal.carrierId,
      body.data,
      authorization.principal.userId,
    );
    if (result.kind === "not_found") {
      return errorResponse(
        404,
        { code: "NOT_FOUND", message: "Shipment not found." },
        authorization.requestId,
      );
    }
    if (result.kind === "driver_not_found") {
      return errorResponse(
        404,
        {
          code: "NOT_FOUND",
          message: "The selected driver was not found.",
        },
        authorization.requestId,
      );
    }
    if (result.kind === "invalid_transition") {
      return errorResponse(
        409,
        {
          code: "CONFLICT",
          message: `Shipment cannot transition from ${result.current} to ${body.data.status}.`,
        },
        authorization.requestId,
      );
    }
    return withCarrierAuthHeaders(
      successResponse(result.shipment, authorization.requestId),
      authorization,
    );
  } catch (error) {
    return databaseErrorResponse(
      error,
      "shipments.update",
      authorization.requestId,
    );
  }
}
