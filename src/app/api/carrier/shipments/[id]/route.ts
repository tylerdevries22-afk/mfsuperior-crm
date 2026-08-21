import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, drivers, shipmentEvents, shipments } from "@/lib/db/schema";
import {
  databaseErrorResponse,
  errorResponse,
  parseJsonBody,
  requireCarrierDispatcher,
  successResponse,
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

async function loadShipment(id: string) {
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
    .where(eq(shipments.id, id));
  if (!shipment) return null;

  const events = await db
    .select()
    .from(shipmentEvents)
    .where(eq(shipmentEvents.shipmentId, id))
    .orderBy(desc(shipmentEvents.recordedAt))
    .limit(200);
  return { ...shipment, events };
}

export async function GET(_request: Request, context: ShipmentContext) {
  const authorization = await requireCarrierDispatcher();
  if (!authorization.authorized) return authorization.response;
  const id = await validatedShipmentId(context);
  if (!id.success) {
    return errorResponse(400, {
      code: "VALIDATION_ERROR",
      message: "The shipment ID is invalid.",
    });
  }

  try {
    const shipment = await loadShipment(id.data);
    if (!shipment) {
      return errorResponse(404, {
        code: "NOT_FOUND",
        message: "Shipment not found.",
      });
    }
    return successResponse(shipment);
  } catch (error) {
    return databaseErrorResponse(error, "shipments.detail");
  }
}

async function updateShipment(
  id: string,
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
      .where(eq(shipments.id, id))
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
        .where(eq(drivers.id, update.driverId));
      if (!driver) return { kind: "driver_not_found" as const };
      if (current.carrierId && driver.carrierId !== current.carrierId) {
        return { kind: "carrier_mismatch" as const };
      }
      if (!current.carrierId) columnUpdate.carrierId = driver.carrierId;
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
      .where(eq(shipments.id, id))
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
  const authorization = await requireCarrierDispatcher();
  if (!authorization.authorized) return authorization.response;
  const id = await validatedShipmentId(context);
  if (!id.success) {
    return errorResponse(400, {
      code: "VALIDATION_ERROR",
      message: "The shipment ID is invalid.",
    });
  }
  const body = await parseJsonBody(request, shipmentUpdateSchema);
  if (!body.success) return body.response;

  try {
    const result = await updateShipment(
      id.data,
      body.data,
      authorization.principal.userId,
    );
    if (result.kind === "not_found") {
      return errorResponse(404, {
        code: "NOT_FOUND",
        message: "Shipment not found.",
      });
    }
    if (result.kind === "driver_not_found") {
      return errorResponse(404, {
        code: "NOT_FOUND",
        message: "The selected driver was not found.",
      });
    }
    if (result.kind === "carrier_mismatch") {
      return errorResponse(409, {
        code: "CONFLICT",
        message: "The selected driver belongs to a different carrier.",
      });
    }
    if (result.kind === "invalid_transition") {
      return errorResponse(409, {
        code: "CONFLICT",
        message: `Shipment cannot transition from ${result.current} to ${body.data.status}.`,
      });
    }
    return successResponse(result.shipment);
  } catch (error) {
    return databaseErrorResponse(error, "shipments.update");
  }
}
