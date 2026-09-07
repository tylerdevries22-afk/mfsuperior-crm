import type { DemoOperationsState, EntityId, PayoutMethod, PayoutMethodInput } from "../../domain/types";
import type { PayoutMethodStore } from "../payoutMethodStore";
import { getSessionContext, requireDriverId, requireRole } from "./context";

/**
 * Payout handles. Driver-only and scoped to the signed-in driver — an admin
 * has no read path to a raw handle through this repository at all.
 */
export function listPayoutMethods(
  state: DemoOperationsState,
  store: PayoutMethodStore,
): Promise<readonly PayoutMethod[]> {
  const context = getSessionContext(state);
  requireRole(context, "driver", "A Driver role is required to view payout methods.");
  return store.list(requireDriverId(context));
}

export function savePayoutMethod(
  state: DemoOperationsState,
  store: PayoutMethodStore,
  input: PayoutMethodInput,
): Promise<PayoutMethod> {
  const context = getSessionContext(state);
  requireRole(context, "driver", "A Driver role is required to save a payout method.");
  return store.save(requireDriverId(context), input);
}

export function removePayoutMethod(
  state: DemoOperationsState,
  store: PayoutMethodStore,
  methodId: EntityId,
): Promise<readonly PayoutMethod[]> {
  const context = getSessionContext(state);
  requireRole(context, "driver", "A Driver role is required to remove a payout method.");
  return store.remove(requireDriverId(context), methodId);
}

export function setDefaultPayoutMethod(
  state: DemoOperationsState,
  store: PayoutMethodStore,
  methodId: EntityId,
): Promise<readonly PayoutMethod[]> {
  const context = getSessionContext(state);
  requireRole(context, "driver", "A Driver role is required to change the default payout.");
  return store.setDefault(requireDriverId(context), methodId);
}
