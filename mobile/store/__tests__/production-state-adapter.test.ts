import type { AuthIdentity } from "../../lib/auth";
import {
  buildPendingCustomerOperationsState,
  buildProductionOperationsState,
} from "../productionStateAdapter";

const PENDING_IDENTITY: AuthIdentity = {
  accessState: "pending_customer_approval",
  carrierId: null,
  customerAccountId: null,
  driverId: null,
  email: "pending@northline.example.com",
  mfa: { currentLevel: "aal1", factors: [], nextLevel: "aal1", status: "unenrolled" },
  organizationId: "org-1",
  organizationSlug: "mf-superior",
  role: "customer",
  userId: "user-3",
};

describe("production state adapter", () => {
  it("maps tenant-scoped mobile API data into a non-demo freight state", () => {
    const state = buildProductionOperationsState(
      {
      bootstrap: {
        integrations: [{ lastSucceededAt: null, provider: "target", status: "not_configured" }],
        organization: { id: "org-1", name: "MF Superior Products" },
        referenceData: {
          drivers: [{
            currentLat: "39.7392",
            currentLng: "-104.9903",
            email: "driver@example.com",
            firstName: "Brenna",
            id: "driver-1",
            lastName: "Lewis",
            licenseNumber: "CO-100",
            licenseState: "CO",
            locationUpdatedAt: "2026-08-21T12:00:00.000Z",
            phone: "3035550100",
            status: "on_duty",
          }],
        },
        user: {
          customerAccountId: null,
          displayName: "Brenna Lewis",
          driverId: "driver-1",
          email: "driver@example.com",
          id: "user-1",
          role: "driver",
        },
      },
      exceptions: [{
        category: "cargo_damage",
        description: "One pallet wrap is torn.",
        id: "exception-1",
        photoUrls: ["freight/photo.jpg"],
        reportedAt: "2026-08-21T11:00:00.000Z",
        reportedByDriverId: "driver-1",
        resolutionNote: null,
        resolvedAt: null,
        severity: "medium",
        shipmentId: "shipment-1",
        status: "open",
      }],
      messages: [{
        body: "Running thirty minutes behind.",
        id: "message-1",
        readByUserIds: ["user-1"],
        recipientUserIds: ["user-admin"],
        senderUserId: "user-1",
        sentAt: "2026-08-21T11:30:00.000Z",
        shipmentId: "shipment-1",
        threadKey: "thread-shipment-1",
        threadKind: "shipment",
      }],
      requests: [],
      shipments: [{
        bolNumber: "BOL-1",
        commodity: "Produce",
        destination: { addressLine1: "200 Market St", city: "Loveland", postalCode: "80537", state: "CO" },
        driverId: "driver-1",
        equipmentType: "reefer",
        estimatedDeliveryAt: "2026-08-21T15:00:00.000Z",
        estimatedPickupAt: "2026-08-21T10:00:00.000Z",
        id: "shipment-1",
        loadNumber: "MF-2048",
        origin: { addressLine1: "100 Crossdock Rd", city: "Aurora", postalCode: "80011", state: "CO" },
        palletCount: 24,
        proNumber: "PRO-1",
        specialInstructions: null,
        status: "in_transit",
        updatedAt: "2026-08-21T12:00:00.000Z",
        weightLbs: 38000,
      }],
      },
      "2026-08-21T12:00:00.000Z",
    );

    expect(state.accounts[0]).toMatchObject({ id: "user-1", role: "driver" });
    expect(state.exceptions[0]).toMatchObject({
      category: "cargo_damage",
      severity: "medium",
      shipmentId: "shipment-1",
      status: "open",
    });
    expect(state.messages[0]).toMatchObject({
      id: "message-1",
      senderAccountId: "user-1",
      threadId: "thread-shipment-1",
    });
    expect(state.shipments[0]).toMatchObject({ loadNumber: "MF-2048", status: "in_transit" });
    expect(state.shipments[0]?.stops.map((stop) => stop.address.city)).toEqual(["Aurora", "Loveland"]);
    expect(state.integrations[0]).toMatchObject({ isSimulation: false, status: "not_configured" });
    expect(state.accounts[0]).not.toHaveProperty("demoPin");
  });

  it("keeps an unlinked customer pending while allowing request state to render", () => {
    const state = buildProductionOperationsState(
      {
      bootstrap: {
        integrations: [],
        organization: { id: "org-1", name: "MF Superior Products" },
        referenceData: { drivers: [] },
        user: {
          customerAccountId: null,
          displayName: "New Customer",
          driverId: null,
          email: "customer@example.com",
          id: "user-2",
          role: "customer",
        },
      },
      exceptions: [],
      messages: [],
      shipments: [],
      requests: [{
        commodity: "Packaged goods",
        createdAt: "2026-08-21T12:00:00.000Z",
        customerAccountId: null,
        equipmentType: "dry_van",
        id: "request-1",
        notes: "Quote requested for Friday.",
        referenceNumber: "REQ-104",
        shipmentId: null,
        status: "submitted",
        updatedAt: "2026-08-21T12:00:00.000Z",
      }],
      },
      "2026-08-21T12:00:00.000Z",
    );

    expect(state.accounts[0]?.customerId).toBe("pending:user-2");
    expect(state.requests[0]).toMatchObject({ customerId: "pending:user-2", status: "submitted" });
    expect(state.shipments).toEqual([]);
  });

  it("renders pending customer access without any operational data", () => {
    const state = buildPendingCustomerOperationsState(
      PENDING_IDENTITY,
      [{
        commodity: "Packaged goods",
        createdAt: "2026-08-21T12:00:00.000Z",
        customerAccountId: null,
        equipmentType: "dry_van",
        id: "request-9",
        notes: "Quote requested for Friday.",
        referenceNumber: "REQ-109",
        shipmentId: null,
        status: "submitted",
        updatedAt: "2026-08-21T12:00:00.000Z",
      }],
      "2026-08-21T12:00:00.000Z",
    );

    expect(state.session).toEqual({
      accessState: "pending_customer_approval",
      accountId: "user-3",
      effectiveRole: "customer",
    });
    expect(state.accounts[0]).toMatchObject({
      customerId: "pending:user-3",
      email: "pending@northline.example.com",
      role: "customer",
    });
    expect(state.requests[0]).toMatchObject({ customerId: "pending:user-3", id: "request-9" });
    expect(state.shipments).toEqual([]);
    expect(state.drivers).toEqual([]);
    expect(state.integrations).toEqual([]);
    expect(state.hosClocks).toEqual([]);
  });
});
