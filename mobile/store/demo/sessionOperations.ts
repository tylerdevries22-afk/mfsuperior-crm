import { OperationsDomainError } from "../../domain/errors";
import type { AppRole, DemoOperationsState } from "../../domain/types";
import { getSessionContext, type DemoWriteContext, type StateUpdate } from "./context";

export function signIn(
  { state, occurredAt }: DemoWriteContext,
  email: string,
  pin: string,
): StateUpdate<DemoOperationsState> {
  const normalizedEmail = email.trim().toLowerCase();
  const account = state.accounts.find(
    (candidate) => candidate.email.toLowerCase() === normalizedEmail && candidate.demoPin === pin,
  );

  if (!account) {
    throw new OperationsDomainError(
      "AUTHENTICATION_FAILED",
      "The demo email or PIN is incorrect.",
    );
  }

  const nextState: DemoOperationsState = {
    ...state,
    session: { accountId: account.id, effectiveRole: account.role },
    updatedAt: occurredAt,
  };
  return { state: nextState, result: nextState };
}

export function signOut({ state, occurredAt }: DemoWriteContext): StateUpdate<DemoOperationsState> {
  const nextState: DemoOperationsState = {
    ...state,
    session: { accountId: null, effectiveRole: null },
    updatedAt: occurredAt,
  };
  return { state: nextState, result: nextState };
}

export function switchDemoRole(
  { state, occurredAt }: DemoWriteContext,
  role: AppRole,
): StateUpdate<DemoOperationsState> {
  const context = getSessionContext(state);
  if (context.account.role !== "admin") {
    throw new OperationsDomainError(
      "UNAUTHORIZED",
      "Only the admin demo account can switch roles.",
    );
  }

  const nextState: DemoOperationsState = {
    ...state,
    session: { accountId: context.account.id, effectiveRole: role },
    updatedAt: occurredAt,
  };
  return { state: nextState, result: nextState };
}
