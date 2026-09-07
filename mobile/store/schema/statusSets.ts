import {
  APP_ROLES,
  AVAILABILITY_KINDS,
  HOS_DUTY_STATUSES,
  PAYOUT_STATUSES,
  DRIVER_SHIFT_STATUSES,
  SHIFT_COVERAGE_REQUEST_STATUSES,
  SCHEDULE_SYNC_STATUSES,
  SHIPMENT_STATUSES,
  VEHICLE_STATUSES,
} from "../../domain/types";

export const roleSet = new Set<string>(APP_ROLES);
export const shipmentStatusSet = new Set<string>(SHIPMENT_STATUSES);
export const dutyStatusSet = new Set<string>(HOS_DUTY_STATUSES);
export const availabilityKindSet = new Set<string>(AVAILABILITY_KINDS);
export const payoutStatusSet = new Set<string>(PAYOUT_STATUSES);
export const vehicleStatusSet = new Set<string>(VEHICLE_STATUSES);
export const driverShiftStatusSet = new Set<string>(DRIVER_SHIFT_STATUSES);
export const coverageRequestStatusSet = new Set<string>(SHIFT_COVERAGE_REQUEST_STATUSES);
export const scheduleSyncStatusSet = new Set<string>(SCHEDULE_SYNC_STATUSES);
