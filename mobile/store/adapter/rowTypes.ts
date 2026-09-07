import type {
  AppRole,
  AvailabilityBlock,
  AvailabilityRule,
  ComplianceDocument,
  Driver,
  DriverShift,
  MaintenanceOrder,
  MessageThreadKind,
  Payout,
  ScheduleSyncStatus,
  ShiftCoverageRequest,
  Vehicle,
} from "../../domain/types";

export interface MobileBootstrapPayload {
  readonly integrations: readonly {
    readonly lastSucceededAt: string | null;
    readonly provider: string;
    readonly status: "connected" | "degraded" | "disabled" | "not_configured";
  }[];
  readonly organization: { readonly id: string; readonly name: string };
  readonly referenceData: {
    readonly contacts?: readonly MobileContactRow[];
    readonly drivers: readonly MobileDriverRow[];
  };
  readonly user: {
    readonly customerAccountId: string | null;
    readonly displayName: string;
    readonly driverId: string | null;
    readonly email: string;
    readonly id: string;
    readonly role: AppRole;
  };
}

export interface MobileContactRow {
  readonly displayName: string;
  readonly email: string;
  readonly id: string;
  readonly role: AppRole;
}

export interface MobileExceptionRow {
  readonly category: string | null;
  readonly description: string | null;
  readonly id: string;
  readonly photoUrls: unknown;
  readonly reportedAt: string;
  readonly reportedByDriverId: string | null;
  readonly resolutionNote: string | null;
  readonly resolvedAt: string | null;
  readonly severity: string | null;
  readonly shipmentId: string;
  readonly status: "open" | "resolved";
}

export interface MobileMessageRow {
  readonly body: string;
  readonly id: string;
  readonly readByUserIds: readonly string[];
  readonly recipientUserIds: readonly string[];
  readonly senderUserId: string;
  readonly sentAt: string;
  readonly shipmentId: string | null;
  readonly threadKey: string;
  readonly threadKind: MessageThreadKind;
}

export interface ProductionHydrationInput {
  readonly bootstrap: MobileBootstrapPayload;
  readonly exceptions: readonly MobileExceptionRow[];
  readonly messages: readonly MobileMessageRow[];
  readonly requests: readonly MobileFreightRequestRow[];
  readonly shipments: readonly MobileShipmentRow[];
  /**
   * Fleet, calendar, shop, compliance, and settlement collections.
   *
   * Optional so a client pointed at a server that has not yet deployed these
   * endpoints still hydrates, with the affected screens showing their empty
   * state rather than the whole session failing.
   */
  readonly availabilityBlocks?: readonly AvailabilityBlock[];
  readonly availabilityRules?: readonly AvailabilityRule[];
  readonly driverShifts?: readonly DriverShift[];
  readonly shiftCoverageRequests?: readonly ShiftCoverageRequest[];
  readonly scheduleSyncStatuses?: readonly ScheduleSyncStatus[];
  readonly complianceDocuments?: readonly ComplianceDocument[];
  readonly maintenanceOrders?: readonly MaintenanceOrder[];
  readonly payouts?: readonly Payout[];
  readonly vehicles?: readonly Vehicle[];
}

export interface MobileDriverRow {
  readonly currentLat: string | null;
  readonly currentLng: string | null;
  readonly email: string | null;
  readonly firstName: string;
  readonly id: string;
  readonly lastName: string;
  readonly licenseNumber: string | null;
  readonly licenseState: string | null;
  readonly locationUpdatedAt: string | null;
  readonly phone: string | null;
  readonly status: Driver["status"];
}

export interface MobileShipmentRow {
  readonly bolNumber: string | null;
  readonly commodity: string | null;
  readonly destination: unknown;
  readonly driverId: string | null;
  readonly equipmentType: string | null;
  readonly estimatedDeliveryAt: string | null;
  readonly estimatedPickupAt: string | null;
  readonly id: string;
  readonly loadNumber: string | null;
  readonly origin: unknown;
  readonly palletCount: number | null;
  readonly proNumber: string | null;
  readonly specialInstructions: string | null;
  readonly status: string;
  readonly updatedAt: string;
  readonly weightLbs: number | null;
}

export interface MobileFreightRequestRow {
  readonly commodity: string | null;
  readonly createdAt: string;
  readonly customerAccountId: string | null;
  readonly equipmentType: string | null;
  readonly id: string;
  readonly notes: string | null;
  readonly referenceNumber: string | null;
  readonly shipmentId: string | null;
  readonly status: string;
  readonly updatedAt: string;
}
