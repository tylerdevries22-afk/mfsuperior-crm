import type { EntityId, IsoDateTime } from "./core";

export type EdiTransactionType = "204" | "990" | "214" | "210" | "997";
export type EdiDirection = "inbound" | "outbound";
export type EdiTransactionStatus = "received" | "generated" | "acknowledged" | "failed";

export interface EdiTransaction {
  readonly id: EntityId;
  readonly shipmentId?: EntityId;
  readonly transactionType: EdiTransactionType;
  readonly direction: EdiDirection;
  readonly status: EdiTransactionStatus;
  readonly senderId: string;
  readonly receiverId: string;
  readonly controlNumber: string;
  readonly summary: string;
  readonly createdAt: IsoDateTime;
  readonly acknowledgedAt?: IsoDateTime;
  readonly isSimulated: boolean;
}

/** Health of the outbound integration boundaries EDI traffic rides on. */
export type IntegrationHealthStatus =
  | "not_configured"
  | "connected"
  | "degraded";

export interface IntegrationHealth {
  readonly id: EntityId;
  readonly name: string;
  readonly status: IntegrationHealthStatus;
  readonly summary: string;
  readonly lastCheckedAt: IsoDateTime;
  readonly isSimulation: boolean;
}
