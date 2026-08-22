import {
  anchorDemoStateTo,
  createDemoOperationsState,
  reanchorDemoState,
} from "@/domain/fixtures";
import { shipmentsInPeriod } from "@/domain/payouts";
import type { DemoOperationsState } from "@/domain/types";

import { isPeriodSettled, nextPeriodForDriver } from "../utils";

/**
 * The demo clock shifts every fixture timestamp by a whole number of days so
 * "today" always has work on it. Settlement periods used to be proposed as
 * calendar weeks, which meant that once the anchor moved a period off Sunday,
 * the overlap test made it block the two weeks it straddled — enough to leave
 * the Issue sheet showing zeroes for every driver at most offsets.
 *
 * Periods now run on from the previous settlement, so alignment is irrelevant.
 * These tests sweep the anchor rather than checking the canonical clock,
 * because the canonical clock was the one offset where the bug did not appear.
 */

const CANONICAL = Date.parse("2026-08-20T13:00:00.000Z");

function at(offsetDays: number): { state: DemoOperationsState; now: Date } {
  const now = new Date(CANONICAL + offsetDays * 86_400_000);
  return { now, state: anchorDemoStateTo(createDemoOperationsState(), now) };
}

/** Every offset in a ten-week span, so no week phase goes unchecked. */
const OFFSETS = Array.from({ length: 71 }, (_, index) => index);

describe("settlement periods survive the demo anchor", () => {
  it("offers a settleable period at every offset", () => {
    for (const offset of OFFSETS) {
      const { now, state } = at(offset);
      const period = nextPeriodForDriver(state.shipments, state.payouts, "driver-brenna", now);
      expect({ offset, proposed: period !== null }).toEqual({ offset, proposed: true });

      const settleable = shipmentsInPeriod(
        state.shipments,
        "driver-brenna",
        period?.start ?? "",
        period?.end ?? "",
      );
      expect({ loads: settleable.length, offset }).toEqual({ loads: 1, offset });
    }
  });

  /**
   * The failure that shipped: a proposed period that overlaps a settlement the
   * driver already has cannot be issued, so proposing one is proposing nothing.
   */
  it("never proposes a period that overlaps an existing settlement", () => {
    for (const offset of OFFSETS) {
      const { now, state } = at(offset);
      const period = nextPeriodForDriver(state.shipments, state.payouts, "driver-brenna", now);
      expect({
        offset,
        settled: period ? isPeriodSettled(state.payouts, "driver-brenna", period) : false,
      }).toEqual({ offset, settled: false });
    }
  });

  it("proposes nothing for a driver who has delivered nothing", () => {
    for (const offset of [0, 2, 4, 9]) {
      const { now, state } = at(offset);
      expect(nextPeriodForDriver(state.shipments, state.payouts, "driver-kenji", now)).toBeNull();
    }
  });

  it("runs the proposed period on from where the last settlement ended", () => {
    const { now, state } = at(2);
    const period = nextPeriodForDriver(state.shipments, state.payouts, "driver-brenna", now);
    const lastEnd = Math.max(
      ...state.payouts
        .filter((payout) => payout.driverId === "driver-brenna")
        .map((payout) => Date.parse(payout.periodEnd)),
    );
    expect(Date.parse(period?.start ?? "")).toBe(lastEnd);
  });

  it("stops proposing once the delivery has been settled", () => {
    const { now, state } = at(2);
    const period = nextPeriodForDriver(state.shipments, state.payouts, "driver-brenna", now);
    const settledState = {
      ...state,
      payouts: [
        ...state.payouts,
        {
          ...state.payouts[0],
          id: "payout-just-issued",
          periodEnd: period?.end ?? "",
          periodStart: period?.start ?? "",
        },
      ],
    };
    expect(
      nextPeriodForDriver(settledState.shipments, settledState.payouts, "driver-brenna", now),
    ).toBeNull();
  });
});

describe("re-anchoring persisted state", () => {
  /**
   * The path a relaunch takes. State saved on one day is re-anchored to the
   * next, and the correction is computed from absolute offsets rather than
   * accumulated, so repeated relaunches cannot drift.
   */
  it("lands on the same state whether anchored directly or re-anchored", () => {
    for (const [savedAt, openedAt] of [[0, 1], [0, 2], [2, 3], [3, 9], [5, 40], [9, 2]]) {
      const saved = at(savedAt).state;
      const now = new Date(CANONICAL + openedAt * 86_400_000);
      const reanchored = reanchorDemoState(saved, now);
      const direct = at(openedAt).state;

      expect({
        openedAt,
        periods: reanchored.payouts.map((payout) => payout.periodStart),
        savedAt,
      }).toEqual({
        openedAt,
        periods: direct.payouts.map((payout) => payout.periodStart),
        savedAt,
      });
      expect(reanchored.shipments[0].stops[0].appointment.startsAt)
        .toBe(direct.shipments[0].stops[0].appointment.startsAt);
    }
  });

  it("does not drift when relaunched repeatedly on the same day", () => {
    let state = at(0).state;
    const now = new Date(CANONICAL + 4 * 86_400_000);
    for (let relaunch = 0; relaunch < 5; relaunch += 1) {
      state = reanchorDemoState(state, now);
    }
    expect(state.payouts.map((payout) => payout.periodStart))
      .toEqual(at(4).state.payouts.map((payout) => payout.periodStart));
  });

  /**
   * A settlement issued inside the app moves with the rest of the demo clock,
   * and must stay settled afterwards — a re-anchor that let an already-paid
   * delivery become proposable again would offer to pay for it twice.
   */
  it("keeps a runtime settlement covering its own delivery after a re-anchor", () => {
    const base = at(2).state;
    const now = new Date(CANONICAL + 2 * 86_400_000);
    const period = nextPeriodForDriver(base.shipments, base.payouts, "driver-brenna", now);
    const withRuntime: DemoOperationsState = {
      ...base,
      payouts: [
        ...base.payouts,
        {
          ...base.payouts[0],
          id: "payout-runtime",
          periodEnd: period?.end ?? "",
          periodStart: period?.start ?? "",
        },
      ],
    };

    for (const openedAt of [3, 5, 11, 30]) {
      const later = reanchorDemoState(withRuntime, new Date(CANONICAL + openedAt * 86_400_000));
      expect({
        openedAt,
        proposable: nextPeriodForDriver(
          later.shipments,
          later.payouts,
          "driver-brenna",
          new Date(CANONICAL + openedAt * 86_400_000),
        ) !== null,
      }).toEqual({ openedAt, proposable: false });
    }
  });
});
