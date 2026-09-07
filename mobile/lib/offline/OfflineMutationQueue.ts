import { randomUUID } from "expo-crypto";

import { computeRetryDelayMs } from "../network/retry";
import {
  compareMutations,
  createMutation,
  isEligible,
  NOOP_FILE_RETENTION,
  releaseUnreferencedFiles,
  toOfflineFailure,
} from "./queue-mutations";
import { deserializeQueue, serializeQueue } from "./queue-serialization";
import { MemoryOfflineQueueStorage, type OfflineQueueStorage } from "./storage";
import type {
  OfflineFlushReport,
  OfflineMutation,
  OfflineMutationDraft,
  OfflineMutationProcessor,
  OfflineQueueHooks,
  PendingFileRetention,
} from "./types";

export interface OfflineMutationQueueOptions {
  readonly clock?: () => Date;
  readonly fileRetention?: PendingFileRetention;
  readonly idempotencyKeyFactory?: () => string;
  readonly random?: () => number;
  readonly storage?: OfflineQueueStorage;
}

export class OfflineMutationQueue {
  private hydrated = false;
  private items: OfflineMutation[] = [];
  private operation: Promise<void> = Promise.resolve();
  private readonly clock: () => Date;
  private readonly fileRetention: PendingFileRetention;
  private readonly idempotencyKeyFactory: () => string;
  private readonly random: () => number;
  private readonly storage: OfflineQueueStorage;

  constructor(options: OfflineMutationQueueOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.fileRetention = options.fileRetention ?? NOOP_FILE_RETENTION;
    this.idempotencyKeyFactory = options.idempotencyKeyFactory ?? randomUUID;
    this.random = options.random ?? Math.random;
    this.storage = options.storage ?? new MemoryOfflineQueueStorage();
  }

  async enqueue(draft: OfflineMutationDraft): Promise<OfflineMutation> {
    return this.runExclusive(async () => {
      await this.hydrateInternal();
      const mutation = createMutation(draft, this.idempotencyKeyFactory(), this.clock());
      await Promise.all(mutation.pendingFileUris.map((uri) => (
        this.fileRetention.retain(uri, mutation.idempotencyKey)
      )));
      this.items.push(mutation);
      await this.persist();
      return mutation;
    });
  }

  async list(): Promise<readonly OfflineMutation[]> {
    return this.runExclusive(async () => {
      await this.hydrateInternal();
      return [...this.items].sort(compareMutations);
    });
  }

  async flush(
    processor: OfflineMutationProcessor,
    hooks: OfflineQueueHooks = {},
  ): Promise<OfflineFlushReport> {
    return this.runExclusive(async () => {
      await this.hydrateInternal();
      const blockedShipments = new Set<string>();
      let failed = 0;
      let processed = 0;
      for (const mutation of [...this.items].sort(compareMutations)) {
        if (!isEligible(mutation, this.clock()) || blockedShipments.has(mutation.shipmentId)) {
          blockedShipments.add(mutation.shipmentId);
          continue;
        }
        try {
          await processor(mutation);
          await this.completeMutation(mutation, hooks);
          processed += 1;
        } catch (error: unknown) {
          failed += 1;
          blockedShipments.add(mutation.shipmentId);
          await this.failMutation(mutation, error, hooks);
        }
      }
      return { failed, pending: this.items.length, processed };
    });
  }

  async retryNow(idempotencyKey: string): Promise<void> {
    await this.runExclusive(async () => {
      await this.hydrateInternal();
      this.items = this.items.map((item) => item.idempotencyKey === idempotencyKey
        ? { ...item, lastFailure: null, nextAttemptAt: null }
        : item);
      await this.persist();
    });
  }

  async purgeForLogout(userId: string | null): Promise<void> {
    await this.runExclusive(async () => {
      await this.hydrateInternal();
      const removed = userId
        ? this.items.filter((item) => item.ownerUserId === userId)
        : [...this.items];
      const removedKeys = new Set(removed.map((item) => item.idempotencyKey));
      this.items = this.items.filter((item) => !removedKeys.has(item.idempotencyKey));
      await this.persist();
      await releaseUnreferencedFiles(removed, this.items, this.fileRetention, "logout");
    });
  }

  private async completeMutation(mutation: OfflineMutation, hooks: OfflineQueueHooks): Promise<void> {
    this.items = this.items.filter((item) => item.idempotencyKey !== mutation.idempotencyKey);
    await this.persist();
    await releaseUnreferencedFiles([mutation], this.items, this.fileRetention, "synced");
    hooks.onMutationSucceeded?.(mutation);
  }

  private async failMutation(
    mutation: OfflineMutation,
    error: unknown,
    hooks: OfflineQueueHooks,
  ): Promise<void> {
    const failure = toOfflineFailure(error);
    const attempts = mutation.attempts + 1;
    const nextAttemptAt = failure.retryable
      ? new Date(this.clock().getTime() + computeRetryDelayMs(attempts, this.random())).toISOString()
      : null;
    const failedMutation = { ...mutation, attempts, lastFailure: failure, nextAttemptAt };
    this.items = this.items.map((item) => item.idempotencyKey === mutation.idempotencyKey
      ? failedMutation
      : item);
    await this.persist();
    hooks.onMutationFailed?.(failedMutation, failure);
    if (failure.retryable) {
      hooks.onRetryScheduled?.({
        idempotencyKey: mutation.idempotencyKey,
        nextAttemptAt,
        shipmentId: mutation.shipmentId,
      });
    }
  }

  private async hydrateInternal(): Promise<void> {
    if (this.hydrated) {
      return;
    }
    const serialized = await this.storage.read();
    this.items = serialized ? deserializeQueue(serialized) : [];
    this.hydrated = true;
  }

  private async persist(): Promise<void> {
    if (this.items.length === 0) {
      await this.storage.clear();
      return;
    }
    await this.storage.write(serializeQueue(this.items));
  }

  private runExclusive<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.operation.then(operation, operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }
}
