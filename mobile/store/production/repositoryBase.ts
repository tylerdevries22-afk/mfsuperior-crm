import { randomUUID } from "expo-crypto";

import { OperationsDomainError } from "../../domain/errors";
import type { HydrationResult, OperationsStateListener } from "../../domain/repository";
import type { AppRole, DemoOperationsState } from "../../domain/types";
import type { AuthIdentity } from "../../lib/auth";
import type { ApiClient } from "../../lib/network";
import {
  toMutationOperation,
  type OfflineMutation,
  type OfflineMutationDraft,
  type OfflineMutationQueue,
  type OfflineQueueHooks,
} from "../../lib/offline";
import { ProductionDocumentUploader } from "./documentUploader";
import { productionOnlyError, toDomainNetworkError } from "./errors";
import { ExtendedCollectionLoader } from "./extendedCollectionLoader";
import { createEmptyOperationsState } from "./stateFactories";
import { loadPendingCustomerState, loadProductionState } from "./stateLoader";
import type {
  ExtendedRefresh,
  ProductionAuthGateway,
  ProductionOperationsRepositoryOptions,
} from "./types";

/**
 * Session state and the two paths every production write takes to the server:
 * `performMutation` for online writes and `enqueueAndSync` for the ones that
 * must survive a dead zone.
 *
 * This is the first link of the chain `ProductionOperationsRepository` is
 * assembled from; each later link adds one domain area on top.
 */
export class ProductionRepositoryBase {
  readonly mode = "production" as const;
  protected readonly apiClient: ApiClient;
  protected readonly clock: () => string;
  protected readonly idFactory: () => string;
  protected readonly offlineQueue: OfflineMutationQueue;
  protected readonly uploader: ProductionDocumentUploader;
  protected state: DemoOperationsState;
  private readonly auth: ProductionAuthGateway;
  private readonly collections: ExtendedCollectionLoader;
  private readonly listeners = new Set<OperationsStateListener>();
  private readonly queueHooks: OfflineQueueHooks;
  private identity: AuthIdentity | null = null;

  constructor(options: ProductionOperationsRepositoryOptions) {
    this.apiClient = options.apiClient;
    this.auth = options.auth;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? randomUUID;
    this.offlineQueue = options.offlineQueue;
    this.queueHooks = options.queueHooks ?? {};
    this.collections = new ExtendedCollectionLoader(options.apiClient);
    this.uploader = new ProductionDocumentUploader({
      apiClient: options.apiClient,
      fetchImplementation: options.fetchImplementation ?? fetch,
      uploadBaseUrl: options.uploadBaseUrl,
    });
    this.state = createEmptyOperationsState(this.clock());
  }

  async hydrate(): Promise<HydrationResult> {
    this.identity = await this.auth.getCurrentIdentity();
    if (!this.identity) {
      this.replaceState(createEmptyOperationsState(this.clock()));
      return { recoveryFailure: null, state: this.state };
    }
    await this.refreshState("all");
    await this.syncOfflineMutations();
    return { recoveryFailure: null, state: this.state };
  }

  getState(): DemoOperationsState {
    return this.state;
  }

  subscribe(listener: OperationsStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async signIn(email: string, password: string): Promise<DemoOperationsState> {
    this.identity = await this.auth.signIn(email, password);
    await this.refreshState();
    await this.syncOfflineMutations();
    return this.state;
  }

  async signOut(): Promise<DemoOperationsState> {
    const userId = this.identity?.userId ?? null;
    try {
      await this.auth.signOut();
    } finally {
      await this.offlineQueue.purgeForLogout(userId);
      this.identity = null;
      this.replaceState(createEmptyOperationsState(this.clock()));
    }
    return this.state;
  }

  async switchDemoRole(_role: AppRole): Promise<DemoOperationsState> {
    throw productionOnlyError("Role previews are only available in the explicit demo.");
  }

  async resetDemo(): Promise<DemoOperationsState> {
    throw productionOnlyError("Demo reset is only available in the explicit demo.");
  }

  async syncOfflineMutations(): Promise<void> {
    const report = await this.offlineQueue.flush(
      (mutation) => this.sendOfflineMutation(mutation),
      this.queueHooks,
    );
    if (report.processed > 0) {
      await this.refreshState();
    }
  }

  /**
   * The read every write ends with. Both the load and the listener fan-out sit
   * inside the translation, so a subscriber that throws surfaces as a domain
   * failure rather than a raw error escaping the repository.
   */
  protected async refreshState(refresh: ExtendedRefresh = "cached"): Promise<void> {
    const identity = this.identity;
    const source = { apiClient: this.apiClient, clock: this.clock, collections: this.collections };
    try {
      if (identity?.accessState === "pending_customer_approval") {
        this.replaceState(await loadPendingCustomerState(source, identity));
        return;
      }
      this.replaceState(await loadProductionState(source, identity, refresh));
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
  }

  /** Online writes return only their own result; state is re-read afterwards. */
  protected async performMutation<Result>(
    path: string,
    body: unknown,
    refresh: ExtendedRefresh = "cached",
  ): Promise<Result> {
    this.requireIdentity();
    let result: Result;
    try {
      result = await this.apiClient.requestJson<Result>(path, {
        body,
        idempotencyKey: this.idFactory(),
        method: "POST",
      });
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
    await this.refreshState(refresh);
    return result;
  }

  protected async enqueueAndSync(draft: OfflineMutationDraft): Promise<OfflineMutation> {
    const mutation = await this.offlineQueue.enqueue(draft);
    await this.syncOfflineMutations();
    return mutation;
  }

  protected requireIdentity(): AuthIdentity {
    if (!this.identity) {
      throw new OperationsDomainError("UNAUTHORIZED", "Sign in to use freight operations.");
    }
    return this.identity;
  }

  protected replaceState(state: DemoOperationsState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
  }

  private async sendOfflineMutation(mutation: OfflineMutation): Promise<void> {
    const documentId = await this.uploader.uploadPendingDocument(mutation);
    const operation = toMutationOperation(mutation, documentId);
    if (!operation) {
      return;
    }
    await this.apiClient.requestJson<unknown>("v1/mutations", {
      body: { mutations: [operation] },
      idempotencyKey: mutation.idempotencyKey,
      method: "POST",
    });
  }
}
