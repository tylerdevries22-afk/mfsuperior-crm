import * as SecureStore from "expo-secure-store";

import { OperationsDomainError } from "../domain/errors";
import {
  PAYOUT_RAILS,
  type EntityId,
  type PayoutMethod,
  type PayoutMethodInput,
  type PayoutRail,
} from "../domain/types";
import {
  ChunkedSecureStoreAdapter,
  type AuthSessionStorage,
} from "../lib/auth/secureStore";

/**
 * Payout handles live in the device keychain, not in the AsyncStorage
 * operations blob.
 *
 * A handle is an account identifier a driver publishes anyway — a Venmo
 * username, a Cash App cashtag, the phone or email behind Zelle or Apple Cash.
 * It is still personally identifying, and it is the one field in this app that
 * would let someone else be paid in a driver's place, so it is kept out of the
 * state that every screen reads and out of anything an admin can select.
 */
const PAYOUT_METHOD_KEY = "payout-methods";
const PAYOUT_METHOD_NAMESPACE = "mfsp.payout.v1";

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

export interface PayoutMethodStoreOptions {
  readonly storage?: AuthSessionStorage;
  readonly clock?: () => string;
  readonly idFactory?: () => string;
}

export class PayoutMethodStore {
  private readonly storage: AuthSessionStorage;
  private readonly clock: () => string;
  private readonly idFactory: () => string;
  private sequence = 0;

  constructor(options: PayoutMethodStoreOptions = {}) {
    this.storage = options.storage ?? createPayoutSecureStorage();
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? (() => {
      this.sequence += 1;
      return `payout-method-${Date.parse(this.clock())}-${this.sequence}`;
    });
  }

  async list(driverId: EntityId): Promise<readonly PayoutMethod[]> {
    const stored = await this.read();
    return stored.filter((method) => method.driverId === driverId);
  }

  async save(driverId: EntityId, input: PayoutMethodInput): Promise<PayoutMethod> {
    const handle = normalizePayoutHandle(input.rail, input.handle);
    const now = this.clock();
    const stored = await this.read();
    const existing = input.id
      ? stored.find((method) => method.id === input.id && method.driverId === driverId)
      : stored.find((method) => method.driverId === driverId && method.rail === input.rail);

    // One saved handle per rail. A driver replacing their Venmo handle means
    // exactly that, not a second Venmo row a settlement could pick between.
    const method: PayoutMethod = {
      createdAt: existing?.createdAt ?? now,
      driverId,
      handle,
      id: existing?.id ?? this.idFactory(),
      isDefault: input.isDefault ?? existing?.isDefault ?? !stored.some(
        (candidate) => candidate.driverId === driverId && candidate.isDefault,
      ),
      label: input.label ?? existing?.label,
      rail: input.rail,
      updatedAt: now,
    };

    const others = stored.filter((candidate) => candidate.id !== method.id);
    const merged = [...others, method];
    // Only move the default when this save actually claims it. Re-applying
    // unconditionally cleared the existing default every time a driver added a
    // second, non-default rail, leaving them with handles and nothing marked.
    await this.write(method.isDefault ? applyDefault(merged, driverId, method.id) : merged);
    return method;
  }

  async remove(driverId: EntityId, methodId: EntityId): Promise<readonly PayoutMethod[]> {
    const stored = await this.read();
    const target = stored.find((method) => method.id === methodId && method.driverId === driverId);
    if (!target) {
      throw new OperationsDomainError("NOT_FOUND", "That payout method could not be found.");
    }

    const remaining = stored.filter((method) => method.id !== methodId);
    // Removing the default promotes the next remaining method rather than
    // leaving the driver with handles but nowhere marked to pay.
    const promoted = target.isDefault
      ? remaining.find((method) => method.driverId === driverId)?.id ?? null
      : null;
    const next = promoted ? applyDefault(remaining, driverId, promoted) : remaining;
    await this.write(next);
    return next.filter((method) => method.driverId === driverId);
  }

  async setDefault(driverId: EntityId, methodId: EntityId): Promise<readonly PayoutMethod[]> {
    const stored = await this.read();
    if (!stored.some((method) => method.id === methodId && method.driverId === driverId)) {
      throw new OperationsDomainError("NOT_FOUND", "That payout method could not be found.");
    }
    const next = applyDefault(stored, driverId, methodId);
    await this.write(next);
    return next.filter((method) => method.driverId === driverId);
  }

  private async read(): Promise<readonly PayoutMethod[]> {
    const raw = await this.storage.getItem(PAYOUT_METHOD_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isPayoutMethod) : [];
    } catch {
      // A keychain entry we cannot read is discarded rather than surfaced. The
      // driver re-enters a handle; nothing else in the app depends on it.
      return [];
    }
  }

  private async write(methods: readonly PayoutMethod[]): Promise<void> {
    if (methods.length === 0) {
      await this.storage.removeItem(PAYOUT_METHOD_KEY);
      return;
    }
    await this.storage.setItem(PAYOUT_METHOD_KEY, JSON.stringify(methods));
  }
}

function applyDefault(
  methods: readonly PayoutMethod[],
  driverId: EntityId,
  defaultId: EntityId | null,
): readonly PayoutMethod[] {
  return methods.map((method) => method.driverId === driverId
    ? { ...method, isDefault: method.id === defaultId }
    : method);
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

function isPayoutMethod(value: unknown): value is PayoutMethod {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.driverId === "string" &&
    typeof candidate.handle === "string" &&
    typeof candidate.isDefault === "boolean" &&
    typeof candidate.rail === "string" &&
    (PAYOUT_RAILS as readonly string[]).includes(candidate.rail)
  );
}

function createPayoutSecureStorage(): AuthSessionStorage {
  return new ChunkedSecureStoreAdapter(
    {
      deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
      getItemAsync: (key) => SecureStore.getItemAsync(key),
      setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
    },
    { namespace: PAYOUT_METHOD_NAMESPACE },
  );
}
