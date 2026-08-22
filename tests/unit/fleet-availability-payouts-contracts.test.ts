import { describe, expect, it } from "vitest";

import {
  availabilityBlockWriteSchema,
  availabilityRuleWriteSchema,
  complianceWriteSchema,
  maintenanceCreateSchema,
  payoutIssueSchema,
  payoutMethodWriteSchema,
  payoutPaymentSchema,
  vehicleAssignmentSchema,
  vehicleWriteSchema,
} from "@/lib/mobile-api/contracts";

const START = "2026-09-02T06:00:00.000Z";
const END = "2026-09-02T18:00:00.000Z";
const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("availability block contract", () => {
  it("accepts a well-formed block", () => {
    const parsed = availabilityBlockWriteSchema.safeParse({
      endsAt: END,
      kind: "unavailable",
      startsAt: START,
    });
    expect(parsed.success).toBe(true);
  });

  /** `.strict()` is what stops an unknown field riding along into a write. */
  it("rejects an unknown field", () => {
    const parsed = availabilityBlockWriteSchema.safeParse({
      driverId: UUID,
      endsAt: END,
      isAdmin: true,
      kind: "unavailable",
      startsAt: START,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a block that ends before it starts", () => {
    const parsed = availabilityBlockWriteSchema.safeParse({
      endsAt: START,
      kind: "unavailable",
      startsAt: END,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    const parsed = availabilityBlockWriteSchema.safeParse({
      endsAt: END,
      kind: "vacation",
      startsAt: START,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-ISO timestamp", () => {
    const parsed = availabilityBlockWriteSchema.safeParse({
      endsAt: "2026-09-02",
      kind: "unavailable",
      startsAt: START,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("availability rule contract", () => {
  it("accepts a weekday span inside one day", () => {
    const parsed = availabilityRuleWriteSchema.safeParse({
      effectiveFrom: START,
      endMinute: 1_440,
      kind: "unavailable",
      startMinute: 0,
      weekday: 0,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a span that runs past midnight", () => {
    const parsed = availabilityRuleWriteSchema.safeParse({
      effectiveFrom: START,
      endMinute: 1_500,
      kind: "unavailable",
      startMinute: 0,
      weekday: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a weekday outside 0 through 6", () => {
    for (const weekday of [-1, 7]) {
      const parsed = availabilityRuleWriteSchema.safeParse({
        effectiveFrom: START,
        endMinute: 600,
        kind: "unavailable",
        startMinute: 0,
        weekday,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("rejects an inverted span", () => {
    const parsed = availabilityRuleWriteSchema.safeParse({
      effectiveFrom: START,
      endMinute: 100,
      kind: "unavailable",
      startMinute: 600,
      weekday: 0,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("payout method contract", () => {
  it("accepts a handle for each rail", () => {
    for (const [rail, handle] of [
      ["venmo", "@brenna-lewis"],
      ["cash_app", "$brennalewis"],
      ["zelle", "brenna@example.com"],
      ["apple_cash", "+1 720 555 0177"],
    ] as const) {
      expect(payoutMethodWriteSchema.safeParse({ handle, rail }).success).toBe(true);
    }
  });

  /**
   * The boundary guard. A card or bank account number must be refused before it
   * can reach a column, whatever the client believes it is sending.
   */
  it("rejects a card or account number", () => {
    for (const handle of ["4111111111111111", "4111 1111 1111 1111", "123456789012"]) {
      const parsed = payoutMethodWriteSchema.safeParse({ handle, rail: "venmo" });
      expect(parsed.success).toBe(false);
    }
  });

  it("still accepts a long email that happens to contain digits", () => {
    const parsed = payoutMethodWriteSchema.safeParse({
      handle: "driver1234567890@example.com",
      rail: "zelle",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown rail and an over-long handle", () => {
    expect(payoutMethodWriteSchema.safeParse({ handle: "@x", rail: "paypal" }).success).toBe(false);
    expect(
      payoutMethodWriteSchema.safeParse({ handle: "@".padEnd(300, "a"), rail: "venmo" }).success,
    ).toBe(false);
  });
});

describe("vehicle contract", () => {
  const valid = {
    make: "Freightliner",
    model: "Cascadia",
    odometerMiles: 412_880,
    plateNumber: "CO-77412",
    plateState: "CO",
    status: "active" as const,
    type: "tractor" as const,
    unitNumber: "T-101",
    vin: "1FUJGLDR8CLBP8834",
    year: 2022,
  };

  it("accepts a complete unit", () => {
    expect(vehicleWriteSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a 17-character VIN", () => {
    expect(vehicleWriteSchema.safeParse({ ...valid, vin: "TOOSHORT" }).success).toBe(false);
  });

  it("rejects a negative odometer and an impossible year", () => {
    expect(vehicleWriteSchema.safeParse({ ...valid, odometerMiles: -1 }).success).toBe(false);
    expect(vehicleWriteSchema.safeParse({ ...valid, year: 1900 }).success).toBe(false);
  });

  it("allows unassigning a unit with an explicit null", () => {
    expect(vehicleAssignmentSchema.safeParse({ driverId: null }).success).toBe(true);
    expect(vehicleAssignmentSchema.safeParse({ driverId: UUID }).success).toBe(true);
    expect(vehicleAssignmentSchema.safeParse({}).success).toBe(false);
  });
});

describe("maintenance contract", () => {
  it("accepts a minimal work order and defaults its description", () => {
    const parsed = maintenanceCreateSchema.safeParse({
      kind: "repair",
      severity: "high",
      summary: "Aftertreatment fault",
      vehicleId: UUID,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.description).toBe("");
    }
  });

  it("rejects a negative cost and an unknown severity", () => {
    expect(maintenanceCreateSchema.safeParse({
      costCents: -1,
      kind: "repair",
      severity: "high",
      summary: "Brakes",
      vehicleId: UUID,
    }).success).toBe(false);
    expect(maintenanceCreateSchema.safeParse({
      kind: "repair",
      severity: "catastrophic",
      summary: "Brakes",
      vehicleId: UUID,
    }).success).toBe(false);
  });
});

describe("compliance contract", () => {
  it("rejects a document that expires before it was issued", () => {
    const parsed = complianceWriteSchema.safeParse({
      expiresOn: "2025-01-01T12:00:00.000Z",
      identifier: "CO-77412",
      issuedOn: "2026-01-01T12:00:00.000Z",
      issuingState: "CO",
      kind: "registration",
      subjectId: UUID,
      subjectType: "vehicle",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a valid document", () => {
    const parsed = complianceWriteSchema.safeParse({
      expiresOn: "2027-01-01T12:00:00.000Z",
      identifier: "CO-77412",
      issuedOn: "2026-01-01T12:00:00.000Z",
      issuingState: "CO",
      kind: "registration",
      subjectId: UUID,
      subjectType: "vehicle",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("settlement contracts", () => {
  it("rejects a period that ends before it starts", () => {
    const parsed = payoutIssueSchema.safeParse({
      driverId: UUID,
      periodEnd: "2026-08-16T06:00:00.000Z",
      periodStart: "2026-08-23T06:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a well-formed period", () => {
    const parsed = payoutIssueSchema.safeParse({
      driverId: UUID,
      periodEnd: "2026-08-23T06:00:00.000Z",
      periodStart: "2026-08-16T06:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  /** Marking paid names the rail. A handle must not be accepted here at all. */
  it("accepts only a rail when recording payment", () => {
    expect(payoutPaymentSchema.safeParse({ rail: "venmo" }).success).toBe(true);
    expect(
      payoutPaymentSchema.safeParse({ handle: "@brenna-lewis", rail: "venmo" }).success,
    ).toBe(false);
  });
});
