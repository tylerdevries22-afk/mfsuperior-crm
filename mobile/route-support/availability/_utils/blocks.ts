import type { AvailabilityBlock, AvailabilityKind, AvailabilityRule } from "@/domain/types";
import { formatDateKey } from "@/route-support/schedule/utils";

import { MINUTES_PER_DAY, localDayStart, minutesToIso } from "./time";

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

function oppositeKind(kind: AvailabilityKind): AvailabilityKind {
  return kind === "unavailable" || kind === "time_off" ? "available" : "unavailable";
}
