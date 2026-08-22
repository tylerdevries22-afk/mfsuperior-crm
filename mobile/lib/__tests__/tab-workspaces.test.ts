import type { Shipment } from "@/domain/types";
import {
  filterScheduleShipments,
  isCustomerRequestDraftValid,
  localAssistantReply,
  validateCustomerRequestDraft,
} from "../tab-workspaces";

function shipment(
  id: string,
  startsAt: string,
  status: Shipment["status"],
  assignedDriverId = "driver-1",
): Shipment {
  return {
    id,
    status,
    assignedDriverId,
    stops: [{ appointment: { startsAt } }],
  } as unknown as Shipment;
}

describe("tab workspace helpers", () => {
  const loads = [
    shipment("tomorrow", "2026-08-21T14:00:00.000Z", "tendered"),
    shipment("today", "2026-08-20T16:00:00.000Z", "dispatched"),
    shipment("complete", "2026-08-18T16:00:00.000Z", "delivered"),
    shipment("other-driver", "2026-08-20T15:00:00.000Z", "accepted", "driver-2"),
  ];

  it("applies driver, date, and status filters without mutating the load list", () => {
    const filtered = filterScheduleShipments(loads, {
      role: "driver",
      driverId: "driver-1",
      date: "today",
      status: "active",
      now: new Date("2026-08-20T12:00:00.000Z"),
    });

    expect(filtered.map(({ id }) => id)).toEqual(["today"]);
    expect(loads.map(({ id }) => id)).toEqual([
      "tomorrow",
      "today",
      "complete",
      "other-driver",
    ]);
  });

  it("keeps future tenders visible to admins", () => {
    const filtered = filterScheduleShipments(loads, {
      role: "admin",
      date: "upcoming",
      status: "tenders",
      now: new Date("2026-08-20T12:00:00.000Z"),
    });

    expect(filtered.map(({ id }) => id)).toEqual(["tomorrow"]);
  });

  it("keeps an already scoped driver list visible during admin role preview", () => {
    const filtered = filterScheduleShipments([loads[1]], {
      role: "driver",
      date: "all",
      status: "all",
      now: new Date("2026-08-20T12:00:00.000Z"),
    });

    expect(filtered.map(({ id }) => id)).toEqual(["today"]);
  });

  it("returns deterministic responses and identifies Target onboarding status", () => {
    expect(localAssistantReply("Where is my load?", "TGT-28471")).toContain("TGT-28471");
    expect(localAssistantReply("Did Target send a 204?")).toContain("requires EDI onboarding");
    expect(localAssistantReply("Do I need a break?")).toContain("not an ELD");
  });

  it("validates both short and oversized request fields", () => {
    expect(validateCustomerRequestDraft({ type: "quote", subject: "Hi", details: "Short" })).toEqual({
      subject: "Enter a subject with at least 4 characters.",
      details: "Add at least 12 characters of operational detail.",
      origin: "Add the pickup address.",
      destination: "Add the delivery address.",
    });
    const complete = validateCustomerRequestDraft({
      type: "pickup",
      subject: "Weekly pickup",
      details: "Schedule five pallets for Friday.",
      origin: { addressLine1: "100 Crossdock Rd", city: "Aurora", postalCode: "80011", state: "CO" },
      destination: { addressLine1: "200 Market St", city: "Loveland", postalCode: "80537", state: "CO" },
    });
    expect(complete).toEqual({
      subject: undefined,
      details: undefined,
      origin: undefined,
      destination: undefined,
    });
    expect(isCustomerRequestDraftValid(complete)).toBe(true);
    // The freight request API rejects intake without a complete address pair.
    expect(isCustomerRequestDraftValid(validateCustomerRequestDraft({
      type: "pickup",
      subject: "Weekly pickup",
      details: "Schedule five pallets for Friday.",
      origin: { addressLine1: "100 Crossdock Rd", city: "Aurora", postalCode: "", state: "CO" },
      destination: { addressLine1: "200 Market St", city: "Loveland", postalCode: "80537", state: "CO" },
    }))).toBe(false);
  });
});
