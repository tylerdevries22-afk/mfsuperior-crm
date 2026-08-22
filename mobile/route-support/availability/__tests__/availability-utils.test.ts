import { createDemoOperationsState } from "@/domain/fixtures";
import type { AvailabilityBlock, AvailabilityRule, Shipment } from "@/domain/types";

import {
  MINUTES_PER_DAY,
  blocksForDay,
  buildMonthGrid,
  expandRulesForDay,
  findAvailabilityConflicts,
  formatMinute,
  formatMinuteRange,
  isoToMinutes,
  localDayStart,
  minutesToIso,
  monthLabel,
  shiftMonth,
  snapMinute,
  summarizeDay,
} from "../utils";

function block(overrides: Partial<AvailabilityBlock> & Pick<AvailabilityBlock, "startsAt" | "endsAt">): AvailabilityBlock {
  return {
    createdAt: "2026-08-01T00:00:00.000Z",
    driverId: "driver-brenna",
    id: "block-1",
    kind: "unavailable",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function rule(overrides: Partial<AvailabilityRule> = {}): AvailabilityRule {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    driverId: "driver-brenna",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    endMinute: MINUTES_PER_DAY,
    id: "rule-1",
    kind: "unavailable",
    startMinute: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
    weekday: 0,
    ...overrides,
  };
}

describe("month grid", () => {
  it("always renders six Sunday-aligned rows so the grid never reflows", () => {
    for (const month of [0, 1, 5, 11]) {
      const cells = buildMonthGrid(2026, month);
      expect(cells).toHaveLength(42);
      expect(cells[0].weekday).toBe(0);
      expect(cells[41].weekday).toBe(6);
    }
  });

  it("marks only the target month's days as in-month", () => {
    // February 2026 starts on a Sunday, so there are no leading spill cells.
    const cells = buildMonthGrid(2026, 1);
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(28);
    expect(cells[0].day).toBe(1);
    expect(cells[0].inMonth).toBe(true);
  });

  it("walks months across a year boundary in both directions", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ month: 0, year: 2027 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ month: 11, year: 2025 });
    expect(monthLabel(2026, 7)).toBe("August 2026");
  });
});

describe("minute conversion", () => {
  it("round-trips a minute through an instant and back", () => {
    for (const minute of [0, 15, 495, 720, 1_425]) {
      expect(isoToMinutes(minutesToIso("2026-08-20", minute), "2026-08-20")).toBe(minute);
    }
  });

  it("snaps to the quarter hour and stays inside the day", () => {
    expect(snapMinute(7)).toBe(0);
    expect(snapMinute(8)).toBe(15);
    expect(snapMinute(-40)).toBe(0);
    expect(snapMinute(9_999)).toBe(MINUTES_PER_DAY);
  });

  it("labels midnight, noon, and the end of the day without ambiguity", () => {
    expect(formatMinute(0)).toBe("12 AM");
    expect(formatMinute(510)).toBe("8:30 AM");
    expect(formatMinute(720)).toBe("12 PM");
    expect(formatMinute(MINUTES_PER_DAY)).toBe("12 AM");
    expect(formatMinuteRange(0, MINUTES_PER_DAY)).toBe("All day");
  });
});

describe("weekly rule expansion", () => {
  it("expands only onto its own weekday", () => {
    // 2026-08-23 is a Sunday; 2026-08-24 is the Monday after it.
    expect(expandRulesForDay([rule()], "2026-08-23")).toHaveLength(1);
    expect(expandRulesForDay([rule()], "2026-08-24")).toHaveLength(0);
  });

  it("respects the effective window at both ends", () => {
    const bounded = rule({
      effectiveFrom: "2026-08-30T00:00:00.000Z",
      effectiveUntil: "2026-09-20T00:00:00.000Z",
    });
    expect(expandRulesForDay([bounded], "2026-08-23")).toHaveLength(0);
    expect(expandRulesForDay([bounded], "2026-08-30")).toHaveLength(1);
    expect(expandRulesForDay([bounded], "2026-09-27")).toHaveLength(0);
  });

  /**
   * The reason rules store minutes rather than instants. On a spring-forward
   * Sunday the local day is 23 hours long, so a rule that ran 8am–4pm has to
   * still start at 8am — an instant copied from the previous week would not.
   */
  it("keeps wall-clock time across a spring-forward boundary", () => {
    // 2026-03-08 is the US spring-forward Sunday.
    const workday = rule({ endMinute: 960, startMinute: 480 });
    const [expanded] = expandRulesForDay([workday], "2026-03-08");
    const startedAt = new Date(expanded.startsAt);
    expect(startedAt.getHours()).toBe(8);
    expect(startedAt.getMinutes()).toBe(0);
    expect(new Date(expanded.endsAt).getHours()).toBe(16);
  });

  it("keeps wall-clock time across a fall-back boundary", () => {
    // 2026-11-01 is the US fall-back Sunday, a 25-hour local day.
    const workday = rule({ endMinute: 960, startMinute: 480 });
    const [expanded] = expandRulesForDay([workday], "2026-11-01");
    expect(new Date(expanded.startsAt).getHours()).toBe(8);
    expect(new Date(expanded.endsAt).getHours()).toBe(16);
  });
});

describe("day summary", () => {
  it("reads a full-day block as off and a partial one as partial", () => {
    const dateKey = "2026-08-20";
    const allDay = block({
      endsAt: minutesToIso(dateKey, MINUTES_PER_DAY),
      startsAt: minutesToIso(dateKey, 0),
    });
    const morning = block({
      endsAt: minutesToIso(dateKey, 720),
      startsAt: minutesToIso(dateKey, 0),
    });

    expect(summarizeDay(dateKey, [allDay], [], []).coverage).toBe("off");
    expect(summarizeDay(dateKey, [morning], [], []).coverage).toBe("partial");
    expect(summarizeDay(dateKey, [], [], []).coverage).toBe("open");
  });

  /**
   * Two overlapping half-days are still only half a day. Counting them twice
   * would show a driver as fully off when they are available all afternoon.
   */
  it("counts overlapping blocks once", () => {
    const dateKey = "2026-08-20";
    const first = block({
      endsAt: minutesToIso(dateKey, 600),
      id: "block-a",
      startsAt: minutesToIso(dateKey, 0),
    });
    const second = block({
      endsAt: minutesToIso(dateKey, 720),
      id: "block-b",
      startsAt: minutesToIso(dateKey, 300),
    });
    expect(summarizeDay(dateKey, [first, second], [], []).coverage).toBe("partial");
  });

  it("does not treat a preferred window as blocked time", () => {
    const dateKey = "2026-08-20";
    const preferred = block({
      endsAt: minutesToIso(dateKey, MINUTES_PER_DAY),
      kind: "preferred",
      startsAt: minutesToIso(dateKey, 0),
    });
    expect(summarizeDay(dateKey, [preferred], [], []).coverage).toBe("open");
  });
});

describe("conflicts", () => {
  const state = createDemoOperationsState();
  const assigned = state.shipments.filter(
    (shipment) => shipment.assignedDriverId === "driver-brenna",
  );

  it("finds an assigned load running through a blocked span", () => {
    const load = assigned.find((shipment) => shipment.status === "dispatched") as Shipment;
    const start = load.stops[0].appointment.startsAt;
    const end = load.stops[load.stops.length - 1].appointment.endsAt;
    const conflicts = findAvailabilityConflicts(state.shipments, "driver-brenna", start, end);
    expect(conflicts.map((shipment) => shipment.id)).toContain(load.id);
  });

  it("ignores delivered loads and other drivers", () => {
    const delivered = assigned.find((shipment) => shipment.status === "delivered") as Shipment;
    const start = delivered.stops[0].appointment.startsAt;
    const end = delivered.stops[delivered.stops.length - 1].appointment.endsAt;

    expect(findAvailabilityConflicts(state.shipments, "driver-brenna", start, end)).toHaveLength(0);
    expect(findAvailabilityConflicts(state.shipments, "driver-kenji", start, end)).toHaveLength(0);
  });

  it("reports no conflict for a span nowhere near a load", () => {
    expect(
      findAvailabilityConflicts(
        state.shipments,
        "driver-brenna",
        "2029-01-01T00:00:00.000Z",
        "2029-01-02T00:00:00.000Z",
      ),
    ).toHaveLength(0);
  });
});

describe("explicit blocks over standing patterns", () => {
  it("lets a one-off available block override a recurring day off", () => {
    const dateKey = "2026-08-23";
    const sundayOff = rule();
    const workingThisSunday = block({
      endsAt: minutesToIso(dateKey, MINUTES_PER_DAY),
      kind: "available",
      startsAt: minutesToIso(dateKey, 0),
    });

    const withRuleOnly = blocksForDay([], [sundayOff], dateKey);
    expect(withRuleOnly).toHaveLength(1);
    expect(withRuleOnly[0].kind).toBe("unavailable");

    const overridden = blocksForDay([workingThisSunday], [sundayOff], dateKey);
    expect(overridden.every((entry) => entry.kind === "available")).toBe(true);
    expect(summarizeDay(dateKey, [workingThisSunday], [sundayOff], []).coverage).toBe("open");
  });

  it("anchors a date key to local midnight", () => {
    const start = localDayStart("2026-08-20");
    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(20);
  });
});
