import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  canTransitionShipmentStatus,
  shipmentStatuses,
} from "@/app/api/carrier/_lib/validation";
import { db } from "@/lib/db/client";
import { drivers, shipmentEvents, shipments } from "@/lib/db/schema";
import { shipmentAccessPredicate } from "./access";
import type { MobilePrincipal } from "./authorize";
import { apiError, MobileApiError } from "./http";
import { idempotencyKeySchema } from "./contracts";

export type MobileTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];
type Transaction = MobileTransaction;
type ShipmentStatus = (typeof shipmentStatuses)[number];

export type LockedShipment = {
  id: string;
  status: ShipmentStatus;
  driverId: string | null;
  carrierId: string | null;
};

export const shipmentIdParamSchema = z.uuid();

/**
 * Selects a shipment the principal may write to and holds the row for the
 * duration of the transaction, so concurrent status writes cannot interleave.
 */
export async function lockAccessibleShipment(
  transaction: Transaction,
  principal: MobilePrincipal,
  shipmentId: string,
): Promise<LockedShipment> {
  const [shipment] = await transaction
    .select({
      id: shipments.id,
      status: shipments.status,
      driverId: shipments.driverId,
      carrierId: shipments.carrierId,
    })
    .from(shipments)
    .where(and(eq(shipments.id, shipmentId), shipmentAccessPredicate(principal)))
    .for("update");
  if (!shipment) {
    throw new MobileApiError(404, "NOT_FOUND", "Shipment not found.");
  }
  return shipment;
}

/** Applies a guarded status change and records the matching lifecycle event. */
export async function applyShipmentStatus(
  transaction: Transaction,
  principal: MobilePrincipal,
  shipment: LockedShipment,
  input: {
    nextStatus: ShipmentStatus;
    eventType: string;
    statusReason?: string | null;
    notes?: string | null;
    recordedAt: Date;
  },
): Promise<{ eventId: string }> {
  if (!canTransitionShipmentStatus(shipment.status, input.nextStatus)) {
    throw new MobileApiError(
      409,
      "CONFLICT",
      `Shipment cannot transition from ${shipment.status} to ${input.nextStatus}.`,
    );
  }
  // First pickup and first delivery win, so resuming after an exception can
  // never rewrite the original lifecycle timestamps.
  const timestamps = input.nextStatus === "delivered"
    ? { deliveredAt: sql`coalesce(${shipments.deliveredAt}, ${input.recordedAt})` }
    : input.nextStatus === "in_transit"
      ? { pickedUpAt: sql`coalesce(${shipments.pickedUpAt}, ${input.recordedAt})` }
      : {};
  await transaction
    .update(shipments)
    .set({ status: input.nextStatus, updatedAt: new Date(), ...timestamps })
    .where(
      and(eq(shipments.id, shipment.id), shipmentAccessPredicate(principal)),
    );
  const [event] = await transaction
    .insert(shipmentEvents)
    .values({
      shipmentId: shipment.id,
      driverId: shipment.driverId,
      eventType: input.eventType,
      eventCode: input.nextStatus,
      statusReason: input.statusReason,
      notes: input.notes,
      recordedAt: input.recordedAt,
    })
    .returning({ id: shipmentEvents.id });
  return { eventId: event.id };
}

/** Confirms the driver belongs to the principal's carrier before assignment. */
export async function requireCarrierDriver(
  transaction: Transaction,
  principal: MobilePrincipal,
  driverId: string,
): Promise<{ id: string }> {
  if (!principal.carrierId) {
    throw new MobileApiError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "The organization carrier profile is not configured.",
    );
  }
  const [driver] = await transaction
    .select({ id: drivers.id })
    .from(drivers)
    .where(
      and(eq(drivers.id, driverId), eq(drivers.carrierId, principal.carrierId)),
    )
    .limit(1);
  if (!driver) {
    throw new MobileApiError(
      404,
      "NOT_FOUND",
      "The driver is not part of this carrier.",
    );
  }
  return driver;
}

export type IdempotencyKeyResult =
  | { success: true; key: string }
  | { success: false; response: Response };

/** Every online mutation route requires a client-supplied safe retry key. */
export function requireIdempotencyKey(
  request: Request,
  requestId: string,
): IdempotencyKeyResult {
  const parsed = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (parsed.success) return { success: true, key: parsed.data };
  return {
    success: false,
    response: apiError(
      400,
      {
        code: "VALIDATION_ERROR",
        message: "A valid Idempotency-Key header is required.",
      },
      requestId,
    ),
  };
}

export type RouteIdResult =
  | { success: true; id: string }
  | { success: false; response: Response };

export function parseRouteId(
  value: string,
  requestId: string,
  label: string,
): RouteIdResult {
  const parsed = shipmentIdParamSchema.safeParse(value);
  if (parsed.success) return { success: true, id: parsed.data };
  return {
    success: false,
    response: apiError(
      400,
      { code: "VALIDATION_ERROR", message: `The ${label} is invalid.` },
      requestId,
    ),
  };
}
