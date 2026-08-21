import type { Shipment } from "@/domain/types";
import {
  formatAppointment,
  formatCurrency,
  formatMinutes,
  formatStatus,
  remainingMinutes,
  shipmentProgress,
  shipmentRoute,
} from "../operations-format";

describe("operations formatters", () => {
  it("formats freight statuses", () => {
    expect(formatStatus("in_transit")).toBe("In Transit");
    expect(formatStatus("  at_delivery ")).toBe("At Delivery");
  });

  it("formats whole-dollar currency from cents", () => {
    expect(formatCurrency(143_400)).toBe("$1,434");
  });

  it("formats valid and invalid appointment windows", () => {
    expect(formatAppointment({
      startsAt: "2026-08-20T14:00:00.000Z",
      endsAt: "2026-08-20T16:00:00.000Z",
      timeZone: "America/Denver",
    })).toBe("Aug 20 · 8:00 AM–10:00 AM");
    expect(formatAppointment({
      startsAt: "2026-08-20T14:00:00.000Z",
      endsAt: "2026-08-20T16:00:00.000Z",
      timeZone: "America/Chicago",
    })).toBe("Aug 20 · 9:00 AM–11:00 AM");
    expect(formatAppointment({
      startsAt: "invalid",
      endsAt: "invalid",
      timeZone: "America/Denver",
    })).toBe("Time unavailable");
    expect(formatAppointment({
      startsAt: "2026-08-20T14:00:00.000Z",
      endsAt: "2026-08-20T16:00:00.000Z",
      timeZone: "Invalid/Zone",
    })).toBe("Time unavailable");
  });

  it("derives a route from the first and last shipment stops", () => {
    const shipment = {
      stops: [
        { address: { city: "Aurora", state: "CO" } },
        { address: { city: "Pueblo", state: "CO" } },
      ],
    } as unknown as Shipment;
    expect(shipmentRoute(shipment)).toBe("Aurora, CO → Pueblo, CO");
    expect(shipmentRoute({ stops: [] } as unknown as Shipment)).toBe("Route pending");
  });

  it("keeps shipment progress and HOS time within safe bounds", () => {
    expect(shipmentProgress("tendered")).toBe(0.08);
    expect(shipmentProgress("delivered")).toBe(1);
    expect(remainingMinutes(710, 660)).toBe(0);
    expect(remainingMinutes(120, 660)).toBe(540);
    expect(formatMinutes(125)).toBe("2h 05m");
    expect(formatMinutes(-4)).toBe("0h 00m");
  });
});
