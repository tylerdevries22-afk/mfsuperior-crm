import type {
  DemoOperationsState,
  EdiTransaction,
  EdiTransactionType,
  Shipment,
} from "../../domain/types";

export function appendEdiTransaction(
  state: DemoOperationsState,
  transaction: EdiTransaction,
  occurredAt: string,
): DemoOperationsState {
  return {
    ...state,
    ediTransactions: [...state.ediTransactions, transaction],
    updatedAt: occurredAt,
  };
}

export function createEdiTransaction(
  id: string,
  shipment: Shipment,
  transactionType: EdiTransactionType,
  summary: string,
  occurredAt: string,
): EdiTransaction {
  return {
    id,
    shipmentId: shipment.id,
    transactionType,
    direction: "outbound",
    status: "generated",
    senderId: "MFS-DEMO",
    receiverId: "SHIPPER-DEMO",
    controlNumber: id.replace(/\D/g, "").slice(-12).padStart(12, "0"),
    summary,
    createdAt: occurredAt,
    isSimulated: true,
  };
}
