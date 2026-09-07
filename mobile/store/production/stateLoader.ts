import type { DemoOperationsState } from "../../domain/types";
import type { AuthIdentity } from "../../lib/auth";
import type { ApiClient } from "../../lib/network";
import {
  buildPendingCustomerOperationsState,
  buildProductionOperationsState,
  type MobileBootstrapPayload,
  type MobileExceptionRow,
  type MobileFreightRequestRow,
  type MobileMessageRow,
  type MobileShipmentRow,
} from "../productionStateAdapter";
import { toDomainNetworkError } from "./errors";
import type { ExtendedCollectionLoader } from "./extendedCollectionLoader";
import { requireProductionState } from "./stateFactories";
import type { ExtendedRefresh } from "./types";

export interface ProductionStateSource {
  readonly apiClient: ApiClient;
  readonly clock: () => string;
  readonly collections: ExtendedCollectionLoader;
}

/** Reads the whole signed-in picture: bootstrap plus the per-role collections. */
export async function loadProductionState(
  source: ProductionStateSource,
  identity: AuthIdentity | null,
  refresh: ExtendedRefresh,
): Promise<DemoOperationsState> {
  try {
    const bootstrap = await source.apiClient.requestJson<MobileBootstrapPayload>("v1/bootstrap");
    const isAdmin = bootstrap.user.role === "admin";
    const isStaff = isAdmin || bootstrap.user.role === "driver";
    const [shipments, requests, exceptions, messages] = await Promise.all([
      source.apiClient.requestJson<readonly MobileShipmentRow[]>("v1/shipments?limit=100"),
      bootstrap.user.role === "driver"
        ? Promise.resolve([])
        : source.apiClient.requestJson<readonly MobileFreightRequestRow[]>("v1/requests?limit=100"),
      source.apiClient.requestJson<readonly MobileExceptionRow[]>("v1/exceptions?limit=100"),
      source.apiClient.requestJson<readonly MobileMessageRow[]>("v1/messages?limit=100"),
    ]);

    const extended = await source.collections.load(isAdmin, isStaff, refresh);

    const state = buildProductionOperationsState(
      { ...extended, bootstrap, exceptions, messages, requests, shipments },
      source.clock(),
    );
    return requireProductionState(state, identity);
  } catch (error: unknown) {
    throw toDomainNetworkError(error);
  }
}

/**
 * Pending customers are refused by bootstrap/shipments on purpose. Only the
 * freight requests they own are readable until an admin links their account.
 */
export async function loadPendingCustomerState(
  source: Pick<ProductionStateSource, "apiClient" | "clock">,
  identity: AuthIdentity,
): Promise<DemoOperationsState> {
  try {
    const requests = await source.apiClient.requestJson<readonly MobileFreightRequestRow[]>(
      "v1/requests?limit=100",
    );
    return requireProductionState(
      buildPendingCustomerOperationsState(identity, requests, source.clock()),
      identity,
    );
  } catch (error: unknown) {
    throw toDomainNetworkError(error);
  }
}
