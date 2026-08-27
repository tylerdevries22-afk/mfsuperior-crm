import { and, eq, gt, inArray, lt, ne, notInArray, sql, type SQL } from "drizzle-orm";

import {
  driverAvailabilityBlocks,
  driverAvailabilityRules,
  driverShifts,
  drivers,
  outboxEvents,
  scheduleSyncStatuses,
  shipments,
  shiftCoverageRequests,
} from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import type { MobilePrincipal } from "./authorize";
import { MobileApiError } from "./http";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const ACTIVE_SHIFT_STATUSES = ["scheduled", "confirmed", "in_progress"] as const;
const BLOCKING_KINDS = ["unavailable", "time_off"] as const;

export function shiftAccessPredicate(principal: MobilePrincipal): SQL {
  if (!principal.carrierId) return sql`false`;
  const tenant = eq(driverShifts.carrierId, principal.carrierId);
  return principal.role === "admin"
    ? tenant
    : principal.role === "driver" && principal.driverId
      ? and(tenant, eq(driverShifts.driverId, principal.driverId)) ?? sql`false`
      : sql`false`;
}

export function coverageAccessPredicate(principal: MobilePrincipal): SQL {
  if (!principal.carrierId) return sql`false`;
  const tenant = eq(shiftCoverageRequests.carrierId, principal.carrierId);
  return principal.role === "admin"
    ? tenant
    : principal.role === "driver" && principal.driverId
      ? and(
        tenant,
        sql`(${shiftCoverageRequests.fromDriverId} = ${principal.driverId} or ${shiftCoverageRequests.targetDriverId} = ${principal.driverId})`,
      ) ?? sql`false`
      : sql`false`;
}

export function syncAccessPredicate(principal: MobilePrincipal): SQL {
  if (!principal.carrierId) return sql`false`;
  const tenant = eq(scheduleSyncStatuses.carrierId, principal.carrierId);
  return principal.role === "admin"
    ? tenant
    : principal.role === "driver" && principal.driverId
      ? and(tenant, sql`exists (select 1 from driver_shifts where driver_shifts.id = ${scheduleSyncStatuses.shiftId} and driver_shifts.driver_id = ${principal.driverId})`) ?? sql`false`
      : sql`false`;
}

export async function requireShift(
  transaction: Transaction,
  principal: MobilePrincipal,
  shiftId: string,
) {
  const [shift] = await transaction
    .select()
    .from(driverShifts)
    .where(and(eq(driverShifts.id, shiftId), shiftAccessPredicate(principal)));
  if (!shift) throw new MobileApiError(404, "NOT_FOUND", "That driver shift could not be found.");
  return shift;
}

export async function requireEligibleDriver(
  transaction: Transaction,
  principal: MobilePrincipal,
  driverId: string,
  startsAt: Date,
  endsAt: Date,
  excludedShiftId?: string,
) {
  const [driver] = await transaction
    .select()
    .from(drivers)
    .where(and(eq(drivers.id, driverId), eq(drivers.carrierId, principal.carrierId ?? "")));
  if (!driver) throw new MobileApiError(404, "NOT_FOUND", "The selected driver could not be found.");
  if (driver.status === "suspended") {
    throw new MobileApiError(409, "CONFLICT", "The selected driver is suspended.");
  }

  const shiftFilters = [
    eq(driverShifts.carrierId, principal.carrierId ?? ""),
    eq(driverShifts.driverId, driverId),
    inArray(driverShifts.status, [...ACTIVE_SHIFT_STATUSES]),
    lt(driverShifts.startsAt, endsAt),
    gt(driverShifts.endsAt, startsAt),
  ];
  if (excludedShiftId) shiftFilters.push(ne(driverShifts.id, excludedShiftId));
  const [shiftConflict] = await transaction.select({ id: driverShifts.id }).from(driverShifts).where(and(...shiftFilters));
  if (shiftConflict) throw new MobileApiError(409, "CONFLICT", "The selected driver already has a shift in that window.");

  const [blockConflict] = await transaction
    .select({ id: driverAvailabilityBlocks.id })
    .from(driverAvailabilityBlocks)
    .where(and(
      eq(driverAvailabilityBlocks.carrierId, principal.carrierId ?? ""),
      eq(driverAvailabilityBlocks.driverId, driverId),
      inArray(driverAvailabilityBlocks.kind, [...BLOCKING_KINDS]),
      lt(driverAvailabilityBlocks.startsAt, endsAt),
      gt(driverAvailabilityBlocks.endsAt, startsAt),
    ));
  if (blockConflict) throw new MobileApiError(409, "CONFLICT", "The selected driver has blocked time in that window.");

  const [loadConflict] = await transaction
    .select({ id: shipments.id })
    .from(shipments)
    .where(and(
      eq(shipments.carrierId, principal.carrierId ?? ""),
      eq(shipments.driverId, driverId),
      notInArray(shipments.status, ["delivered", "cancelled"]),
      lt(shipments.estimatedPickupAt, endsAt),
      gt(shipments.estimatedDeliveryAt, startsAt),
    ));
  if (loadConflict) throw new MobileApiError(409, "CONFLICT", "The selected driver has a load in that window.");

  const rules = await transaction
    .select()
    .from(driverAvailabilityRules)
    .where(and(
      eq(driverAvailabilityRules.carrierId, principal.carrierId ?? ""),
      eq(driverAvailabilityRules.driverId, driverId),
      inArray(driverAvailabilityRules.kind, [...BLOCKING_KINDS]),
    ));
  if (rules.some((rule) => ruleBlocksWindow(rule, startsAt, endsAt))) {
    throw new MobileApiError(409, "CONFLICT", "The selected driver has a recurring blocked window.");
  }
  return driver;
}

export function toDriverShift(row: typeof driverShifts.$inferSelect) {
  return {
    createdAt: row.createdAt.toISOString(),
    driverId: row.driverId,
    endsAt: row.endsAt.toISOString(),
    id: row.id,
    note: row.note,
    startsAt: row.startsAt.toISOString(),
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCoverageRequest(row: typeof shiftCoverageRequests.$inferSelect) {
  return {
    createdAt: row.createdAt.toISOString(),
    fromDriverId: row.fromDriverId,
    id: row.id,
    requestedByAccountId: row.requestedByUserId,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    shiftId: row.shiftId,
    status: row.status,
    targetDriverId: row.targetDriverId,
  };
}

export function toScheduleSyncStatus(row: typeof scheduleSyncStatuses.$inferSelect) {
  return {
    attempts: row.attempts,
    entityId: row.shiftId,
    entityType: "shift" as const,
    id: row.id,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    lastError: row.lastError,
    provider: "target" as const,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function ensureSyncRow(
  transaction: Transaction,
  carrierId: string,
  shiftId: string,
) {
  const [row] = await transaction
    .insert(scheduleSyncStatuses)
    .values({ carrierId, shiftId, provider: "target", status: "pending", attempts: 0 })
    .onConflictDoUpdate({
      target: scheduleSyncStatuses.shiftId,
      set: { lastError: null, status: "pending", updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function enqueueScheduleSyncEvent(
  transaction: Transaction,
  organizationId: string,
  shift: typeof driverShifts.$inferSelect,
  action: "changed" | "removed" | "retry",
) {
  await transaction.insert(outboxEvents).values({
    aggregateId: shift.id,
    aggregateType: "driver_shift",
    deduplicationKey: `driver-shift:${shift.id}:${action}:${Date.now()}`,
    organizationId,
    payload: {
      action,
      driverId: shift.driverId,
      endsAt: shift.endsAt.toISOString(),
      shiftId: shift.id,
      startsAt: shift.startsAt.toISOString(),
      status: shift.status,
    },
    topic: "schedule.shift.sync",
  });
}

function ruleBlocksWindow(
  rule: typeof driverAvailabilityRules.$inferSelect,
  startsAt: Date,
  endsAt: Date,
): boolean {
  const cursor = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
  const last = new Date(endsAt.getFullYear(), endsAt.getMonth(), endsAt.getDate());
  for (let guard = 0; cursor <= last && guard < 370; guard += 1) {
    if (cursor.getDay() === rule.weekday) {
      const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      const blockedStart = new Date(dayStart.getTime() + rule.startMinute * 60_000);
      const blockedEnd = new Date(dayStart.getTime() + rule.endMinute * 60_000);
      if (rule.effectiveFrom <= blockedEnd && (!rule.effectiveUntil || rule.effectiveUntil >= dayStart) && blockedStart < endsAt && startsAt < blockedEnd) return true;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}
