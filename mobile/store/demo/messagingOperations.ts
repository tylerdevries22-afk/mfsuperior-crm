import { OperationsDomainError } from "../../domain/errors";
import type {
  CreateCustomerRequestInput,
  CustomerRequest,
  DemoOperationsState,
  EntityId,
  OperationsMessage,
  SendMessageInput,
} from "../../domain/types";
import {
  getSessionContext,
  requireCustomerId,
  requireRole,
  type DemoWriteContext,
  type StateUpdate,
} from "./context";
import { findShipment } from "./lookups";
import { requireTrimmedText } from "./validation";

export function sendMessage(
  { state, occurredAt, nextId }: DemoWriteContext,
  input: SendMessageInput,
): StateUpdate<OperationsMessage> {
  const context = getSessionContext(state);
  requireTrimmedText(input.body, "Message", 1, 2_000);
  if (input.recipientAccountIds.length === 0) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "Select at least one message recipient.",
    );
  }
  const knownAccountIds = new Set(state.accounts.map((account) => account.id));
  if (input.recipientAccountIds.some((accountId) => !knownAccountIds.has(accountId))) {
    throw new OperationsDomainError("NOT_FOUND", "A message recipient could not be found.");
  }
  if (input.shipmentId) {
    findShipment(state, input.shipmentId);
  }

  const message: OperationsMessage = {
    id: nextId("message"),
    threadId: input.threadId,
    threadKind: input.threadKind,
    shipmentId: input.shipmentId,
    senderAccountId: context.account.id,
    recipientAccountIds: [...new Set(input.recipientAccountIds)],
    body: input.body.trim(),
    sentAt: occurredAt,
    readByAccountIds: [context.account.id],
  };
  const nextState: DemoOperationsState = {
    ...state,
    messages: [...state.messages, message],
    updatedAt: occurredAt,
  };
  return { state: nextState, result: message };
}

export function createCustomerRequest(
  { state, occurredAt, nextId }: DemoWriteContext,
  input: CreateCustomerRequestInput,
): StateUpdate<CustomerRequest> {
  const context = getSessionContext(state);
  requireRole(context, "customer", "A Customer role is required to submit a request.");
  requireTrimmedText(input.subject, "Request subject", 3, 160);
  requireTrimmedText(input.details, "Request details", 10, 2_000);
  if (input.shipmentId) {
    const shipment = findShipment(state, input.shipmentId);
    const customerId = requireCustomerId(context);
    if (shipment.customerId !== customerId) {
      throw new OperationsDomainError(
        "UNAUTHORIZED",
        "The selected shipment does not belong to this customer.",
      );
    }
  }

  const customerId = requireCustomerId(context);
  const request: CustomerRequest = {
    id: nextId("request"),
    customerId,
    shipmentId: input.shipmentId,
    type: input.type,
    status: "submitted",
    subject: input.subject.trim(),
    details: input.details.trim(),
    requestedAt: occurredAt,
    updatedAt: occurredAt,
  };
  const nextState: DemoOperationsState = {
    ...state,
    requests: [...state.requests, request],
    updatedAt: occurredAt,
  };
  return { state: nextState, result: request };
}

export function markMessageRead(
  { state, occurredAt }: DemoWriteContext,
  messageId: EntityId,
): StateUpdate<OperationsMessage> {
  const context = getSessionContext(state);
  const message = state.messages.find((candidate) => candidate.id === messageId);
  if (!message) {
    throw new OperationsDomainError("NOT_FOUND", "The message could not be found.");
  }
  const canRead = context.effectiveRole === "admin" ||
    message.senderAccountId === context.account.id ||
    message.recipientAccountIds.includes(context.account.id);
  if (!canRead) {
    throw new OperationsDomainError(
      "UNAUTHORIZED",
      "This demo account cannot read the selected message.",
    );
  }

  const updatedMessage: OperationsMessage = {
    ...message,
    readByAccountIds: [...new Set([...message.readByAccountIds, context.account.id])],
  };
  const nextState: DemoOperationsState = {
    ...state,
    messages: state.messages.map((candidate) => candidate.id === messageId ? updatedMessage : candidate),
    updatedAt: occurredAt,
  };
  return { state: nextState, result: updatedMessage };
}
