import type { ComplianceDocument, Driver, MaintenanceOrder, Shipment, Vehicle } from "@/domain/types";
import { buildFleetEntries } from "@/route-support/fleet/utils";
import { daysUntil } from "@/route-support/licensing/utils";

type Snapshot = {
  readonly vehicles: readonly Vehicle[];
  readonly drivers: readonly Driver[];
  readonly shipments: readonly Shipment[];
  readonly maintenanceOrders: readonly MaintenanceOrder[];
  readonly complianceDocuments: readonly ComplianceDocument[];
};

/** Pure projection of the repository snapshot; future realtime events use the same input. */
export function selectOperationBadges(snapshot: Snapshot, now: Date) {
  const fleet = buildFleetEntries(snapshot.vehicles, snapshot.drivers, snapshot.maintenanceOrders, snapshot.complianceDocuments, now);
  return {
    fleet: fleet.filter(({ vehicle, needsAttention }) => vehicle.status !== "retired" && (needsAttention || vehicle.status === "in_shop" || !vehicle.assignedDriverId)).length,
    jobs: snapshot.shipments.filter((shipment) => !["delivered", "declined", "cancelled"].includes(shipment.status)).length,
    maintenance: snapshot.maintenanceOrders.filter((order) => ["open", "scheduled", "in_progress"].includes(order.status)).length,
    licensing: snapshot.complianceDocuments.filter((document) => daysUntil(document.expiresOn, now) <= 30).length,
  };
}
