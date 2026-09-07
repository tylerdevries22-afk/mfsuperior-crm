/**
 * Core identity and shared primitives.
 *
 * Everything here is referenced by more than one entity domain, so it stays
 * free of imports from the sibling modules to keep the graph acyclic.
 */

export const APP_ROLES = ["admin", "driver", "customer"] as const;

export type AppRole = (typeof APP_ROLES)[number];

/**
 * Server-derived workspace access. `pending_customer_approval` mirrors a
 * `customer/pending` membership: freight requests only, never shipment data.
 */
export const ACCESS_STATES = ["active", "pending_customer_approval"] as const;

export type AccessState = (typeof ACCESS_STATES)[number];

export type EntityId = string;
export type IsoDateTime = string;

export interface OperationsAccount {
  readonly id: EntityId;
  readonly role: AppRole;
  readonly displayName: string;
  readonly email: string;
  readonly companyName: string;
  readonly title: string;
  readonly customerId?: EntityId;
  readonly driverId?: EntityId;
  readonly demoPin?: string;
}

export interface DemoAccount extends OperationsAccount {
  readonly demoPin: string;
}

export interface OperationsSession {
  readonly accountId: EntityId | null;
  readonly effectiveRole: AppRole | null;
  /** Absent in demo/persisted state, where access is always active. */
  readonly accessState?: AccessState;
}

export type DemoSession = OperationsSession;

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface PostalAddress {
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly countryCode: "US";
}

export interface Contact {
  readonly name: string;
  readonly phone: string;
  readonly email?: string;
}

export interface AppointmentWindow {
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly timeZone: string;
}
