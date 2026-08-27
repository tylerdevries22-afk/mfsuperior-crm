import type { Payout, PayoutMethod, PayoutRail, PayoutStatus } from "@/domain/types";

/**
 * Payout rail presentation and hand-off.
 *
 * Only two of the four rails publish a link that opens the app on a specific
 * account. Zelle lives inside each bank's own app and has no public scheme,
 * and Apple Cash is reached through Messages or Wallet with no addressable
 * entry point. Those two are copy-only, and the screen says so rather than
 * offering a button that would fail silently on most devices.
 */

export interface RailPresentation {
  readonly rail: PayoutRail;
  readonly label: string;
  readonly deepLink: ((handle: string) => string) | null;
  /** Why the rail cannot be opened, shown in place of an Open button. */
  readonly handoffNote: string;
}

export const RAIL_PRESENTATION: readonly RailPresentation[] = [
  {
    deepLink: (handle) => `https://venmo.com/u/${encodeURIComponent(stripPrefix(handle))}`,
    handoffNote: "Opens your profile in Venmo.",
    label: "Venmo",
    rail: "venmo",
  },
  {
    deepLink: (handle) => `https://cash.app/${encodeURIComponent(handle)}`,
    handoffNote: "Opens your Cash App profile.",
    label: "Cash App",
    rail: "cash_app",
  },
  {
    deepLink: null,
    handoffNote: "Zelle runs inside your bank's own app, so there is no link to open. Copy the handle and paste it there.",
    label: "Zelle",
    rail: "zelle",
  },
  {
    deepLink: null,
    handoffNote: "Apple Cash is sent from Messages or Wallet. Copy the number and use it there.",
    label: "Apple Cash",
    rail: "apple_cash",
  },
];

export function presentationFor(rail: PayoutRail): RailPresentation {
  const found = RAIL_PRESENTATION.find((entry) => entry.rail === rail);
  if (!found) {
    throw new Error(`Unhandled payout rail: ${rail}`);
  }
  return found;
}

/** The link that opens this handle in its app, or null when there is none. */
export function payoutHandoffUrl(rail: PayoutRail, handle: string): string | null {
  const presentation = presentationFor(rail);
  return presentation.deepLink ? presentation.deepLink(handle) : null;
}

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  failed: "Failed",
  paid: "Paid",
  pending: "Pending",
  processing: "Processing",
};

export function methodForRail(
  methods: readonly PayoutMethod[],
  rail: PayoutRail,
): PayoutMethod | null {
  return methods.find((method) => method.rail === rail) ?? null;
}

export function defaultMethod(methods: readonly PayoutMethod[]): PayoutMethod | null {
  return methods.find((method) => method.isDefault) ?? null;
}

export interface EarningsSummary {
  readonly pendingCents: number;
  readonly paidCents: number;
  readonly lifetimeCents: number;
  readonly nextPayout: Payout | null;
}

/**
 * What the driver is owed versus what has landed. Failed settlements count as
 * neither: money that did not arrive should not read as paid, and a settlement
 * that has to be reissued should not read as still coming.
 */
export function summarizeEarnings(payouts: readonly Payout[]): EarningsSummary {
  let pendingCents = 0;
  let paidCents = 0;

  for (const payout of payouts) {
    if (payout.status === "paid") {
      paidCents += payout.netCents;
    } else if (payout.status === "pending" || payout.status === "processing") {
      pendingCents += payout.netCents;
    }
  }

  const nextPayout = [...payouts]
    .filter((payout) => payout.status === "pending" || payout.status === "processing")
    .sort((left, right) => Date.parse(left.periodEnd) - Date.parse(right.periodEnd))[0] ?? null;

  return { lifetimeCents: paidCents, nextPayout, paidCents, pendingCents };
}

/** Newest settlement period first. */
export function sortPayouts(payouts: readonly Payout[]): readonly Payout[] {
  return [...payouts].sort(
    (left, right) => Date.parse(right.periodEnd) - Date.parse(left.periodEnd),
  );
}

export function formatPeriod(payout: Payout): string {
  const start = new Date(payout.periodStart);
  const end = new Date(payout.periodEnd);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  return `${startLabel} – ${endLabel}`;
}

function stripPrefix(handle: string): string {
  return handle.replace(/^[@$]/, "");
}
