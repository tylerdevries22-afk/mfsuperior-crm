import { OperationsDomainError } from "@/domain/errors";
import { createDemoOperationsState } from "@/domain/fixtures";
import { summarizePayout } from "@/domain/payouts";
import type { Payout } from "@/domain/types";
import { maskPayoutHandle, normalizePayoutHandle } from "@/store/payoutMethodStore";

import {
  PAYOUT_STATUS_LABELS,
  payoutHandoffUrl,
  presentationFor,
  sortPayouts,
  summarizeEarnings,
} from "../utils";

const state = createDemoOperationsState();

describe("handle validation", () => {
  it("adds the sigil a rail expects when the driver omits it", () => {
    expect(normalizePayoutHandle("venmo", "brenna-lewis")).toBe("@brenna-lewis");
    expect(normalizePayoutHandle("cash_app", "brennalewis")).toBe("$brennalewis");
  });

  it("keeps a handle that already carries its sigil", () => {
    expect(normalizePayoutHandle("venmo", "@brenna-lewis")).toBe("@brenna-lewis");
    expect(normalizePayoutHandle("cash_app", "$brennalewis")).toBe("$brennalewis");
  });

  it("accepts either an email or a phone for Zelle", () => {
    expect(normalizePayoutHandle("zelle", "brenna@example.com")).toBe("brenna@example.com");
    expect(normalizePayoutHandle("zelle", "+1 720 555 0177")).toBe("+1 720 555 0177");
  });

  it("requires a phone number for Apple Cash", () => {
    expect(normalizePayoutHandle("apple_cash", "+1 720 555 0177")).toBe("+1 720 555 0177");
    expect(() => normalizePayoutHandle("apple_cash", "brenna@example.com")).toThrow(
      OperationsDomainError,
    );
  });

  /**
   * The guard that matters. A driver who pastes a debit card into the handle
   * box must be refused outright rather than have it written to the keychain.
   */
  it("refuses anything that looks like a card or account number", () => {
    for (const rail of ["venmo", "cash_app", "zelle", "apple_cash"] as const) {
      expect(() => normalizePayoutHandle(rail, "4111111111111111")).toThrow(/never stores account numbers/);
      expect(() => normalizePayoutHandle(rail, "4111 1111 1111 1111")).toThrow(/never stores account numbers/);
    }
  });

  it("refuses an empty handle", () => {
    expect(() => normalizePayoutHandle("venmo", "   ")).toThrow(OperationsDomainError);
  });

  it("refuses a malformed handle for its rail", () => {
    expect(() => normalizePayoutHandle("venmo", "@ab")).toThrow(OperationsDomainError);
    expect(() => normalizePayoutHandle("cash_app", "$1nvalid")).toThrow(OperationsDomainError);
    expect(() => normalizePayoutHandle("zelle", "not-a-contact")).toThrow(OperationsDomainError);
  });

  it("masks a handle down to its sigil and last four", () => {
    expect(maskPayoutHandle("@brenna-lewis")).toBe("@••••ewis");
    expect(maskPayoutHandle("brenna@example.com")).toBe("••••.com");
  });
});

describe("rail hand-off", () => {
  it("builds a profile link for the rails that publish one", () => {
    expect(payoutHandoffUrl("venmo", "@brenna-lewis")).toBe("https://venmo.com/u/brenna-lewis");
    expect(payoutHandoffUrl("cash_app", "$brennalewis")).toBe("https://cash.app/%24brennalewis");
  });

  /**
   * Zelle and Apple Cash have no addressable entry point. Returning null is
   * what lets the screen show an explanation instead of a button that would
   * do nothing.
   */
  it("offers no link for the rails that have none", () => {
    expect(payoutHandoffUrl("zelle", "brenna@example.com")).toBeNull();
    expect(payoutHandoffUrl("apple_cash", "+17205550177")).toBeNull();
    expect(presentationFor("zelle").handoffNote).toMatch(/bank/i);
  });

  it("names every rail", () => {
    for (const rail of ["venmo", "cash_app", "zelle", "apple_cash"] as const) {
      expect(presentationFor(rail).label.length).toBeGreaterThan(0);
    }
  });
});

describe("earnings", () => {
  const payouts = state.payouts;

  it("splits paid from still-owed", () => {
    const summary = summarizeEarnings(payouts);
    const paid = payouts.filter((payout) => payout.status === "paid");
    const pending = payouts.filter((payout) => payout.status === "pending");
    expect(summary.paidCents).toBe(paid.reduce((sum, payout) => sum + payout.netCents, 0));
    expect(summary.pendingCents).toBe(pending.reduce((sum, payout) => sum + payout.netCents, 0));
  });

  it("counts a failed settlement as neither paid nor pending", () => {
    const failed: Payout = { ...payouts[0], id: "payout-failed", status: "failed" };
    const summary = summarizeEarnings([failed]);
    expect(summary.paidCents).toBe(0);
    expect(summary.pendingCents).toBe(0);
    expect(summary.nextPayout).toBeNull();
  });

  it("points at the earliest unpaid period as the next payout", () => {
    const summary = summarizeEarnings(payouts);
    expect(summary.nextPayout?.status).toBe("pending");
  });

  it("orders settlements newest first", () => {
    const ordered = sortPayouts(payouts).map((payout) => payout.periodEnd);
    expect([...ordered].sort().reverse()).toEqual(ordered);
  });

  it("agrees with the settlement builder on every fixture payout", () => {
    for (const payout of payouts) {
      const totals = summarizePayout(payout.lineItems);
      expect(totals.grossCents).toBe(payout.grossCents);
      expect(totals.deductionCents).toBe(payout.deductionCents);
      expect(totals.netCents).toBe(payout.netCents);
    }
  });

  it("labels every status", () => {
    expect(Object.keys(PAYOUT_STATUS_LABELS)).toHaveLength(4);
  });
});
