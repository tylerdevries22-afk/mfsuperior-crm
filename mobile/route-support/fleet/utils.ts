import type {
  ComplianceDocument,
  Driver,
  EntityId,
  MaintenanceOrder,
  Vehicle,
  VehicleStatus,
} from "@/domain/types";
import { bucketFor, daysUntil } from "@/route-support/licensing/utils";

/** Fleet roster shaping: status, assignment, open work, and expiring paper. */

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  active: "Active",
  in_shop: "In shop",
  out_of_service: "Out of service",
  retired: "Retired",
};

export const OPEN_MAINTENANCE_STATUSES = new Set(["open", "scheduled", "in_progress"]);

export interface FleetEntry {
  readonly vehicle: Vehicle;
  readonly driver: Driver | null;
  readonly openOrders: readonly MaintenanceOrder[];
  readonly expiringDocuments: readonly ComplianceDocument[];
  readonly needsAttention: boolean;
}

export function buildFleetEntries(
  vehicles: readonly Vehicle[],
  drivers: readonly Driver[],
  orders: readonly MaintenanceOrder[],
  documents: readonly ComplianceDocument[],
  now: Date = new Date(),
): readonly FleetEntry[] {
  const driversById = new Map<EntityId, Driver>(drivers.map((driver) => [driver.id, driver]));

  return vehicles
    .map((vehicle) => {
      const openOrders = orders.filter(
        (order) => order.vehicleId === vehicle.id && OPEN_MAINTENANCE_STATUSES.has(order.status),
      );
      const expiringDocuments = documents.filter((document) => {
        if (document.subjectType !== "vehicle" || document.subjectId !== vehicle.id) {
          return false;
        }
        const bucket = bucketFor(daysUntil(document.expiresOn, now));
        return bucket === "expired" || bucket === "urgent";
      });

      return {
        driver: vehicle.assignedDriverId
          ? driversById.get(vehicle.assignedDriverId) ?? null
          : null,
        expiringDocuments,
        needsAttention: openOrders.length > 0 ||
          expiringDocuments.length > 0 ||
          vehicle.status === "out_of_service",
        openOrders,
        vehicle,
      };
    })
    // Anything needing attention rises, then units in the shop, then by number,
    // so the board reads as a to-do list rather than an inventory.
    .sort((left, right) => {
      if (left.needsAttention !== right.needsAttention) {
        return left.needsAttention ? -1 : 1;
      }
      return left.vehicle.unitNumber.localeCompare(right.vehicle.unitNumber, undefined, {
        numeric: true,
      });
    });
}

export interface FleetTotals {
  readonly total: number;
  readonly active: number;
  readonly down: number;
  readonly unassigned: number;
}

export function summarizeFleet(entries: readonly FleetEntry[]): FleetTotals {
  let active = 0;
  let down = 0;
  let unassigned = 0;

  for (const entry of entries) {
    if (entry.vehicle.status === "active") {
      active += 1;
    }
    if (entry.vehicle.status === "in_shop" || entry.vehicle.status === "out_of_service") {
      down += 1;
    }
    // A retired unit has no driver by design and is not a gap in the roster.
    if (!entry.driver && entry.vehicle.status !== "retired") {
      unassigned += 1;
    }
  }

  return { active, down, total: entries.length, unassigned };
}

export function vehicleStatusTone(status: VehicleStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "in_shop") return "warning";
  if (status === "out_of_service") return "danger";
  return "neutral";
}

export function formatOdometer(miles: number): string {
  return `${miles.toLocaleString()} mi`;
}

export function describeVehicle(vehicle: Vehicle): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}
