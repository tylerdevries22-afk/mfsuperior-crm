import { OperationsDomainError } from "../domain/errors";
import type { PayoutRail } from "../domain/types";

/** What each rail accepts, and how a driver is told what it wants. */
export const PAYOUT_RAIL_RULES: Record<
  PayoutRail,
  { readonly label: string; readonly hint: string; readonly placeholder: string }
> = {
  apple_cash: {
    label: "Apple Cash",
    hint: "The phone number your Apple Cash is registered to.",
    placeholder: "+1 555 555 0100",
  },
  cash_app: {
    label: "Cash App",
    hint: "Your $cashtag, including the dollar sign.",
    placeholder: "$yourcashtag",
  },
  venmo: {
    label: "Venmo",
    hint: "Your @username, including the at sign.",
    placeholder: "@your-username",
  },
  zelle: {
    label: "Zelle",
    hint: "The phone number or email your bank has enrolled in Zelle.",
    placeholder: "you@example.com",
  },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{6,17}[0-9]$/;
const VENMO_PATTERN = /^@[A-Za-z0-9_-]{3,30}$/;
const CASHTAG_PATTERN = /^\$[A-Za-z][A-Za-z0-9_]{1,19}$/;

/**
 * Rejects anything that is not a handle for the chosen rail. This is a
 * correctness guard, not a security boundary: it exists so a driver cannot
 * quietly save a handle that will never receive their settlement, and so a
 * card or account number typed into the wrong box is refused outright.
 */
export function normalizePayoutHandle(rail: PayoutRail, rawHandle: string): string {
  const handle = rawHandle.trim();
  if (handle.length === 0) {
    throw new OperationsDomainError("VALIDATION_FAILED", "Enter a handle before saving.");
  }

  if (looksLikeAccountNumber(handle)) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "That looks like a card or account number. Enter the handle for the app instead — MF Superior never stores account numbers.",
    );
  }

  if (rail === "venmo") {
    const candidate = handle.startsWith("@") ? handle : `@${handle}`;
    return assertMatches(candidate, VENMO_PATTERN, "Venmo usernames look like @your-username.");
  }

  if (rail === "cash_app") {
    const candidate = handle.startsWith("$") ? handle : `$${handle}`;
    return assertMatches(candidate, CASHTAG_PATTERN, "Cashtags look like $yourcashtag.");
  }

  if (rail === "apple_cash") {
    return assertMatches(handle, PHONE_PATTERN, "Enter the phone number your Apple Cash uses.");
  }

  if (EMAIL_PATTERN.test(handle) || PHONE_PATTERN.test(handle)) {
    return handle;
  }
  throw new OperationsDomainError(
    "VALIDATION_FAILED",
    "Enter the phone number or email enrolled in Zelle.",
  );
}

/**
 * What an admin is allowed to see. Payouts name the rail a driver was paid on
 * so a settlement can be reconciled, but never the handle itself.
 */
export function maskPayoutHandle(handle: string): string {
  const visible = handle.slice(-4);
  const lead = handle.startsWith("@") || handle.startsWith("$") ? handle[0] : "";
  return `${lead}••••${visible}`;
}

function assertMatches(handle: string, pattern: RegExp, safeMessage: string): string {
  if (!pattern.test(handle)) {
    throw new OperationsDomainError("VALIDATION_FAILED", safeMessage);
  }
  return handle;
}

/**
 * A run of 12 or more digits is a card or bank account, never a handle. Zelle
 * phone numbers top out well below that once separators are removed.
 */
function looksLikeAccountNumber(handle: string): boolean {
  const digits = handle.replace(/\D/g, "");
  return digits.length >= 12 && !handle.includes("@");
}
