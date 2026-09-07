import type { EntityId, IsoDateTime } from "./core";

export type MessageThreadKind = "shipment" | "dispatch" | "support";

export interface OperationsMessage {
  readonly id: EntityId;
  readonly threadId: EntityId;
  readonly threadKind: MessageThreadKind;
  readonly shipmentId?: EntityId;
  readonly senderAccountId: EntityId;
  readonly recipientAccountIds: readonly EntityId[];
  readonly body: string;
  readonly sentAt: IsoDateTime;
  readonly readByAccountIds: readonly EntityId[];
}

export interface SendMessageInput {
  readonly threadId: EntityId;
  readonly threadKind: MessageThreadKind;
  readonly shipmentId?: EntityId;
  readonly recipientAccountIds: readonly EntityId[];
  readonly body: string;
}
