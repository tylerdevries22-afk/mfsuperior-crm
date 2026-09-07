import type { CustomerRequest, ExceptionReport, OperationsMessage } from "../../domain/types";
import { exceptionCategory, exceptionSeverity, validDate } from "./fieldCoercion";
import type {
  MobileExceptionRow,
  MobileFreightRequestRow,
  MobileMessageRow,
} from "./rowTypes";

export function toExceptionReport(row: MobileExceptionRow): ExceptionReport {
  return {
    attachmentUris: Array.isArray(row.photoUrls)
      ? row.photoUrls.filter((value): value is string => typeof value === "string")
      : [],
    category: exceptionCategory(row.category),
    description: row.description ?? "Exception reported.",
    id: row.id,
    reportedAt: validDate(row.reportedAt),
    reportedByAccountId: row.reportedByDriverId ?? "",
    resolutionNote: row.resolutionNote ?? undefined,
    resolvedAt: row.resolvedAt ? validDate(row.resolvedAt) : undefined,
    severity: exceptionSeverity(row.severity),
    shipmentId: row.shipmentId,
    status: row.status === "resolved" ? "resolved" : "open",
  };
}

export function toOperationsMessage(row: MobileMessageRow): OperationsMessage {
  return {
    body: row.body,
    id: row.id,
    readByAccountIds: [...row.readByUserIds],
    recipientAccountIds: [...row.recipientUserIds],
    senderAccountId: row.senderUserId,
    sentAt: validDate(row.sentAt),
    shipmentId: row.shipmentId ?? undefined,
    threadId: row.threadKey,
    threadKind: row.threadKind,
  };
}

export function toCustomerRequest(row: MobileFreightRequestRow, fallbackCustomerId: string): CustomerRequest {
  const closed = row.status === "declined" || row.status === "cancelled";
  return {
    customerId: row.customerAccountId ?? fallbackCustomerId,
    details: row.notes ?? "Freight request submitted through the customer workspace.",
    id: row.id,
    requestedAt: validDate(row.createdAt),
    shipmentId: row.shipmentId ?? undefined,
    status: closed ? "closed" : row.status === "booked" ? "scheduled" : row.status === "reviewing" || row.status === "quoted" ? "reviewing" : "submitted",
    subject: row.referenceNumber ?? row.commodity ?? "Freight request",
    type: row.shipmentId ? "delivery" : "quote",
    updatedAt: validDate(row.updatedAt),
  };
}
