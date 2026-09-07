import type { EntityId, IsoDateTime } from "./core";

export const DRIVER_SHIFT_STATUSES = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type DriverShiftStatus = (typeof DRIVER_SHIFT_STATUSES)[number];

/** A schedulable occurrence. Jobs retain their original assignment during coverage. */
export interface DriverShift {
  readonly id: EntityId;
  readonly driverId: EntityId;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly status: DriverShiftStatus;
  readonly note?: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface DriverShiftInput {
  readonly id?: EntityId;
  readonly driverId: EntityId;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly status?: DriverShiftStatus;
  readonly note?: string;
}

export const SHIFT_COVERAGE_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "closed",
] as const;

export type ShiftCoverageRequestStatus = (typeof SHIFT_COVERAGE_REQUEST_STATUSES)[number];

/** A request changes only the linked shift, never its shipment assignments. */
export interface ShiftCoverageRequest {
  readonly id: EntityId;
  readonly shiftId: EntityId;
  readonly fromDriverId: EntityId;
  readonly targetDriverId: EntityId;
  readonly requestedByAccountId: EntityId;
  readonly status: ShiftCoverageRequestStatus;
  readonly createdAt: IsoDateTime;
  readonly respondedAt?: IsoDateTime;
}

export interface ShiftCoverageRequestInput {
  readonly shiftId: EntityId;
  readonly targetDriverId: EntityId;
}

export const SCHEDULE_SYNC_STATUSES = [
  "pending",
  "synced",
  "failed",
] as const;

export type ScheduleSyncState = (typeof SCHEDULE_SYNC_STATUSES)[number];

/** Target is an integration boundary; credentials can be added without changing calendar data. */
export interface ScheduleSyncStatus {
  readonly id: EntityId;
  readonly entityType: "shift";
  readonly entityId: EntityId;
  readonly provider: "target";
  readonly status: ScheduleSyncState;
  readonly attempts: number;
  readonly lastAttemptAt?: IsoDateTime;
  readonly lastError?: string;
  readonly updatedAt: IsoDateTime;
}
