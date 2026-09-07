import type { Contact, EntityId, IsoDateTime, PostalAddress } from "./core";
import type { EquipmentType, ShipmentCharges } from "./shipments";

export interface Customer {
  readonly id: EntityId;
  readonly companyName: string;
  readonly contact: Contact;
  readonly billingAddress: PostalAddress;
}

export type CustomerRequestType = "quote" | "pickup" | "delivery" | "exception";
export type CustomerRequestStatus = "draft" | "submitted" | "reviewing" | "scheduled" | "closed";

export interface CustomerRequest {
  readonly id: EntityId;
  readonly customerId: EntityId;
  readonly shipmentId?: EntityId;
  readonly type: CustomerRequestType;
  readonly status: CustomerRequestStatus;
  readonly subject: string;
  readonly details: string;
  readonly requestedAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type FreightQuoteStatus = "draft" | "sent" | "accepted" | "expired";

export interface FreightQuote {
  readonly id: EntityId;
  readonly quoteNumber: string;
  readonly customerId: EntityId;
  readonly requestId?: EntityId;
  readonly status: FreightQuoteStatus;
  readonly origin: PostalAddress;
  readonly destination: PostalAddress;
  readonly equipmentType: EquipmentType;
  readonly commodity: string;
  readonly estimatedDistanceMiles: number;
  readonly charges: ShipmentCharges;
  readonly totalCents: number;
  readonly createdAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
}

/** Origin and destination the freight request API requires for intake. */
export interface FreightRequestLocationInput {
  readonly name?: string;
  readonly addressLine1: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
}

export interface CreateCustomerRequestInput {
  readonly type: CustomerRequestType;
  readonly subject: string;
  readonly details: string;
  readonly shipmentId?: EntityId;
  readonly origin?: FreightRequestLocationInput;
  readonly destination?: FreightRequestLocationInput;
}
