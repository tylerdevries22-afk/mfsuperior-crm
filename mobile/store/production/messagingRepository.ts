import { OperationsDomainError } from "../../domain/errors";
import type {
  CreateCustomerRequestInput,
  CustomerRequest,
  EntityId,
  OperationsMessage,
  SendMessageInput,
} from "../../domain/types";
import type { MobileMessageRow } from "../productionStateAdapter";
import { encodeId } from "./errors";
import { ProductionExceptionRepository } from "./exceptionRepository";
import { toFreightLocation } from "./optimisticRecords";

/** Operations messaging and the freight requests customers raise from the app. */
export class ProductionMessagingRepository extends ProductionExceptionRepository {
  async sendMessage(input: SendMessageInput): Promise<OperationsMessage> {
    const sent = await this.performMutation<MobileMessageRow>("v1/messages", {
      body: input.body,
      recipientUserIds: [...input.recipientAccountIds],
      shipmentId: input.shipmentId ?? null,
      threadKey: input.threadId,
      threadKind: input.threadKind,
    });
    return this.requireMessage(sent.id);
  }

  async createCustomerRequest(input: CreateCustomerRequestInput): Promise<CustomerRequest> {
    if (!input.origin || !input.destination) {
      throw new OperationsDomainError(
        "VALIDATION_FAILED",
        "A freight request needs both a pickup and a delivery address.",
      );
    }
    const created = await this.performMutation<{ readonly id: string }>("v1/requests", {
      commodity: null,
      destination: toFreightLocation(input.destination),
      notes: input.details,
      origin: toFreightLocation(input.origin),
      requestType: input.type,
      shipmentId: input.shipmentId ?? null,
      subject: input.subject,
    });
    return this.requireRequest(created.id);
  }

  async markMessageRead(messageId: EntityId): Promise<OperationsMessage> {
    await this.performMutation<{ readonly id: string }>(
      `v1/messages/${encodeId(messageId)}/read`,
      {},
    );
    return this.requireMessage(messageId);
  }

  private requireRequest(requestId: string): CustomerRequest {
    const request = this.state.requests.find((candidate) => candidate.id === requestId);
    if (!request) {
      throw new OperationsDomainError("NOT_FOUND", "The freight request could not be found.");
    }
    return request;
  }

  private requireMessage(messageId: string): OperationsMessage {
    const message = this.state.messages.find((candidate) => candidate.id === messageId);
    if (!message) {
      throw new OperationsDomainError("NOT_FOUND", "The message could not be found.");
    }
    return message;
  }
}
