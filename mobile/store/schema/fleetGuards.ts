import {
  hasStringId,
  isFiniteNumber,
  isIsoDateTime,
  isNonEmptyString,
  isNonNegativeNumber,
  isRecord,
} from "./primitives";
import { payoutStatusSet, vehicleStatusSet } from "./statusSets";

export function isVehicle(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.unitNumber) &&
    typeof value.status === "string" &&
    vehicleStatusSet.has(value.status) &&
    isNonNegativeNumber(value.odometerMiles) &&
    (value.thumbnailUrl === undefined || value.thumbnailUrl === null || isNonEmptyString(value.thumbnailUrl))
  );
}

export function isMaintenanceOrder(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.vehicleId) &&
    isNonEmptyString(value.summary) &&
    isIsoDateTime(value.openedAt)
  );
}

export function isComplianceDocument(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.subjectId) &&
    (value.subjectType === "vehicle" || value.subjectType === "driver") &&
    isIsoDateTime(value.expiresOn)
  );
}

/**
 * Line items carry deductions as negative amounts, so they must sum to
 * `netCents`. A blob whose arithmetic disagrees would render a payout screen
 * that contradicts itself, which is worse than rebuilding from fixtures.
 */
export function isPayout(value: Record<string, unknown>): boolean {
  if (
    !hasStringId(value) ||
    !isNonEmptyString(value.driverId) ||
    typeof value.status !== "string" ||
    !payoutStatusSet.has(value.status) ||
    !isFiniteNumber(value.netCents) ||
    !Array.isArray(value.lineItems)
  ) {
    return false;
  }

  let total = 0;
  for (const lineItem of value.lineItems) {
    if (!isRecord(lineItem) || !hasStringId(lineItem) || !isFiniteNumber(lineItem.amountCents)) {
      return false;
    }
    total += lineItem.amountCents;
  }
  return total === value.netCents;
}
