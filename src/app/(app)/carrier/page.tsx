"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  MapPin,
  Package,
  Radio,
  TrendingUp,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCarrierData } from "./_lib/api-client";

type IntegrationStatus =
  | "simulated"
  | "not_configured"
  | "connected"
  | "degraded";

interface DashboardData {
  metrics: {
    activeShipments: number;
    todayDeliveries: number;
    onTimeRate: number | null;
    avgTransitHours: number | null;
    activeDrivers: number;
    pendingTenders: number;
  };
  integrations: ReadonlyArray<{
    id: string;
    label: string;
    status: IntegrationStatus;
  }>;
}

const integrationVariant: Record<
  IntegrationStatus,
  "warning" | "muted" | "success" | "danger"
> = {
  simulated: "warning",
  not_configured: "muted",
  connected: "success",
  degraded: "danger",
};

function integrationDetail(status: IntegrationStatus) {
  if (status === "simulated") return "Local demonstration only";
  if (status === "connected") return "Live connection verified";
  if (status === "degraded") return "Connection requires attention";
  return "No live connection configured";
}

export default function CarrierPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCarrierData<DashboardData>("/api/carrier/dashboard")
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Carrier operations are unavailable.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const metrics = dashboard?.metrics;
  const statCards = [
    { label: "Active Shipments", value: metrics?.activeShipments, icon: Package },
    { label: "Today Deliveries", value: metrics?.todayDeliveries, icon: Truck },
    { label: "Active Drivers", value: metrics?.activeDrivers, icon: MapPin },
    { label: "Pending Tenders", value: metrics?.pendingTenders, icon: Radio },
    {
      label: "On-Time Rate",
      value: metrics
        ? metrics.onTimeRate === null
          ? "Unavailable"
          : `${metrics.onTimeRate}%`
        : undefined,
      icon: TrendingUp,
    },
    {
      label: "Avg Transit",
      value: metrics
        ? metrics.avgTransitHours === null
          ? "Unavailable"
          : `${metrics.avgTransitHours}h`
        : undefined,
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Carrier Operations</h1>
        <p className="text-sm text-white/50">
          Target workflow readiness for MF Superior — connectivity is shown
          explicitly below.
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-slate-800 bg-slate-900">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-slate-800 p-2 text-blue-400">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {!dashboard && !error ? "—" : (value ?? "Unavailable")}
                </p>
                <p className="text-xs text-white/50">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-white">
            Target Integration Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard?.integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <div>
                <p className="text-white/70">{integration.label}</p>
                <p className="text-xs text-white/40">
                  {integrationDetail(integration.status)}
                </p>
              </div>
              <Badge variant={integrationVariant[integration.status]}>
                {integration.status.replace("_", " ")}
              </Badge>
            </div>
          ))}
          {!dashboard && !error ? (
            <p className="text-sm text-white/40">Checking configuration…</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
