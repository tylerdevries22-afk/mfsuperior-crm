import { createDemoOperationsState } from "@/domain/fixtures";

import {
  formatSettlementPeriod,
  isPeriodSettled,
  nextSettlementPeriod,
  shiftWeeks,
  weekContaining,
} from "../utils";

const state = createDemoOperationsState();
const DRIVER_IDS = state.drivers.map((driver) => driver.id);
// The fixture clock: Thursday 2026-08-20.
const NOW = new Date("2026-08-20T13:00:00.000Z");

describe("week windows", () => {
  it("aligns to Sunday and spans exactly seven days", () => {
    const week = weekContaining(NOW);
    expect(new Date(week.start).getDay()).toBe(0);
    expect(Date.parse(week.end) - Date.parse(week.start)).toBe(7 * 86_400_000);
  });

  it("shifts whole weeks in both directions", () => {
    const week = weekContaining(NOW);
    expect(Date.parse(week.start) - Date.parse(shiftWeeks(week, -1).start)).toBe(7 * 86_400_000);
    expect(Date.parse(shiftWeeks(week, 1).start) - Date.parse(week.start)).toBe(7 * 86_400_000);
  });

  it("names the last day inside the window, not the exclusive end", () => {
    const week = weekContaining(NOW);
    // The window runs Sun 16 through Sun 23 exclusive, so it reads as 16–22.
    expect(formatSettlementPeriod(week)).toBe("Aug 16 – 22");
  });
});

describe("already-settled detection", () => {
  it("sees the seeded settlements over their own weeks", () => {
    const paidWeek = weekContaining(new Date("2026-08-05T12:00:00.000Z"));
    expect(isPeriodSettled(state.payouts, "driver-brenna", paidWeek)).toBe(true);
  });

  it("leaves the current week open", () => {
    expect(isPeriodSettled(state.payouts, "driver-brenna", weekContaining(NOW))).toBe(false);
  });

  it("does not confuse one driver's settlement for another's", () => {
    const paidWeek = weekContaining(new Date("2026-08-05T12:00:00.000Z"));
    expect(isPeriodSettled(state.payouts, "driver-kenji", paidWeek)).toBe(false);
  });
});

describe("choosing a period", () => {
  /**
   * The fixture's one delivered load lands Tuesday of the current week and is
   * deliberately unsettled, so the console should offer that week rather than
   * the already-settled one before it.
   */
  it("offers the week holding the unsettled delivery", () => {
    const period = nextSettlementPeriod(state.shipments, state.payouts, DRIVER_IDS, NOW);
    expect(period).toEqual(weekContaining(NOW));
  });

  it("falls back to the last closed week when nothing is owed", () => {
    const period = nextSettlementPeriod([], state.payouts, DRIVER_IDS, NOW);
    expect(period).toEqual(shiftWeeks(weekContaining(NOW), -1));
  });

  it("skips a week whose work is already settled", () => {
    // Settle the current week too; the walk-back should find nothing owed and
    // fall through to the last closed week.
    const settled = [
      ...state.payouts,
      {
        ...state.payouts[0],
        id: "payout-current",
        periodEnd: weekContaining(NOW).end,
        periodStart: weekContaining(NOW).start,
      },
    ];
    const period = nextSettlementPeriod(state.shipments, settled, DRIVER_IDS, NOW);
    expect(period).toEqual(shiftWeeks(weekContaining(NOW), -1));
  });
});
