import type { EntityId, IsoDateTime } from "./core";

/**
 * Where a driver wants to be paid. The handle is an account identifier a
 * driver publishes anyway — a Venmo username, a Cash App cashtag, the phone
 * or email behind Zelle or Apple Cash. It is never a card number, a bank
 * account, or a credential, and nothing in this app moves money.
 */
export const PAYOUT_RAILS = ["apple_cash", "venmo", "cash_app", "zelle"] as const;

export type PayoutRail = (typeof PAYOUT_RAILS)[number];

export interface PayoutMethod {
  readonly id: EntityId;
  readonly driverId: EntityId;
  readonly rail: PayoutRail;
  readonly handle: string;
  readonly label?: string;
  readonly isDefault: boolean;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface PayoutMethodInput {
  readonly id?: EntityId;
  readonly rail: PayoutRail;
  readonly handle: string;
  readonly label?: string;
  readonly isDefault?: boolean;
}

export const PAYOUT_STATUSES = ["pending", "processing", "paid", "failed"] as const;

export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const PAYOUT_LINE_ITEM_KINDS = [
  "linehaul",
  "accessorial",
  "detention",
  "fuel",
  "advance",
  "deduction",
] as const;

export type PayoutLineItemKind = (typeof PAYOUT_LINE_ITEM_KINDS)[number];

export interface PayoutLineItem {
  readonly id: EntityId;
  readonly shipmentId?: EntityId;
  readonly kind: PayoutLineItemKind;
  readonly description: string;
  /** Negative for deductions, so the line items always sum to `netCents`. */
  readonly amountCents: number;
}

/**
 * A settlement record. `markPayoutPaid` records that a transfer happened on
 * the named rail; it does not initiate one.
 */
export interface Payout {
  readonly id: EntityId;
  readonly driverId: EntityId;
  readonly periodStart: IsoDateTime;
  readonly periodEnd: IsoDateTime;
  readonly status: PayoutStatus;
  readonly grossCents: number;
  readonly deductionCents: number;
  readonly netCents: number;
  readonly rail?: PayoutRail;
  readonly methodId?: EntityId;
  readonly issuedAt?: IsoDateTime;
  readonly paidAt?: IsoDateTime;
  readonly lineItems: readonly PayoutLineItem[];
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}
