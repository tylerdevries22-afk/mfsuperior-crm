import { buildProductionOperationsState } from "../productionStateAdapter";

describe("production state adapter", () => {
  it("maps tenant-scoped mobile API data into a non-demo freight state", () => {
    const state = buildProductionOperationsState(
      {
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
      [{
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
      [],
      "2026-08-21T12:00:00.000Z",
    );

    expect(state.accounts[0]).toMatchObject({ id: "user-1", role: "driver" });
    expect(state.shipments[0]).toMatchObject({ loadNumber: "MF-2048", status: "in_transit" });
    expect(state.shipments[0]?.stops.map((stop) => stop.address.city)).toEqual(["Aurora", "Loveland"]);
    expect(state.integrations[0]).toMatchObject({ isSimulation: false, status: "not_configured" });
    expect(state.accounts[0]).not.toHaveProperty("demoPin");
  });

  it("keeps an unlinked customer pending while allowing request state to render", () => {
    const state = buildProductionOperationsState(
      {
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
      [],
      [{
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
      "2026-08-21T12:00:00.000Z",
    );

    expect(state.accounts[0]?.customerId).toBe("pending:user-2");
    expect(state.requests[0]).toMatchObject({ customerId: "pending:user-2", status: "submitted" });
    expect(state.shipments).toEqual([]);
  });
});
