"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Inbox, MapPin, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerLogo, usePartners } from "@/components/partners";
import { findPartner, type Partner } from "@/data/partners";
import { fetchCarrierData } from "../_lib/api-client";

interface RunLocation {
  city?: string;
  state?: string;
}

interface Run {
  id: string;
  partnerSlug: string | null;
  targetLoadId: string | null;
  bolNumber: string | null;
  status: string;
  origin: RunLocation;
  destination: RunLocation;
  commodity: string | null;
  rateCents: number | null;
  equipmentType: string | null;
  estimatedPickupAt: string | null;
  estimatedDeliveryAt: string | null;
}

interface FleetTruck {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  phone: string | null;
  locationUpdatedAt: string | null;
  runs: Run[];
}

interface Board {
  trucks: FleetTruck[];
  unassigned: Run[];
}

const driverStatusVariant: Record<string, "success" | "brand" | "muted" | "danger"> = {
  available: "success",
  on_duty: "brand",
  off_duty: "muted",
  suspended: "danger",
};

const runStatusVariant: Record<
  string,
  "warning" | "brand" | "success" | "danger" | "neutral"
> = {
  tendered: "warning",
  accepted: "brand",
  dispatched: "brand",
  at_pickup: "neutral",
  in_transit: "brand",
  at_delivery: "warning",
  exception: "danger",
};

function lane(run: Run) {
  const from = [run.origin.city, run.origin.state].filter(Boolean).join(", ");
  const to = [run.destination.city, run.destination.state]
    .filter(Boolean)
    .join(", ");
  if (!from && !to) return "Lane unavailable";
  return `${from || "—"} → ${to || "—"}`;
}

export default function CarrierDispatchPage() {
  const partners = usePartners();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchCarrierData<Board>("/api/carrier/dispatch")
      .then((data) => {
        if (active) setBoard(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load the dispatch board.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dispatch board</h1>
        <p className="text-sm text-white/50">
          Trucks, the runs on them, and whose freight each one is carrying.
        </p>
      </div>

      {loading ? <p className="text-sm text-white/40">Loading board…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {board && board.unassigned.length > 0 && (
        <Card className="border-warning/30 bg-slate-900">
          <CardHeader className="border-slate-800">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-white">
              <Inbox className="h-4 w-4 text-warning" />
              Awaiting assignment
              <Badge variant="warning">{board.unassigned.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {board.unassigned.map((run) => (
              <RunRow key={run.id} run={run} partners={partners} />
            ))}
          </CardContent>
        </Card>
      )}

      {board && board.trucks.length === 0 && !error ? (
        <p className="text-sm text-white/40">No trucks in the fleet yet.</p>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        {board?.trucks.map((truck) => (
          <Card key={truck.id} className="border-slate-800 bg-slate-900">
            <CardHeader className="border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-white">
                  <Truck className="h-4 w-4 text-blue-400" />
                  {truck.firstName} {truck.lastName}
                  <Badge variant={driverStatusVariant[truck.status] ?? "muted"}>
                    {truck.status.replace("_", " ")}
                  </Badge>
                </CardTitle>
                {/* Partner logos for everything on this truck, so a dispatcher
                    can read the truck's book without opening a run. */}
                <div className="flex items-center gap-1">
                  {[
                    ...new Set(
                      truck.runs
                        .map((run) => run.partnerSlug)
                        .filter((slug): slug is string => Boolean(slug)),
                    ),
                  ].map((slug) => (
                    <PartnerLogo
                      key={slug}
                      slug={slug}
                      size="xs"
                      partners={partners}
                    />
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {truck.runs.length === 0 ? (
                <p className="text-sm text-white/40">No runs assigned.</p>
              ) : (
                truck.runs.map((run) => (
                  <RunRow key={run.id} run={run} partners={partners} />
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RunRow({
  run,
  partners,
}: {
  run: Run;
  partners: readonly Partner[];
}) {
  const partner = findPartner(run.partnerSlug, partners);

  return (
    <Link
      href={`/carrier/shipments/${run.id}`}
      className="flex items-center gap-3 rounded-md border border-slate-800 px-3 py-2 transition-colors hover:border-slate-700 hover:bg-slate-800/40"
    >
      {run.partnerSlug ? (
        <PartnerLogo slug={run.partnerSlug} size="sm" partners={partners} />
      ) : (
        <span
          aria-hidden
          className="inline-block size-5 shrink-0 rounded-sm bg-slate-800"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm text-white">
          {run.targetLoadId ?? run.bolNumber ?? `#${run.id.slice(0, 8)}`}
          <Badge variant={runStatusVariant[run.status] ?? "neutral"}>
            {run.status.replace("_", " ")}
          </Badge>
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-white/40">
          <MapPin className="h-3 w-3 shrink-0" />
          {lane(run)}
          {partner ? ` · ${partner.name}` : ""}
        </p>
      </div>
      {run.rateCents !== null && (
        <p className="shrink-0 font-mono text-sm tabular-nums text-white/70">
          ${(run.rateCents / 100).toFixed(2)}
        </p>
      )}
    </Link>
  );
}
