import { randomUUID } from "expo-crypto";

import { NetworkRequestError } from "../network/errors";
import { computeRetryDelayMs } from "../network/retry";
import { MemoryOfflineQueueStorage, type OfflineQueueStorage } from "./storage";
import {
  OFFLINE_MUTATION_KINDS,
  type OfflineFlushReport,
  type OfflineMutation,
  type OfflineMutationDraft,
  type OfflineMutationFailure,
  type OfflineMutationProcessor,
  type OfflineQueueHooks,
  type PendingFileRetention,
} from "./types";

interface QueueEnvelope {
  readonly items: readonly OfflineMutation[];
  readonly version: 1;
}

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
    await this.storage.write(JSON.stringify({ items: this.items, version: 1 } satisfies QueueEnvelope));
  }

  private runExclusive<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.operation.then(operation, operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }
}

export function deserializeOfflineQueue(serialized: string): readonly OfflineMutation[] {
  return deserializeQueue(serialized);
}

function createMutation(
  draft: OfflineMutationDraft,
  idempotencyKey: string,
  now: Date,
): OfflineMutation {
  validateDraft(draft);
  return {
    ...draft,
    attempts: 0,
    deviceCreatedAt: now.toISOString(),
    idempotencyKey,
    lastFailure: null,
    nextAttemptAt: null,
    pendingFileUris: [...new Set(draft.pendingFileUris ?? [])],
  };
}

function validateDraft(draft: OfflineMutationDraft): void {
  if (!draft.ownerUserId.trim() || !draft.shipmentId.trim() || !draft.entityId.trim()) {
    throw new Error("Offline mutations require an owner, shipment, and entity.");
  }
  if (!Number.isInteger(draft.entityVersion) || draft.entityVersion < 0) {
    throw new Error("Offline mutations require a non-negative entity version.");
  }
  if (!OFFLINE_MUTATION_KINDS.includes(draft.kind)) {
    throw new Error("Unsupported offline mutation kind.");
  }
}

function deserializeQueue(serialized: string): OfflineMutation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error("Saved offline operations are invalid.");
  }
  if (!isQueueEnvelope(parsed)) {
    throw new Error("Saved offline operations are invalid.");
  }
  return [...parsed.items];
}

function isQueueEnvelope(value: unknown): value is QueueEnvelope {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.items)) {
    return false;
  }
  return value.items.every(isMutation);
}

function isMutation(value: unknown): value is OfflineMutation {
  return isRecord(value) &&
    typeof value.idempotencyKey === "string" &&
    typeof value.ownerUserId === "string" &&
    typeof value.shipmentId === "string" &&
    typeof value.entityId === "string" &&
    typeof value.entityVersion === "number" &&
    typeof value.deviceCreatedAt === "string" &&
    typeof value.kind === "string" &&
    OFFLINE_MUTATION_KINDS.some((kind) => kind === value.kind) &&
    typeof value.attempts === "number" &&
    Array.isArray(value.pendingFileUris) &&
    value.pendingFileUris.every((uri) => typeof uri === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareMutations(left: OfflineMutation, right: OfflineMutation): number {
  const timestampDifference = Date.parse(left.deviceCreatedAt) - Date.parse(right.deviceCreatedAt);
  return timestampDifference || left.idempotencyKey.localeCompare(right.idempotencyKey);
}

function isEligible(mutation: OfflineMutation, now: Date): boolean {
  return mutation.nextAttemptAt === null || Date.parse(mutation.nextAttemptAt) <= now.getTime();
}

function toOfflineFailure(error: unknown): OfflineMutationFailure {
  if (error instanceof NetworkRequestError) {
    return {
      code: error.failure.code,
      message: error.failure.message,
      retryable: error.failure.retryable,
    };
  }
  return { code: "SYNC_FAILED", message: "The offline change could not be synced.", retryable: true };
}

async function releaseUnreferencedFiles(
  removed: readonly OfflineMutation[],
  remaining: readonly OfflineMutation[],
  retention: PendingFileRetention,
  reason: "logout" | "synced",
): Promise<void> {
  const stillPending = new Set(remaining.flatMap((mutation) => mutation.pendingFileUris));
  const releasable = [...new Set(removed.flatMap((mutation) => mutation.pendingFileUris))]
    .filter((uri) => !stillPending.has(uri));
  await Promise.all(releasable.map((uri) => retention.release(uri, reason)));
}

const NOOP_FILE_RETENTION: PendingFileRetention = {
  release: async () => undefined,
  retain: async () => undefined,
};
