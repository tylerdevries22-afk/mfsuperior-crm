import { createDemoOperationsState } from "@/domain/fixtures";
import type { AvailabilityBlock, AvailabilityRule } from "@/domain/types";
import { minutesToIso } from "@/route-support/availability/utils";

import {
  buildDriverWeeks,
  dayNumber,
  loadRunsOn,
  shortDayLabel,
  summarizeWeek,
  unassignedLoads,
  weekDayKeys,
  weekRangeLabel,
} from "../utils";

const state = createDemoOperationsState();
const NOW = new Date("2026-08-20T13:00:00.000Z");
const KEYS = weekDayKeys(NOW);

function weeks(
  blocks: readonly AvailabilityBlock[] = state.availabilityBlocks,
  rules: readonly AvailabilityRule[] = state.availabilityRules,
) {
  return buildDriverWeeks(state.drivers, state.shipments, blocks, rules, KEYS);
}

function block(driverId: string, dateKey: string, kind: AvailabilityBlock["kind"]): AvailabilityBlock {
  return {
    createdAt: NOW.toISOString(),
    driverId,
    endsAt: minutesToIso(dateKey, 1_440),
    id: `block-${driverId}-${dateKey}`,
    kind,
    startsAt: minutesToIso(dateKey, 0),
    updatedAt: NOW.toISOString(),
  };
}

describe("the week window", () => {
  it("is seven Sunday-aligned days", () => {
    expect(KEYS).toHaveLength(7);
    const [year, month, day] = KEYS[0].split("-").map(Number);
    expect(new Date(year, month - 1, day).getDay()).toBe(0);
  });

  it("labels the range and its cells", () => {
    expect(weekRangeLabel(KEYS)).toMatch(/\w{3} \d+ – \d+/);
    expect(shortDayLabel(KEYS[0])).toBe("S");
    expect(dayNumber(KEYS[0])).toBe(Number(KEYS[0].split("-")[2]));
  });

  it("has no label for an empty week", () => {
    expect(weekRangeLabel([])).toBe("");
  });
});

describe("the driver grid", () => {
  it("gives every driver a cell for every day", () => {
    for (const week of weeks()) {
      expect(week.cells).toHaveLength(7);
      expect(week.cells.map((cell) => cell.dateKey)).toEqual([...KEYS]);
    }
  });

  it("puts a load only on the days it actually runs", () => {
    const brenna = weeks().find((week) => week.driver.id === "driver-brenna");
    const withLoads = brenna?.cells.filter((cell) => cell.loads.length > 0) ?? [];
    expect(withLoads.length).toBeGreaterThan(0);
    for (const cell of withLoads) {
      for (const load of cell.loads) {
        expect(loadRunsOn(load, cell.dateKey)).toBe(true);
        expect(load.assignedDriverId).toBe("driver-brenna");
      }
    }
  });

  it("never shows one driver another driver's load", () => {
    for (const week of weeks()) {
      for (const cell of week.cells) {
        for (const load of cell.loads) {
          expect(load.assignedDriverId).toBe(week.driver.id);
        }
      }
    }
  });
});

describe("conflicts", () => {
  /**
   * The whole point of the board: a driver carrying a load through time they
   * marked off is the one thing a dispatcher must not have to spot by eye.
   */
  it("flags a day where a blocked driver is still carrying a load", () => {
    const carrying = weeks().find((week) => week.driver.id === "driver-brenna");
    const busyDay = carrying?.cells.find((cell) => cell.loads.length > 0);
    expect(busyDay).toBeDefined();

    const blocked = weeks([block("driver-brenna", busyDay?.dateKey ?? "", "unavailable")], []);
    const flagged = blocked.find((week) => week.driver.id === "driver-brenna");
    const cell = flagged?.cells.find((entry) => entry.dateKey === busyDay?.dateKey);
    expect(cell?.conflicted).toBe(true);
    expect(flagged?.conflictCount).toBeGreaterThan(0);
  });

  it("does not flag blocked time with no load on it", () => {
    const free = weeks().find((week) => week.driver.id === "driver-kenji");
    const freeDay = free?.cells.find((cell) => cell.loads.length === 0);
    const blocked = weeks([block("driver-kenji", freeDay?.dateKey ?? "", "time_off")], []);
    const cell = blocked
      .find((week) => week.driver.id === "driver-kenji")
      ?.cells.find((entry) => entry.dateKey === freeDay?.dateKey);
    expect(cell?.conflicted).toBe(false);
  });

  it("does not treat a preferred window as a conflict", () => {
    const carrying = weeks().find((week) => week.driver.id === "driver-brenna");
    const busyDay = carrying?.cells.find((cell) => cell.loads.length > 0);
    const preferred = weeks([block("driver-brenna", busyDay?.dateKey ?? "", "preferred")], []);
    const cell = preferred
      .find((week) => week.driver.id === "driver-brenna")
      ?.cells.find((entry) => entry.dateKey === busyDay?.dateKey);
    expect(cell?.conflicted).toBe(false);
  });

  /** Standing weekly patterns count, not only one-off blocks. */
  it("flags a conflict raised by a weekly pattern alone", () => {
    const carrying = weeks().find((week) => week.driver.id === "driver-brenna");
    const busyDay = carrying?.cells.find((cell) => cell.loads.length > 0);
    const [year, month, day] = (busyDay?.dateKey ?? "").split("-").map(Number);
    const weekday = new Date(year, month - 1, day).getDay();

    const rule: AvailabilityRule = {
      createdAt: NOW.toISOString(),
      driverId: "driver-brenna",
      effectiveFrom: "2026-01-01T12:00:00.000Z",
      endMinute: 1_440,
      id: "rule-conflict",
      kind: "unavailable",
      startMinute: 0,
      updatedAt: NOW.toISOString(),
      weekday: weekday as AvailabilityRule["weekday"],
    };
    const flagged = weeks([], [rule]).find((week) => week.driver.id === "driver-brenna");
    expect(flagged?.conflictCount).toBeGreaterThan(0);
  });

  it("sorts drivers with conflicts to the top", () => {
    const carrying = weeks().find((week) => week.driver.id === "driver-brenna");
    const busyDay = carrying?.cells.find((cell) => cell.loads.length > 0);
    const sorted = weeks([block("driver-brenna", busyDay?.dateKey ?? "", "unavailable")], []);
    expect(sorted[0].driver.id).toBe("driver-brenna");
  });
});

describe("unassigned pool and totals", () => {
  it("offers only loads nobody is carrying", () => {
    for (const load of unassignedLoads(state.shipments)) {
      expect(load.assignedDriverId).toBeUndefined();
      expect(["cancelled", "declined"]).not.toContain(load.status);
    }
  });

  it("counts assigned loads and open driver-days", () => {
    const built = weeks();
    const totals = summarizeWeek(built, unassignedLoads(state.shipments), KEYS);
    expect(totals.assigned).toBe(built.reduce((sum, week) => sum + week.loadCount, 0));
    expect(totals.openDriverDays).toBe(built.reduce((sum, week) => sum + week.openDays, 0));
    expect(totals.conflicts).toBe(built.reduce((sum, week) => sum + week.conflictCount, 0));
  });

  it("counts an unassigned load only when it runs inside the week", () => {
    const totals = summarizeWeek(weeks(), unassignedLoads(state.shipments), KEYS);
    expect(totals.unassigned).toBeLessThanOrEqual(unassignedLoads(state.shipments).length);
  });
});
