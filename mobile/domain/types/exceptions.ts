import type { EntityId, IsoDateTime } from "./core";

export const EXCEPTION_CATEGORIES = [
  "delay",
  "equipment",
  "temperature",
  "cargo_damage",
  "refused_delivery",
  "route",
  "other",
] as const;

export type ExceptionCategory = (typeof EXCEPTION_CATEGORIES)[number];

export const EXCEPTION_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type ExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number];
export type ExceptionStatus = "open" | "acknowledged" | "resolved";

export interface ExceptionReport {
  readonly id: EntityId;
  readonly shipmentId: EntityId;
  readonly stopId?: EntityId;
  readonly category: ExceptionCategory;
  readonly severity: ExceptionSeverity;
  readonly status: ExceptionStatus;
  readonly description: string;
  readonly resolutionNote?: string;
  readonly reportedByAccountId: EntityId;
  readonly reportedAt: IsoDateTime;
  readonly resolvedAt?: IsoDateTime;
  readonly attachmentUris: readonly string[];
}

export interface ExceptionReportInput {
  readonly stopId?: EntityId;
  readonly category: ExceptionCategory;
  readonly severity: ExceptionSeverity;
  readonly description: string;
  readonly attachmentUris?: readonly string[];
}

export type ProofOfDeliveryStatus = "draft" | "submitted" | "accepted" | "rejected";

export interface DeliveryAttachment {
  readonly id: EntityId;
  readonly kind: "photo" | "document";
  readonly uri: string;
  readonly name: string;
}

export interface ProofOfDelivery {
  readonly id: EntityId;
  readonly shipmentId: EntityId;
  readonly stopId: EntityId;
  readonly status: ProofOfDeliveryStatus;
  readonly recipientName: string;
  readonly signatureData: string;
  readonly notes: string;
  readonly attachments: readonly DeliveryAttachment[];
  readonly submittedByAccountId: EntityId;
  readonly submittedAt: IsoDateTime;
}

export interface ProofOfDeliveryInput {
  readonly stopId: EntityId;
  readonly recipientName: string;
  readonly signatureData: string;
  readonly notes?: string;
  readonly attachments?: readonly Omit<DeliveryAttachment, "id">[];
}
