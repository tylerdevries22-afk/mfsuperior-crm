import type {
  ExceptionReportInput,
  GeoPoint,
  HosDutyStatus,
  ProofOfDeliveryInput,
} from "../../domain/types";

export const OFFLINE_MUTATION_KINDS = [
  "driver_status",
  "exception",
  "location",
  "photo",
  "signature",
  "pod",
] as const;

export type OfflineMutationKind = (typeof OFFLINE_MUTATION_KINDS)[number];

export type OfflineMutationPayload =
  | { readonly status: HosDutyStatus }
  | { readonly input: ExceptionReportInput }
  | { readonly coordinates: GeoPoint }
  | { readonly fileName: string; readonly fileUri: string; readonly mimeType: string }
  | { readonly signatureData: string }
  | { readonly input: ProofOfDeliveryInput };

export interface OfflineMutationDraft {
  readonly entityId: string;
  readonly entityVersion: number;
  readonly kind: OfflineMutationKind;
  readonly ownerUserId: string;
  readonly payload: OfflineMutationPayload;
  readonly pendingFileUris?: readonly string[];
  readonly shipmentId: string;
}

export interface OfflineMutation extends OfflineMutationDraft {
  readonly attempts: number;
  readonly deviceCreatedAt: string;
  readonly idempotencyKey: string;
  readonly lastFailure: OfflineMutationFailure | null;
  readonly nextAttemptAt: string | null;
  readonly pendingFileUris: readonly string[];
}

export interface OfflineMutationFailure {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface OfflineFlushReport {
  readonly failed: number;
  readonly pending: number;
  readonly processed: number;
}

export interface OfflineRetryEvent {
  readonly idempotencyKey: string;
  readonly nextAttemptAt: string | null;
  readonly shipmentId: string;
}

export interface OfflineQueueHooks {
  onMutationFailed?(mutation: OfflineMutation, failure: OfflineMutationFailure): void;
  onMutationSucceeded?(mutation: OfflineMutation): void;
  onRetryScheduled?(event: OfflineRetryEvent): void;
}

export interface PendingFileRetention {
  release(uri: string, reason: "logout" | "synced"): Promise<void>;
  retain(uri: string, idempotencyKey: string): Promise<void>;
}

export type OfflineMutationProcessor = (mutation: OfflineMutation) => Promise<void>;
