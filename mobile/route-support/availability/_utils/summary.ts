import type { AvailabilityBlock, AvailabilityRule, Shipment } from "@/domain/types";
import { scheduledEnd, scheduledStart } from "@/route-support/schedule/utils";

import { blocksForDay, isBlocking, overlapsDay } from "./blocks";
import { MINUTES_PER_DAY, isoToMinutes } from "./time";

export interface DaySummary {
  readonly dateKey: string;
  /** `off` when the whole day is blocked, `partial` when only some of it is. */
  readonly coverage: "open" | "partial" | "off";
  readonly blocks: readonly AvailabilityBlock[];
  readonly loadCount: number;
  readonly hasConflict: boolean;
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
