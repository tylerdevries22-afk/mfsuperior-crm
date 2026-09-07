import type { EntityId, IsoDateTime } from "./core";

export const MAINTENANCE_KINDS = ["repair", "preventive", "inspection"] as const;

export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number];

export const MAINTENANCE_STATUSES = [
  "open",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type MaintenanceSeverity = (typeof MAINTENANCE_SEVERITIES)[number];

export interface MaintenanceOrder {
  readonly id: EntityId;
  readonly vehicleId: EntityId;
  readonly kind: MaintenanceKind;
  readonly status: MaintenanceStatus;
  readonly severity: MaintenanceSeverity;
  readonly summary: string;
  readonly description: string;
  readonly openedAt: IsoDateTime;
  readonly scheduledFor?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly odometerMiles?: number;
  readonly vendorName?: string;
  readonly costCents?: number;
  readonly reportedByDriverId?: EntityId;
  readonly updatedAt: IsoDateTime;
}

export interface MaintenanceOrderInput {
  readonly vehicleId: EntityId;
  readonly kind: MaintenanceKind;
  readonly severity: MaintenanceSeverity;
  readonly summary: string;
  readonly description: string;
  readonly scheduledFor?: IsoDateTime;
  readonly odometerMiles?: number;
  readonly vendorName?: string;
  readonly costCents?: number;
  readonly reportedByDriverId?: EntityId;
}

export interface MaintenanceOrderPatch {
  readonly status?: MaintenanceStatus;
  readonly severity?: MaintenanceSeverity;
  readonly scheduledFor?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly vendorName?: string;
  readonly costCents?: number;
  readonly description?: string;
}
