import { useCallback, useMemo, useState } from "react";

import { buildPayoutLineItems, summarizePayout, type PayoutTotals } from "@/domain/payouts";
import type { Driver, Payout, PayoutLineItem } from "@/domain/types";
import { sortPayouts } from "@/route-support/driver-payments/utils";
import {
  earliestOpenPeriod,
  nextPeriodForDriver,
  type SettlementPeriod,
} from "@/route-support/payouts/utils";
import { useOperations } from "@/store";

export interface SettlementDraft {
  readonly driver: Driver;
  readonly lineItems: readonly PayoutLineItem[];
  readonly period: SettlementPeriod | null;
  readonly totals: PayoutTotals;
}

export interface SettlementLedger {
  readonly busy: string | null;
  readonly clearIssueError: () => void;
  readonly drafts: readonly SettlementDraft[];
  readonly headerPeriod: SettlementPeriod | null;
  readonly issue: (driverId: string, period: SettlementPeriod) => Promise<void>;
  readonly issueError: string | null;
  readonly ordered: readonly Payout[];
  readonly totals: { readonly paidCents: number; readonly pendingCents: number };
}

/** Ledger state behind the settlements console: history, totals, and drafts. */
export function useSettlementLedger(): SettlementLedger {
  const { actions, payouts, shipments, state } = useOperations();
  const [busy, setBusy] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  const ordered = useMemo(() => sortPayouts(payouts), [payouts]);
  const headerPeriod = useMemo(
    () => earliestOpenPeriod(shipments, payouts, state.drivers.map((driver) => driver.id)),
    [payouts, shipments, state.drivers],
  );

  const totals = useMemo(() => {
    let pendingCents = 0;
    let paidCents = 0;
    for (const payout of payouts) {
      if (payout.status === "paid") paidCents += payout.netCents;
      else if (payout.status !== "failed") pendingCents += payout.netCents;
    }
    return { paidCents, pendingCents };
  }, [payouts]);

  /**
   * Each driver's own next period, previewed with the same builder the
   * repository uses so the sheet cannot disagree with what issuing produces.
   * Periods are per-driver because they run on from each driver's last
   * settlement, and two drivers rarely settled on the same day.
   */
  const drafts = useMemo<readonly SettlementDraft[]>(() => state.drivers.map((driver) => {
    const period = nextPeriodForDriver(shipments, payouts, driver.id);
    if (!period) {
      return { driver, lineItems: [], period: null, totals: summarizePayout([]) };
    }
    let sequence = 0;
    const lineItems = buildPayoutLineItems({
      driverId: driver.id,
      nextId: () => { sequence += 1; return `preview-${driver.id}-${sequence}`; },
      periodEnd: period.end,
      periodStart: period.start,
      shipments,
    });
    return { driver, lineItems, period, totals: summarizePayout(lineItems) };
  }), [payouts, shipments, state.drivers]);

  const issue = useCallback(async (driverId: string, period: SettlementPeriod) => {
    setBusy(driverId);
    setIssueError(null);
    const issued = await actions.issuePayout(driverId, period.start, period.end);
    setBusy(null);
    if (!issued) {
      setIssueError("That period could not be settled. It may overlap an existing settlement or have no delivered loads.");
    }
  }, [actions]);

  const clearIssueError = useCallback(() => setIssueError(null), []);

  return { busy, clearIssueError, drafts, headerPeriod, issue, issueError, ordered, totals };
}
