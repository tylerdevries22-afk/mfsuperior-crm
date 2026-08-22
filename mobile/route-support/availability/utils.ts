import type {
  AvailabilityBlock,
  AvailabilityKind,
  AvailabilityRule,
  EntityId,
  Shipment,
} from "@/domain/types";
import { formatDateKey, orderedStops, scheduledEnd, scheduledStart } from "@/route-support/schedule/utils";

/**
 * Calendar maths for driver availability.
 *
 * Every conversion between a calendar day and an instant goes through the
 * device's own zone via the `Date` constructor, which is the same zone
 * `formatDateKey` reports. That matters at a DST boundary: "eight hours after
 * local midnight" has to stay 8am on the day the clocks move, and only the
 * local constructor normalizes that correctly.
 */

export const MINUTES_PER_DAY = 1_440;

/** The drag track snaps here. Fifteen minutes is what dispatch schedules on. */
export const SNAP_MINUTES = 15;

export interface MonthCell {
  readonly dateKey: string;
  readonly day: number;
  readonly inMonth: boolean;
  readonly weekday: number;
}

export interface DaySummary {
  readonly dateKey: string;
  /** `off` when the whole day is blocked, `partial` when only some of it is. */
  readonly coverage: "open" | "partial" | "off";
  readonly blocks: readonly AvailabilityBlock[];
  readonly loadCount: number;
  readonly hasConflict: boolean;
}

/** Local midnight on the given `YYYY-MM-DD`. */
export function localDayStart(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * An instant `minute` minutes after local midnight. The `Date` constructor
 * normalizes out-of-range values, so 1,440 lands on the next midnight and a
 * time that a spring-forward skipped rolls to the hour that does exist.
 */
export function minutesToIso(dateKey: string, minute: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 0, minute, 0, 0).toISOString();
}

/** Minutes from local midnight for an instant, clamped to the day it lands in. */
export function isoToMinutes(iso: string, dateKey: string): number {
  const start = localDayStart(dateKey).getTime();
  const delta = (Date.parse(iso) - start) / 60_000;
  return Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(delta)));
}

export function snapMinute(minute: number, step: number = SNAP_MINUTES): number {
  return Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minute / step) * step));
}

/** `510` becomes `8:30 AM`. */
export function formatMinute(minute: number): string {
  const normalized = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const meridiem = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  if (minute >= MINUTES_PER_DAY) {
    return "12 AM";
  }
  return minutes === 0 ? `${hour12} ${meridiem}` : `${hour12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

export function formatMinuteRange(startMinute: number, endMinute: number): string {
  if (startMinute === 0 && endMinute >= MINUTES_PER_DAY) {
    return "All day";
  }
  return `${formatMinute(startMinute)} – ${formatMinute(endMinute)}`;
}

/**
 * Six rows of seven, Sunday-aligned, so the grid never changes height between
 * months and the cells never reflow under the drag selection.
 */
export function buildMonthGrid(year: number, month: number): readonly MonthCell[] {
  const first = new Date(year, month, 1);
  const leading = first.getDay();
  const cells: MonthCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(year, month, 1 - leading + index);
    cells.push({
      dateKey: formatDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      weekday: date.getDay(),
    });
  }
  return cells;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Shifts a `{year, month}` pair by whole months without leaving the year broken. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const shifted = new Date(year, month + delta, 1);
  return { month: shifted.getMonth(), year: shifted.getFullYear() };
}

/**
 * Expand the weekly patterns that apply to one day into concrete blocks.
 *
 * Rules are stored as minutes from midnight rather than instants precisely so
 * this expansion lands on the right wall-clock time in every week, including
 * the two each year where the day is 23 or 25 hours long.
 */
export function expandRulesForDay(
  rules: readonly AvailabilityRule[],
  dateKey: string,
): readonly AvailabilityBlock[] {
  const dayStart = localDayStart(dateKey);
  const weekday = dayStart.getDay();
  const dayStamp = dayStart.getTime();

  return rules
    .filter((rule) => rule.weekday === weekday)
    .filter((rule) => {
      if (Date.parse(rule.effectiveFrom) > dayStamp + MINUTES_PER_DAY * 60_000) {
        return false;
      }
      return !rule.effectiveUntil || Date.parse(rule.effectiveUntil) >= dayStamp;
    })
    .map((rule) => ({
      createdAt: rule.createdAt,
      driverId: rule.driverId,
      endsAt: minutesToIso(dateKey, rule.endMinute),
      // Derived, not stored. The id is stable per rule and day so React keys
      // and selection state survive a re-render without a fresh identity.
      id: `${rule.id}:${dateKey}`,
      kind: rule.kind,
      ruleId: rule.id,
      startsAt: minutesToIso(dateKey, rule.startMinute),
      updatedAt: rule.updatedAt,
    }));
}

/** Concrete blocks plus expanded rules, for one driver on one day. */
export function blocksForDay(
  blocks: readonly AvailabilityBlock[],
  rules: readonly AvailabilityRule[],
  dateKey: string,
): readonly AvailabilityBlock[] {
  const explicit = blocks.filter((block) => overlapsDay(block, dateKey));
  // An explicit block on the day wins over the standing pattern: a driver who
  // marks one Sunday available means that Sunday, not every Sunday.
  const overridden = new Set(explicit.map((block) => block.kind));
  const expanded = expandRulesForDay(rules, dateKey).filter(
    (block) => explicit.length === 0 || !overridden.has(oppositeKind(block.kind)),
  );
  return [...explicit, ...expanded].sort(
    (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt),
  );
}

/**
 * Every local calendar day a span touches, inclusive of both ends. Needed
 * because a standing weekly pattern only exists once it is expanded onto a
 * specific day, and a load window can straddle several.
 */
export function dayKeysBetween(startsAt: string, endsAt: string): readonly string[] {
  const start = new Date(Date.parse(startsAt));
  const end = new Date(Date.parse(endsAt));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [];
  }

  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  // A long-haul run can cover a week; the cap stops a malformed span from
  // spinning here.
  for (let guard = 0; cursor <= last && guard < 400; guard += 1) {
    keys.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

export function overlapsDay(block: Pick<AvailabilityBlock, "startsAt" | "endsAt">, dateKey: string): boolean {
  const dayStart = localDayStart(dateKey).getTime();
  const dayEnd = dayStart + MINUTES_PER_DAY * 60_000;
  return Date.parse(block.startsAt) < dayEnd && Date.parse(block.endsAt) > dayStart;
}

const BLOCKING_KINDS = new Set<AvailabilityKind>(["unavailable", "time_off"]);

export function isBlocking(kind: AvailabilityKind): boolean {
  return BLOCKING_KINDS.has(kind);
}

/**
 * How a single day should read on the grid, including whether the driver has
 * blocked time that a dispatched load already runs through.
 */
export function summarizeDay(
  dateKey: string,
  blocks: readonly AvailabilityBlock[],
  rules: readonly AvailabilityRule[],
  loads: readonly Shipment[],
): DaySummary {
  const dayBlocks = blocksForDay(blocks, rules, dateKey);
  const blocking = dayBlocks.filter((block) => isBlocking(block.kind));
  const dayLoads = loads.filter((load) => loadTouchesDay(load, dateKey));

  const coveredMinutes = mergedMinutes(blocking, dateKey);
  const coverage = coveredMinutes >= MINUTES_PER_DAY
    ? "off"
    : coveredMinutes > 0
      ? "partial"
      : "open";

  return {
    blocks: dayBlocks,
    coverage,
    dateKey,
    hasConflict: blocking.length > 0 && dayLoads.length > 0,
    loadCount: dayLoads.length,
  };
}

export function loadTouchesDay(load: Shipment, dateKey: string): boolean {
  const start = scheduledStart(load);
  const end = scheduledEnd(load) ?? start;
  if (!start || !end) {
    return false;
  }
  return overlapsDay({ endsAt: end, startsAt: start }, dateKey);
}

/**
 * Loads that run through a span the driver is marking as blocked.
 *
 * This never prevents the write. A driver telling dispatch they cannot work is
 * information dispatch needs, and refusing to record it would push the truth
 * out of the system. Surfacing the clash is the point.
 */
export function findAvailabilityConflicts(
  loads: readonly Shipment[],
  driverId: EntityId,
  startsAt: string,
  endsAt: string,
): readonly Shipment[] {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  return loads.filter((load) => {
    if (load.assignedDriverId !== driverId) {
      return false;
    }
    if (load.status === "delivered" || load.status === "cancelled" || load.status === "declined") {
      return false;
    }
    const loadStart = scheduledStart(load);
    const loadEnd = scheduledEnd(load) ?? loadStart;
    if (!loadStart || !loadEnd) {
      return false;
    }
    return Date.parse(loadStart) < end && Date.parse(loadEnd) > start;
  });
}

/** A one-line route summary for a conflicting load. */
export function loadRouteLabel(load: Shipment): string {
  const stops = orderedStops(load);
  const origin = stops[0]?.address.city ?? "Origin";
  const destination = stops[stops.length - 1]?.address.city ?? "Destination";
  return `${origin} → ${destination}`;
}

/**
 * Total blocked minutes inside one day, with overlapping blocks counted once.
 * Two overlapping half-day blocks are not a full day off.
 */
function mergedMinutes(blocks: readonly AvailabilityBlock[], dateKey: string): number {
  if (blocks.length === 0) {
    return 0;
  }
  const spans = blocks
    .map((block) => [
      isoToMinutes(block.startsAt, dateKey),
      isoToMinutes(block.endsAt, dateKey),
    ] as const)
    .filter(([start, end]) => end > start)
    .sort((left, right) => left[0] - right[0]);

  let total = 0;
  let cursorStart = spans[0]?.[0] ?? 0;
  let cursorEnd = spans[0]?.[1] ?? 0;
  for (const [start, end] of spans.slice(1)) {
    if (start > cursorEnd) {
      total += cursorEnd - cursorStart;
      cursorStart = start;
      cursorEnd = end;
    } else {
      cursorEnd = Math.max(cursorEnd, end);
    }
  }
  return total + (cursorEnd - cursorStart);
}

function oppositeKind(kind: AvailabilityKind): AvailabilityKind {
  return kind === "unavailable" || kind === "time_off" ? "available" : "unavailable";
}
