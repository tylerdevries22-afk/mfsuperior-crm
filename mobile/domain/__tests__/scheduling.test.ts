import { describe, expect, it } from "@jest/globals";

import { createDemoOperationsState } from "../fixtures";
import { driverShiftConflict, eligibleCoverageDrivers, rangesOverlap } from "../scheduling";

describe("driver scheduling rules", () => {
  const state = createDemoOperationsState();
  const shift = state.driverShifts.find((candidate) => candidate.id === "shift-samuel-evening");

  it("treats touching windows as available but overlapping windows as conflicts", () => {
    expect(rangesOverlap("2026-08-24T08:00:00.000Z", "2026-08-24T12:00:00.000Z", "2026-08-24T12:00:00.000Z", "2026-08-24T16:00:00.000Z")).toBe(false);
    expect(rangesOverlap("2026-08-24T08:00:00.000Z", "2026-08-24T12:01:00.000Z", "2026-08-24T12:00:00.000Z", "2026-08-24T16:00:00.000Z")).toBe(true);
  });

  it("rejects a shift that overlaps a blocked calendar window", () => {
    expect(shift).toBeDefined();
    const conflict = driverShiftConflict(state, {
      driverId: "driver-brenna",
      endsAt: "2026-08-21T12:00:00.000Z",
      id: "new-shift",
      startsAt: "2026-08-21T08:00:00.000Z",
    });
    expect(conflict).toMatch(/blocked time/);
  });

  it("returns only conflict-free drivers and ranks available drivers first", () => {
    expect(shift).toBeDefined();
    const candidates = eligibleCoverageDrivers(state, shift ?? state.driverShifts[0]);
    expect(candidates.map(({ driver }) => driver.id)).toContain("driver-brenna");
    expect(candidates.map(({ driver }) => driver.id)).not.toContain("driver-alicia");
    expect(candidates[0]?.driver.status).toBe("available");
  });
});
