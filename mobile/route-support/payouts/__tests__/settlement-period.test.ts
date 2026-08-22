import { createDemoOperationsState } from "@/domain/fixtures";

import {
  earliestOpenPeriod,
  formatSettlementPeriod,
  isPeriodSettled,
  nextPeriodForDriver,
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
  it("covers the unsettled delivery", () => {
    const period = nextPeriodForDriver(state.shipments, state.payouts, "driver-brenna", NOW);
    const delivered = Date.parse(
      state.shipments.find((shipment) => shipment.status === "delivered")
        ?.stops.slice(-1)[0].completedAt ?? "",
    );
    expect(Date.parse(period?.start ?? "")).toBeLessThanOrEqual(delivered);
    expect(Date.parse(period?.end ?? "")).toBeGreaterThan(delivered);
  });

  it("proposes nothing when there is nothing delivered", () => {
    expect(nextPeriodForDriver([], state.payouts, "driver-brenna", NOW)).toBeNull();
  });

  it("names the earliest open period across the fleet for the header", () => {
    const header = earliestOpenPeriod(state.shipments, state.payouts, DRIVER_IDS, NOW);
    const brenna = nextPeriodForDriver(state.shipments, state.payouts, "driver-brenna", NOW);
    expect(header).toEqual(brenna);
  });

  it("has no header period once the fleet is square", () => {
    expect(earliestOpenPeriod([], state.payouts, DRIVER_IDS, NOW)).toBeNull();
  });
});
