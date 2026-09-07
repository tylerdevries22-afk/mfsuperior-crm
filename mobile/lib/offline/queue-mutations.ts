import { NetworkRequestError } from "../network/errors";
import {
  OFFLINE_MUTATION_KINDS,
  type OfflineMutation,
  type OfflineMutationDraft,
  type OfflineMutationFailure,
  type PendingFileRetention,
} from "./types";

export function createMutation(
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

export function compareMutations(left: OfflineMutation, right: OfflineMutation): number {
  const timestampDifference = Date.parse(left.deviceCreatedAt) - Date.parse(right.deviceCreatedAt);
  return timestampDifference || left.idempotencyKey.localeCompare(right.idempotencyKey);
}

export function isEligible(mutation: OfflineMutation, now: Date): boolean {
  return mutation.nextAttemptAt === null || Date.parse(mutation.nextAttemptAt) <= now.getTime();
}

export function toOfflineFailure(error: unknown): OfflineMutationFailure {
  if (error instanceof NetworkRequestError) {
    return {
      code: error.failure.code,
      message: error.failure.message,
      retryable: error.failure.retryable,
    };
  }
  return { code: "SYNC_FAILED", message: "The offline change could not be synced.", retryable: true };
}

export async function releaseUnreferencedFiles(
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

export const NOOP_FILE_RETENTION: PendingFileRetention = {
  release: async () => undefined,
  retain: async () => undefined,
};
