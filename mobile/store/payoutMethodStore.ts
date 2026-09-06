import { OperationsDomainError } from "../domain/errors";
import { PAYOUT_RAILS, type EntityId, type PayoutMethod, type PayoutMethodInput } from "../domain/types";
import type { AuthSessionStorage } from "../lib/auth/secureStore";
import { normalizePayoutHandle } from "./payoutHandleRules";
import { createPayoutSecureStorage } from "./payoutStorage";
export { maskPayoutHandle, normalizePayoutHandle, PAYOUT_RAIL_RULES } from "./payoutHandleRules";

const PAYOUT_METHOD_KEY = "payout-methods";

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
