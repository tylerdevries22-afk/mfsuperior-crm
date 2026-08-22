import type { AvailabilityBlock, AvailabilityRule, Driver, Shipment } from "@/domain/types";
import { blocksForDay, isBlocking, summarizeDay, type DaySummary } from "@/route-support/availability/utils";
import { formatDateKey, scheduledEnd, scheduledStart } from "@/route-support/schedule/utils";

/**
 * The week board: every driver against every day, with their own availability
 * laid under the loads they are already carrying.
 *
 * The point is the collision. A driver who is marked off on Thursday and also
 * assigned a Thursday load is the single most useful thing this screen can
 * show, so that cell is computed rather than left for a human to spot.
 */

export interface ScheduleCell {
  readonly dateKey: string;
  readonly summary: DaySummary;
  readonly loads: readonly Shipment[];
  readonly conflicted: boolean;
}

export interface DriverWeek {
  readonly driver: Driver;
  readonly cells: readonly ScheduleCell[];
  readonly loadCount: number;
  readonly conflictCount: number;
  readonly openDays: number;
}

/** Seven Sunday-aligned day keys around the given date. */
export function weekDayKeys(anchor: Date): readonly string[] {
  const sunday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
  return Array.from({ length: 7 }, (_, index) => formatDateKey(
    new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + index),
  ));
}

export function buildDriverWeeks(
  drivers: readonly Driver[],
  shipments: readonly Shipment[],
  blocks: readonly AvailabilityBlock[],
  rules: readonly AvailabilityRule[],
  dayKeys: readonly string[],
): readonly DriverWeek[] {
  return drivers.map((driver) => {
    const driverBlocks = blocks.filter((block) => block.driverId === driver.id);
    const driverRules = rules.filter((rule) => rule.driverId === driver.id);
    const driverLoads = shipments.filter((shipment) => shipment.assignedDriverId === driver.id);

    const cells = dayKeys.map((dateKey) => {
      const loads = driverLoads.filter((load) => loadRunsOn(load, dateKey));
      const summary = summarizeDay(dateKey, driverBlocks, driverRules, loads);
      const blocked = blocksForDay(driverBlocks, driverRules, dateKey).some(
        (block) => isBlocking(block.kind),
      );
      return { conflicted: blocked && loads.length > 0, dateKey, loads, summary };
    });

    return {
      cells,
      conflictCount: cells.filter((cell) => cell.conflicted).length,
      driver,
      loadCount: cells.reduce((sum, cell) => sum + cell.loads.length, 0),
      openDays: cells.filter((cell) => cell.summary.coverage === "open" && cell.loads.length === 0).length,
    };
  })
    // Conflicts to the top: they are the rows a dispatcher has to act on.
    .sort((left, right) => {
      if (left.conflictCount !== right.conflictCount) {
        return right.conflictCount - left.conflictCount;
      }
      return right.loadCount - left.loadCount;
    });
}

export function loadRunsOn(load: Shipment, dateKey: string): boolean {
  const start = scheduledStart(load);
  const end = scheduledEnd(load) ?? start;
  if (!start || !end) {
    return false;
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const dayStart = new Date(year, month - 1, day).getTime();
  const dayEnd = dayStart + 86_400_000;
  return Date.parse(start) < dayEnd && Date.parse(end) > dayStart;
}

/** Loads nobody is carrying, so the board can offer them against an open cell. */
export function unassignedLoads(shipments: readonly Shipment[]): readonly Shipment[] {
  return shipments
    .filter((shipment) => !shipment.assignedDriverId)
    .filter((shipment) => shipment.status !== "cancelled" && shipment.status !== "declined")
    .sort((left, right) => {
      const leftStart = scheduledStart(left);
      const rightStart = scheduledStart(right);
      return (leftStart ? Date.parse(leftStart) : 0) - (rightStart ? Date.parse(rightStart) : 0);
    });
}

export interface WeekTotals {
  readonly assigned: number;
  readonly unassigned: number;
  readonly conflicts: number;
  readonly openDriverDays: number;
}

export function summarizeWeek(
  weeks: readonly DriverWeek[],
  unassigned: readonly Shipment[],
  dayKeys: readonly string[],
): WeekTotals {
  return {
    assigned: weeks.reduce((sum, week) => sum + week.loadCount, 0),
    conflicts: weeks.reduce((sum, week) => sum + week.conflictCount, 0),
    openDriverDays: weeks.reduce((sum, week) => sum + week.openDays, 0),
    unassigned: unassigned.filter(
      (load) => dayKeys.some((dateKey) => loadRunsOn(load, dateKey)),
    ).length,
  };
}

export function shortDayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "narrow" });
}

export function dayNumber(dateKey: string): number {
  return Number(dateKey.split("-")[2]);
}

export function weekRangeLabel(dayKeys: readonly string[]): string {
  if (dayKeys.length === 0) {
    return "";
  }
  const first = dayKeys[0].split("-").map(Number);
  const last = dayKeys[dayKeys.length - 1].split("-").map(Number);
  const start = new Date(first[0], first[1] - 1, first[2]);
  const end = new Date(last[0], last[1] - 1, last[2]);
  const sameMonth = start.getMonth() === end.getMonth();
  return `${start.toLocaleDateString("en-US", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-US", { day: "numeric", month: sameMonth ? undefined : "short" })}`;
}
