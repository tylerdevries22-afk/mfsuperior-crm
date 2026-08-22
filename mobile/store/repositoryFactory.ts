import { OperationsDomainError } from "../domain/errors";
import type { OperationsRepository } from "../domain/repository";
import type { DemoOperationsState } from "../domain/types";
import { DEMO_STATE_VERSION } from "../domain/types";
import {
  ApiMembershipSyncGateway,
  createSecureSessionStorage,
  createSupabaseAuthClient,
  resolveAuthRuntimeConfig,
  SupabaseAuthService,
  type AuthSessionStorage,
  type PublicEnvironment,
} from "../lib/auth";
import { ApiClient } from "../lib/network";
import {
  AsyncOfflineQueueStorage,
  OfflineMutationQueue,
  type OfflineQueueStorage,
} from "../lib/offline";
import { DemoOperationsRepository } from "./DemoOperationsRepository";
import { ProductionOperationsRepository } from "./ProductionOperationsRepository";

export interface RepositoryFactoryOptions {
  readonly authStorage?: AuthSessionStorage;
  readonly environment?: PublicEnvironment;
  readonly fetchImplementation?: typeof fetch;
  readonly offlineStorage?: OfflineQueueStorage;
}

export function createOperationsRepositoryFromEnvironment(
  options: RepositoryFactoryOptions = {},
): OperationsRepository {
  const runtime = resolveAuthRuntimeConfig(options.environment);
  if (runtime.mode === "demo") {
    return new DemoOperationsRepository();
  }
  if (runtime.mode === "unconfigured") {
    return createUnconfiguredRepository(runtime.missing);
  }

  const queue = new OfflineMutationQueue({
    storage: options.offlineStorage ?? new AsyncOfflineQueueStorage(),
  });
  const client = createSupabaseAuthClient(runtime.config, {
    fetchImplementation: options.fetchImplementation,
    storage: options.authStorage ?? createSecureSessionStorage(),
  });
  const getAccessToken = (): Promise<string | null> => auth.getAccessToken();
  const membershipSync = new ApiMembershipSyncGateway({
    apiClient: new ApiClient({
      baseUrl: runtime.config.authApiBaseUrl,
      fetchImplementation: options.fetchImplementation,
      getAccessToken,
    }),
  });
  const auth = new SupabaseAuthService(client, queue, membershipSync);
  const apiClient = new ApiClient({
    baseUrl: runtime.config.apiBaseUrl,
    fetchImplementation: options.fetchImplementation,
    getAccessToken,
  });
  return new ProductionOperationsRepository({
    apiClient,
    auth,
    fetchImplementation: options.fetchImplementation,
    offlineQueue: queue,
    uploadBaseUrl: runtime.config.supabaseUrl,
  });
}

function createUnconfiguredRepository(missing: readonly string[]): OperationsRepository {
  const state = emptyState();
  const fail = () => Promise.reject(configurationError(missing));
  return {
    mode: "unconfigured",
    advanceIntermediateStop: fail,
    assignShipment: fail,
    createCustomerRequest: fail,
    getShipmentEdiTransactions: () => [],
    getState: () => state,
    hydrate: fail,
    markMessageRead: fail,
    reportException: fail,
    resetDemo: fail,
    resolveException: fail,
    respondToTender: fail,
    sendMessage: fail,
    signIn: fail,
    signOut: fail,
    recordDriverLocation: fail,
    submitProofOfDelivery: fail,
    subscribe: () => () => undefined,
    switchDemoRole: fail,
    transitionDutyStatus: fail,
    transitionShipment: fail,
  };
}

function configurationError(missing: readonly string[]): OperationsDomainError {
  return new OperationsDomainError(
    "CONFIGURATION_ERROR",
    "Production authentication is not configured and demo access is disabled.",
    { missing: missing.join(", ") },
  );
}

function emptyState(): DemoOperationsState {
  return {
    accounts: [],
    customers: [],
    drivers: [],
    ediTransactions: [],
    equipment: [],
    exceptions: [],
    hosClocks: [],
    integrations: [],
    messages: [],
    proofsOfDelivery: [],
    quotes: [],
    requests: [],
    session: { accountId: null, effectiveRole: null },
    shipments: [],
    updatedAt: new Date(0).toISOString(),
    version: DEMO_STATE_VERSION,
  };
}
