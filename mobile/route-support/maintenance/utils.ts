import type {
  Driver,
  EntityId,
  MaintenanceOrder,
  MaintenanceSeverity,
  MaintenanceStatus,
  Vehicle,
} from "@/domain/types";

/** Work orders: labels, grouping, and the preventive-service interval. */

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  cancelled: "Cancelled",
  completed: "Completed",
  in_progress: "In progress",
  open: "Open",
  scheduled: "Scheduled",
};

export const MAINTENANCE_SEVERITY_LABELS: Record<MaintenanceSeverity, string> = {
  critical: "Critical",
  high: "High",
  low: "Low",
  medium: "Medium",
};

const SEVERITY_ORDER: Record<MaintenanceSeverity, number> = {
  critical: 0,
  high: 1,
  low: 3,
  medium: 2,
};

/** Miles between PM-A services. Used to project the next one due. */
export const PM_INTERVAL_MILES = 25_000;

export interface MaintenanceEntry {
  readonly order: MaintenanceOrder;
  readonly vehicle: Vehicle | null;
  readonly reportedBy: Driver | null;
  readonly isOpen: boolean;
}

export function buildMaintenanceEntries(
  orders: readonly MaintenanceOrder[],
  vehicles: readonly Vehicle[],
  drivers: readonly Driver[],
): readonly MaintenanceEntry[] {
  const vehiclesById = new Map<EntityId, Vehicle>(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const driversById = new Map<EntityId, Driver>(drivers.map((driver) => [driver.id, driver]));

  return orders
    .map((order) => ({
      isOpen: order.status !== "completed" && order.status !== "cancelled",
      order,
      reportedBy: order.reportedByDriverId
        ? driversById.get(order.reportedByDriverId) ?? null
        : null,
      vehicle: vehiclesById.get(order.vehicleId) ?? null,
    }))
    .sort((left, right) => {
      if (left.isOpen !== right.isOpen) {
        return left.isOpen ? -1 : 1;
      }
      const bySeverity = SEVERITY_ORDER[left.order.severity] - SEVERITY_ORDER[right.order.severity];
      if (bySeverity !== 0) {
        return bySeverity;
      }
      return Date.parse(right.order.openedAt) - Date.parse(left.order.openedAt);
    });
}

export function severityTone(
  severity: MaintenanceSeverity,
): "danger" | "warning" | "info" | "neutral" {
  if (severity === "critical") return "danger";
  if (severity === "high") return "warning";
  if (severity === "medium") return "info";
  return "neutral";
}

export interface MaintenanceTotals {
  readonly open: number;
  readonly scheduled: number;
  readonly critical: number;
  readonly openCostCents: number;
}

export function summarizeMaintenance(entries: readonly MaintenanceEntry[]): MaintenanceTotals {
  let open = 0;
  let scheduled = 0;
  let critical = 0;
  let openCostCents = 0;

  for (const entry of entries) {
    if (!entry.isOpen) {
      continue;
    }
    open += 1;
    openCostCents += entry.order.costCents ?? 0;
    if (entry.order.status === "scheduled") {
      scheduled += 1;
    }
    if (entry.order.severity === "critical") {
      critical += 1;
    }
  }

  return { critical, open, openCostCents, scheduled };
}

/**
 * Miles until the next preventive service, measured from the last completed PM.
 *
 * Returns null when there is no completed PM to measure from. Measuring from
 * zero instead would turn a missing record into a precise-looking claim — a
 * unit with a 412,880-mile odometer and no service history would report being
 * 387,880 miles overdue, which nobody believes and which reads as broken data.
 * The true statement in that case is that no service is on file, and the caller
 * renders exactly that.
 */
export function milesToNextService(
  vehicle: Vehicle,
  orders: readonly MaintenanceOrder[],
): number | null {
  const completedPms = orders.filter((order) => order.vehicleId === vehicle.id &&
    order.kind === "preventive" &&
    order.status === "completed" &&
    order.odometerMiles !== undefined);
  if (completedPms.length === 0) {
    return null;
  }

  const lastPm = completedPms
    .sort((left, right) => (right.odometerMiles ?? 0) - (left.odometerMiles ?? 0))[0];
  return PM_INTERVAL_MILES - (vehicle.odometerMiles - (lastPm.odometerMiles ?? 0));
}
