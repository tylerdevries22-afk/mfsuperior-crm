import { createDemoOperationsState } from "@/domain/fixtures";
import type { Shipment } from "@/domain/types";
import {
  addDays,
  buildDriverColors,
  formatDateKey,
  formatDayHeader,
  getAssignedDrivers,
  getDuration,
  getLoadColor,
  getWeekDates,
  hashColor,
  isLoadPast,
  orderedStops,
  scheduledEnd,
  scheduledStart,
  FALLBACK_COLOR,
} from "../utils";

const state = createDemoOperationsState();
const shipment = state.shipments[0] as Shipment;

describe("schedule date maths", () => {
  it("produces a ten-week window aligned to Sunday and containing today", () => {
    const week = getWeekDates(new Date("2026-08-21T18:00:00.000Z"));
    expect(week).toHaveLength(70);
    // The reference window starts four weeks before the containing Sunday.
    expect(new Date(week[0]).getUTCDay()).toBe(0);
    const keys = week.map(formatDateKey);
    expect(new Set(keys).size).toBe(70);
    expect(keys).toEqual([...keys].sort());
  });

  it("shifts by whole days without drifting across a DST boundary", () => {
    // 2026-11-01 is the US DST fall-back date; naive +24h arithmetic slips.
    const before = new Date("2026-10-31T12:00:00.000Z");
    const after = addDays(before, 1);
    expect(formatDateKey(after)).toBe("2026-11-01");
    expect(formatDateKey(addDays(after, -1))).toBe("2026-10-31");
  });

  it("labels today, yesterday, and tomorrow relative to the current day", () => {
    const todayKey = formatDateKey(new Date());
    expect(formatDayHeader(todayKey)).toContain("Today · ");
    expect(formatDayHeader(formatDateKey(addDays(new Date(), -1)))).toContain("Yesterday · ");
    expect(formatDayHeader(formatDateKey(addDays(new Date(), 1)))).toContain("Tomorrow · ");
  });

  it("formats durations the way the reference does", () => {
    expect(getDuration("2026-08-21T10:00:00Z", "2026-08-21T10:30:00Z")).toBe("30m");
    expect(getDuration("2026-08-21T10:00:00Z", "2026-08-21T12:00:00Z")).toBe("2h");
    expect(getDuration("2026-08-21T10:00:00Z", "2026-08-21T11:30:00Z")).toBe("1.5h");
  });
});

describe("load scheduling window", () => {
  it("spans the first pickup through the final delivery", () => {
    const stops = orderedStops(shipment);
    expect(stops.length).toBeGreaterThan(1);
    expect(stops.map((s) => s.sequence)).toEqual([...stops.map((s) => s.sequence)].sort((a, b) => a - b));
    expect(scheduledStart(shipment)).toBe(stops[0].appointment.startsAt);
    expect(scheduledEnd(shipment)).toBe(stops[stops.length - 1].appointment.endsAt);
  });

  it("treats closed and elapsed loads as past", () => {
    expect(isLoadPast({ ...shipment, status: "delivered" })).toBe(true);
    expect(isLoadPast({ ...shipment, status: "cancelled" })).toBe(true);
    expect(isLoadPast({ ...shipment, status: "declined" })).toBe(true);
    const future = new Date("2000-01-01T00:00:00.000Z");
    expect(isLoadPast({ ...shipment, status: "in_transit" }, future)).toBe(false);
  });
});

describe("driver identity", () => {
  it("assigns every driver a stable colour derived from their id", () => {
    const colors = buildDriverColors(state.drivers);
    expect(Object.keys(colors)).toEqual(state.drivers.map((d) => d.id));
    for (const driver of state.drivers) {
      expect(colors[driver.id]).toBe(hashColor(driver.id));
      expect(colors[driver.id]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("colours a load by its assigned driver and falls back when unassigned", () => {
    const colors = buildDriverColors(state.drivers);
    const driverId = state.drivers[0].id;
    expect(getLoadColor({ assignedDriverId: driverId }, colors)).toBe(colors[driverId]);
    expect(getLoadColor({ assignedDriverId: undefined }, colors)).toBe(FALLBACK_COLOR);
    expect(getLoadColor({ assignedDriverId: "ghost" }, colors)).toBe(FALLBACK_COLOR);
  });

  it("resolves only the driver actually assigned to the load", () => {
    const driverId = state.drivers[0].id;
    const assigned = getAssignedDrivers({ ...shipment, assignedDriverId: driverId }, state.drivers);
    expect(assigned.map((d) => d.id)).toEqual([driverId]);
    expect(getAssignedDrivers({ ...shipment, assignedDriverId: undefined }, state.drivers)).toEqual([]);
  });
});
