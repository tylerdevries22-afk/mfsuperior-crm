import { OperationsDomainError } from "../../domain/errors";
import type {
  AppRole,
  DemoOperationsState,
  EntityId,
  OperationsAccount,
} from "../../domain/types";
import { findDriver } from "./lookups";

/** The state a demo write produces alongside the value its caller receives. */
export interface StateUpdate<Result> {
  readonly state: DemoOperationsState;
  readonly result: Result;
}

/**
 * What every demo write is handed: the state it transforms, the one clock
 * reading the whole write shares, and the repository's own id sequence.
 */
export interface DemoWriteContext {
  readonly state: DemoOperationsState;
  readonly occurredAt: string;
  readonly nextId: (prefix: string) => string;
}

export interface SessionContext {
  readonly account: OperationsAccount;
  readonly effectiveRole: AppRole;
  readonly customerId?: EntityId;
  readonly driverId?: EntityId;
}

export function getSessionContext(state: DemoOperationsState): SessionContext {
  const account = state.accounts.find((candidate) => candidate.id === state.session.accountId);
  if (!account || !state.session.effectiveRole) {
    throw new OperationsDomainError("UNAUTHORIZED", "Sign in to use this demo action.");
  }

  const effectiveRole = state.session.effectiveRole;
  const customerId = effectiveRole === "customer"
    ? account.customerId ?? state.customers[0]?.id
    : undefined;
  const driverId = effectiveRole === "driver"
    ? account.driverId ?? state.drivers[0]?.id
    : undefined;

  return { account, effectiveRole, customerId, driverId };
}

export function requireRole(context: SessionContext, role: AppRole, safeMessage: string): void {
  if (context.effectiveRole !== role) {
    throw new OperationsDomainError("UNAUTHORIZED", safeMessage);
  }
}

export function requireCustomerId(context: SessionContext): EntityId {
  if (!context.customerId) {
    throw new OperationsDomainError("NOT_FOUND", "The demo customer could not be found.");
  }
  return context.customerId;
}

export function requireDriverId(context: SessionContext): EntityId {
  if (!context.driverId) {
    throw new OperationsDomainError("NOT_FOUND", "The demo driver could not be found.");
  }
  return context.driverId;
}

/**
 * Whose calendar this write lands on. A driver only ever writes their own, and
 * naming somebody else is refused rather than silently redirected — a screen
 * that sent the wrong driverId should fail loudly, not edit the wrong person.
 */
export function resolveAvailabilityDriverId(
  state: DemoOperationsState,
  context: SessionContext,
  requestedDriverId: EntityId | undefined,
): EntityId {
  if (context.effectiveRole === "admin") {
    const driverId = requestedDriverId ?? state.drivers[0]?.id;
    if (!driverId) {
      throw new OperationsDomainError("NOT_FOUND", "No driver was named for this calendar.");
    }
    findDriver(state, driverId);
    return driverId;
  }

  requireRole(context, "driver", "A Driver or Admin role is required to change availability.");
  const driverId = requireDriverId(context);
  if (requestedDriverId && requestedDriverId !== driverId) {
    throw new OperationsDomainError(
      "UNAUTHORIZED",
      "A driver can only change their own availability.",
    );
  }
  return driverId;
}
