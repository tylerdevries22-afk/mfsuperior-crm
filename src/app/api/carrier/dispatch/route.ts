import { and, asc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { drivers, shipments } from "@/lib/db/schema";
import {
  databaseErrorResponse,
  requireCarrierAdmin,
  successResponse,
} from "../_lib/http";

/**
 * Dispatch board: every truck with the runs currently on it, plus the runs
 * nobody is on yet.
 *
 * The drivers endpoint answers "who is in the fleet"; this one answers "who is
 * hauling what for whom", which is the question the board is on screen to
 * settle. Each run carries its `partnerSlug` so the board can show whose
 * freight is on which truck at a glance.
 */

const CLOSED_STATUSES: Array<"delivered" | "cancelled"> = [
  "delivered",
  "cancelled",
];

const RUN_COLUMNS = {
  id: shipments.id,
  driverId: shipments.driverId,
  partnerSlug: shipments.partnerSlug,
  targetLoadId: shipments.targetLoadId,
  bolNumber: shipments.bolNumber,
  status: shipments.status,
  origin: shipments.origin,
  destination: shipments.destination,
  commodity: shipments.commodity,
  rateCents: shipments.rateCents,
  equipmentType: shipments.equipmentType,
  estimatedPickupAt: shipments.estimatedPickupAt,
  estimatedDeliveryAt: shipments.estimatedDeliveryAt,
} as const;

type Run = {
  [K in keyof typeof RUN_COLUMNS]: (typeof shipments.$inferSelect)[K];
};

async function loadBoard() {
  const fleet = await db
    .select({
      id: drivers.id,
      firstName: drivers.firstName,
      lastName: drivers.lastName,
      status: drivers.status,
      phone: drivers.phone,
      currentLat: drivers.currentLat,
      currentLng: drivers.currentLng,
      locationUpdatedAt: drivers.locationUpdatedAt,
    })
    .from(drivers)
    .orderBy(asc(drivers.lastName), asc(drivers.firstName))
    .limit(200);

  const driverIds = fleet.map((driver) => driver.id);

  const [assigned, unassigned]: [Run[], Run[]] = await Promise.all([
    driverIds.length
      ? db
          .select(RUN_COLUMNS)
          .from(shipments)
          .where(
            and(
              inArray(shipments.driverId, driverIds),
              notInArray(shipments.status, CLOSED_STATUSES),
            ),
          )
          .orderBy(asc(shipments.estimatedDeliveryAt))
          .limit(500)
      : Promise.resolve([]),
    db
      .select(RUN_COLUMNS)
      .from(shipments)
      .where(
        and(eq(shipments.status, "tendered"), isNull(shipments.driverId)),
      )
      .orderBy(asc(shipments.estimatedPickupAt))
      .limit(100),
  ]);

  const runsByDriver = new Map<string, Run[]>();
  for (const run of assigned) {
    if (!run.driverId) continue;
    const existing = runsByDriver.get(run.driverId);
    if (existing) existing.push(run);
    else runsByDriver.set(run.driverId, [run]);
  }

  return {
    trucks: fleet.map((driver) => ({
      ...driver,
      runs: runsByDriver.get(driver.id) ?? [],
    })),
    // Tendered loads with nobody on them yet — the board's to-do column.
    unassigned,
  };
}

export async function GET(request: Request) {
  const authorization = await requireCarrierAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    return successResponse(await loadBoard(), authorization.requestId);
  } catch (error) {
    return databaseErrorResponse(error, "dispatch.board", authorization.requestId);
  }
}
