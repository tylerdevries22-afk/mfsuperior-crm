import { and, asc, eq, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  driverPayoutLineItems,
  driverPayoutMethods,
  driverPayouts,
  maintenanceOrders,
  vehicles,
} from "@/lib/db/schema";
import { vehicleThumbnailPublicUrl } from "./upload-signer";

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

export function toPayoutMethod(row: typeof driverPayoutMethods.$inferSelect) {
  return {
    createdAt: row.createdAt.toISOString(),
    driverId: row.driverId,
    handle: row.handle,
    id: row.id,
    isDefault: row.isDefault,
    label: row.label,
    rail: row.rail,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listOwnPayoutMethods(driverId: string) {
  const rows = await db
    .select()
    .from(driverPayoutMethods)
    .where(eq(driverPayoutMethods.driverId, driverId))
    .orderBy(asc(driverPayoutMethods.rail));
  return rows.map(toPayoutMethod);
}

export function ownPayoutMethodPredicate(driverId: string, methodId: string): SQL {
  return and(
    eq(driverPayoutMethods.id, methodId),
    eq(driverPayoutMethods.driverId, driverId),
  ) ?? eq(driverPayoutMethods.id, methodId);
}

export function toPayout(
  row: typeof driverPayouts.$inferSelect,
  lineItems: readonly (typeof driverPayoutLineItems.$inferSelect)[],
) {
  return {
    createdAt: row.createdAt.toISOString(),
    deductionCents: row.deductionCents,
    driverId: row.driverId,
    grossCents: row.grossCents,
    id: row.id,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    lineItems: lineItems
      .filter((lineItem) => lineItem.payoutId === row.id)
      .map((lineItem) => ({
        amountCents: lineItem.amountCents,
        description: lineItem.description,
        id: lineItem.id,
        kind: lineItem.kind,
        shipmentId: lineItem.shipmentId,
      })),
    netCents: row.netCents,
    paidAt: row.paidAt?.toISOString() ?? null,
    periodEnd: row.periodEnd.toISOString(),
    periodStart: row.periodStart.toISOString(),
    rail: row.rail,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toVehicle(row: typeof vehicles.$inferSelect) {
  return {
    assignedDriverId: row.assignedDriverId,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    make: row.make,
    model: row.model,
    odometerMiles: row.odometerMiles,
    plateNumber: row.plateNumber,
    plateState: row.plateState,
    status: row.status,
    thumbnailUrl: row.thumbnailPath ? vehicleThumbnailPublicUrl(row.thumbnailPath) : null,
    type: row.type,
    unitNumber: row.unitNumber,
    updatedAt: row.updatedAt.toISOString(),
    vin: row.vin,
    year: row.year,
  };
}
