import { OFFLINE_MUTATION_KINDS, type OfflineMutation } from "./types";

interface QueueEnvelope {
  readonly items: readonly OfflineMutation[];
  readonly version: 1;
}

export function serializeQueue(items: readonly OfflineMutation[]): string {
  return JSON.stringify({ items, version: 1 } satisfies QueueEnvelope);
}

export function deserializeOfflineQueue(serialized: string): readonly OfflineMutation[] {
  return deserializeQueue(serialized);
}

export function deserializeQueue(serialized: string): OfflineMutation[] {
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
