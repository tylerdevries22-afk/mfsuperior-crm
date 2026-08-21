import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { drivers, shipments } from "@/lib/db/schema";
import {
  databaseErrorResponse,
  requireCarrierAdmin,
  successResponse,
  withCarrierAuthHeaders,
} from "../_lib/http";

type IntegrationStatus =
  | "simulated"
  | "not_configured"
  | "connected"
  | "degraded";

function integrationHealth() {
  // No live adapter exists in this repository. The only affirmative state we
  // expose is an explicitly enabled local simulation; otherwise fail honest.
  const status: IntegrationStatus =
    process.env.CARRIER_DEMO_MODE === "true"
      ? "simulated"
      : "not_configured";

  return [
    { id: "edi_204", label: "Inbound X12 204 load tenders", status },
    { id: "edi_214", label: "Shipment status events", status },
    { id: "edi_990", label: "Outbound X12 990 responses", status },
    { id: "driver_gps", label: "Driver GPS tracking", status },
    { id: "geofences", label: "Geofence alerts", status },
  ] as const;
}

async function loadDashboard(carrierId: string) {
  const [[shipmentMetrics], [driverMetrics]] = await Promise.all([
    db
      .select({
        activeShipments: sql<number>`count(*) filter (
          where ${shipments.status} not in ('delivered', 'cancelled')
        )::int`,
        todayDeliveries: sql<number>`count(*) filter (
          where ${shipments.status} = 'delivered'
          and (${shipments.deliveredAt} at time zone 'America/Denver')::date =
            (now() at time zone 'America/Denver')::date
        )::int`,
        pendingTenders: sql<number>`count(*) filter (
          where ${shipments.status} = 'tendered'
        )::int`,
        trackedDeliveries: sql<number>`count(*) filter (
          where ${shipments.status} = 'delivered'
          and ${shipments.deliveredAt} is not null
          and ${shipments.estimatedDeliveryAt} is not null
        )::int`,
        onTimeDeliveries: sql<number>`count(*) filter (
          where ${shipments.status} = 'delivered'
          and ${shipments.deliveredAt} <= ${shipments.estimatedDeliveryAt}
        )::int`,
        avgTransitHours: sql<number | null>`avg(
          extract(epoch from (${shipments.deliveredAt} - ${shipments.pickedUpAt})) / 3600
        ) filter (
          where ${shipments.deliveredAt} is not null
          and ${shipments.pickedUpAt} is not null
          and ${shipments.deliveredAt} >= ${shipments.pickedUpAt}
        )`,
      })
      .from(shipments)
      .where(eq(shipments.carrierId, carrierId)),
    db
      .select({
        activeDrivers: sql<number>`count(*) filter (
          where ${drivers.status} = 'on_duty'
        )::int`,
      })
      .from(drivers)
      .where(eq(drivers.carrierId, carrierId)),
  ]);

  const trackedDeliveries = Number(shipmentMetrics.trackedDeliveries);
  const onTimeRate = trackedDeliveries
    ? Math.round(
        (Number(shipmentMetrics.onTimeDeliveries) / trackedDeliveries) * 1000,
      ) / 10
    : null;
  const average = shipmentMetrics.avgTransitHours;

  return {
    metrics: {
      activeShipments: Number(shipmentMetrics.activeShipments),
      todayDeliveries: Number(shipmentMetrics.todayDeliveries),
      activeDrivers: Number(driverMetrics.activeDrivers),
      pendingTenders: Number(shipmentMetrics.pendingTenders),
      onTimeRate,
      avgTransitHours:
        average === null ? null : Math.round(Number(average) * 10) / 10,
    },
    integrations: integrationHealth(),
  };
}

export async function GET(request: Request) {
  const authorization = await requireCarrierAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    return withCarrierAuthHeaders(
      successResponse(
        await loadDashboard(authorization.principal.carrierId),
        authorization.requestId,
      ),
      authorization,
    );
  } catch (error) {
    return databaseErrorResponse(
      error,
      "dashboard.read",
      authorization.requestId,
    );
  }
}
