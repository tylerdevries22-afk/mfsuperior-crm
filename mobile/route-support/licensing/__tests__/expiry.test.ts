import { createDemoOperationsState } from "@/domain/fixtures";

import {
  bucketFor,
  buildComplianceEntries,
  countNeedingAttention,
  daysUntil,
  describeRemaining,
  groupByBucket,
} from "../utils";

const state = createDemoOperationsState();
// The fixtures anchor here; the seeded expiries are staggered around it.
const NOW = new Date("2026-08-20T13:00:00.000Z");

describe("day counting", () => {
  it("counts whole days forward and backward", () => {
    expect(daysUntil("2026-08-20T12:00:00.000Z", NOW)).toBe(0);
    expect(daysUntil("2026-08-21T12:00:00.000Z", NOW)).toBe(1);
    expect(daysUntil("2026-08-18T12:00:00.000Z", NOW)).toBe(-2);
  });

  /**
   * Both stamps collapse to local midnight first, so the answer cannot change
   * as the clock moves through the day.
   */
  it("gives the same answer at any hour of the day", () => {
    const morning = daysUntil("2026-09-01T12:00:00.000Z", new Date("2026-08-20T06:00:00.000Z"));
    const evening = daysUntil("2026-09-01T12:00:00.000Z", new Date("2026-08-20T23:00:00.000Z"));
    expect(morning).toBe(evening);
  });

  /**
   * The reason the fixtures stamp calendar dates at midday. At midnight UTC a
   * document reads as expiring a day early everywhere west of Greenwich.
   */
  it("keeps a midday-stamped date on its own calendar day", () => {
    const reference = new Date("2026-09-01T13:00:00.000Z");
    expect(daysUntil("2026-09-01T12:00:00.000Z", reference)).toBe(0);
  });
});

describe("buckets", () => {
  it("puts each span in its band, including both boundaries", () => {
    expect(bucketFor(-1)).toBe("expired");
    expect(bucketFor(0)).toBe("urgent");
    expect(bucketFor(30)).toBe("urgent");
    expect(bucketFor(31)).toBe("soon");
    expect(bucketFor(90)).toBe("soon");
    expect(bucketFor(91)).toBe("ok");
  });

  it("describes each band in plain words", () => {
    expect(describeRemaining(-2)).toBe("Expired 2 days ago");
    expect(describeRemaining(-1)).toBe("Expired 1 day ago");
    expect(describeRemaining(0)).toBe("Expires today");
    expect(describeRemaining(1)).toBe("1 day left");
    expect(describeRemaining(45)).toBe("45 days left");
  });
});

describe("compliance register", () => {
  const entries = buildComplianceEntries(
    state.complianceDocuments,
    state.vehicles,
    state.drivers,
    NOW,
  );

  it("resolves every document to a named vehicle or driver", () => {
    expect(entries).toHaveLength(state.complianceDocuments.length);
    for (const entry of entries) {
      expect(entry.subjectLabel).not.toBe("Unknown");
    }
  });

  it("sorts the most urgent first", () => {
    const days = entries.map((entry) => entry.daysRemaining);
    expect([...days].sort((left, right) => left - right)).toEqual(days);
  });

  /**
   * The fixtures deliberately seed all four bands so every state on the
   * licensing screen has something to render.
   */
  it("covers every bucket from the seeded data", () => {
    const buckets = new Set(entries.map((entry) => entry.bucket));
    expect(buckets).toContain("expired");
    expect(buckets).toContain("urgent");
    expect(buckets).toContain("soon");
    expect(buckets).toContain("ok");
  });

  it("groups into non-empty bands in urgency order", () => {
    const groups = groupByBucket(entries);
    expect(groups[0].bucket).toBe("expired");
    for (const group of groups) {
      expect(group.entries.length).toBeGreaterThan(0);
    }
  });

  it("counts expired and urgent as needing attention", () => {
    const expected = entries.filter(
      (entry) => entry.bucket === "expired" || entry.bucket === "urgent",
    ).length;
    expect(countNeedingAttention(entries)).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });
});
