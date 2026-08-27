import type {
  AvailabilityBlock,
  AvailabilityRule,
  Driver,
  DriverShift,
  DriverShiftInput,
  OperationsState,
} from "./types";

const BLOCKING_AVAILABILITY = new Set<AvailabilityBlock["kind"]>(["unavailable", "time_off"]);
const CLOSED_SHIFT_STATUSES = new Set<DriverShift["status"]>(["completed", "cancelled"]);

export interface CoverageCandidate {
  readonly driver: Driver;
  readonly rank: number;
}

export function rangesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
): boolean {
  return Date.parse(leftStart) < Date.parse(rightEnd) && Date.parse(rightStart) < Date.parse(leftEnd);
}

export function driverShiftConflict(
  state: Pick<OperationsState, "driverShifts" | "availabilityBlocks" | "availabilityRules" | "shipments">,
  shift: Pick<DriverShift, "driverId" | "startsAt" | "endsAt" | "id">,
): string | null {
  const overlappingShift = state.driverShifts.find((candidate) => (
    candidate.id !== shift.id &&
    candidate.driverId === shift.driverId &&
    !CLOSED_SHIFT_STATUSES.has(candidate.status) &&
    rangesOverlap(candidate.startsAt, candidate.endsAt, shift.startsAt, shift.endsAt)
  ));
  if (overlappingShift) {
    return "This driver already has another shift during that window.";
  }

  const blockingBlock = state.availabilityBlocks.find((block) => (
    block.driverId === shift.driverId &&
    BLOCKING_AVAILABILITY.has(block.kind) &&
    rangesOverlap(block.startsAt, block.endsAt, shift.startsAt, shift.endsAt)
  ));
  if (blockingBlock) {
    return "This shift overlaps a blocked time on the driver calendar.";
  }

  if (rulesBlockShift(state.availabilityRules, shift)) {
    return "This shift overlaps a recurring blocked time on the driver calendar.";
  }
  return null;
}

export function eligibleCoverageDrivers(
  state: Pick<OperationsState, "drivers" | "driverShifts" | "availabilityBlocks" | "availabilityRules" | "shipments">,
  shift: Pick<DriverShift, "driverId" | "startsAt" | "endsAt" | "id">,
): readonly CoverageCandidate[] {
  return state.drivers
    .filter((driver) => driver.id !== shift.driverId && driver.status !== "suspended")
    .map((driver) => {
      const candidateShift = { ...shift, driverId: driver.id };
      const conflict = driverShiftConflict(state, candidateShift);
      return conflict ? null : { driver, rank: rankForDriver(driver) };
    })
    .filter((candidate): candidate is CoverageCandidate => candidate !== null)
    .sort((left, right) => left.rank - right.rank || left.driver.lastName.localeCompare(right.driver.lastName));
}

function rankForDriver(driver: Driver): number {
  if (driver.status === "available") return 0;
  if (driver.status === "on_duty") return 1;
  return 2;
}

function rulesBlockShift(
  rules: readonly AvailabilityRule[],
  shift: Pick<DriverShift, "driverId" | "startsAt" | "endsAt">,
): boolean {
  const relevantRules = rules.filter((rule) => (
    rule.driverId === shift.driverId && BLOCKING_AVAILABILITY.has(rule.kind)
  ));
  if (relevantRules.length === 0) return false;

  const start = new Date(shift.startsAt);
  const end = new Date(shift.endsAt);
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  for (let guard = 0; cursor <= last && guard < 370; guard += 1) {
    const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    const dayEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    for (const rule of relevantRules) {
      if (rule.weekday !== dayStart.getDay()) continue;
      if (Date.parse(rule.effectiveFrom) > dayEnd.getTime()) continue;
      if (rule.effectiveUntil && Date.parse(rule.effectiveUntil) < dayStart.getTime()) continue;
      const blockedStart = new Date(dayStart.getTime() + rule.startMinute * 60_000).toISOString();
      const blockedEnd = new Date(dayStart.getTime() + rule.endMinute * 60_000).toISOString();
      if (rangesOverlap(blockedStart, blockedEnd, shift.startsAt, shift.endsAt)) return true;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

export function shiftInputToRecord(input: DriverShiftInput, id: string, now: string): DriverShift {
  return {
    createdAt: now,
    driverId: input.driverId,
    endsAt: new Date(input.endsAt).toISOString(),
    id,
    note: input.note?.trim() || undefined,
    startsAt: new Date(input.startsAt).toISOString(),
    status: input.status ?? "scheduled",
    updatedAt: now,
  };
}
