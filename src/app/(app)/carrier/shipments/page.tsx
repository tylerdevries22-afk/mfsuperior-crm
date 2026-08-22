"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calendar, MapPin, Package, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PartnerBadge, PartnerSelect, usePartners } from "@/components/partners";
import { fetchCarrierData } from "../_lib/api-client";

interface ShipmentLocation {
  city?: string;
  state?: string;
}

interface Shipment {
  id: string;
  partnerSlug: string | null;
  targetLoadId: string | null;
  bolNumber: string | null;
  proNumber: string | null;
  status: string;
  origin: ShipmentLocation;
  destination: ShipmentLocation;
  commodity: string | null;
  weightLbs: number | null;
  rateCents: number | null;
  estimatedDeliveryAt: string | null;
}

const statusVariant: Record<
  string,
  "warning" | "brand" | "success" | "danger" | "neutral"
> = {
  tendered: "warning",
  accepted: "brand",
  dispatched: "brand",
  at_pickup: "neutral",
  in_transit: "brand",
  at_delivery: "warning",
  delivered: "success",
  cancelled: "danger",
  exception: "danger",
};

function locationLabel(location: ShipmentLocation) {
  const parts = [location.city, location.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "Location unavailable";
}

export default function CarrierShipmentsPage() {
  const partners = usePartners();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [query, setQuery] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCarrierData<Shipment[]>("/api/carrier/shipments?limit=100")
      .then((data) => {
        if (active) setShipments(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Unable to load shipments.",
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

  const normalizedQuery = query.toLowerCase();
  const filtered = shipments.filter((shipment) => {
    if (partnerFilter && shipment.partnerSlug !== partnerFilter) return false;
    return (
      (shipment.targetLoadId ?? "").toLowerCase().includes(normalizedQuery) ||
      (shipment.bolNumber ?? "").toLowerCase().includes(normalizedQuery) ||
      (shipment.proNumber ?? "").toLowerCase().includes(normalizedQuery) ||
      locationLabel(shipment.origin).toLowerCase().includes(normalizedQuery) ||
      locationLabel(shipment.destination).toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Loads</h1>
          <p className="text-sm text-white/50">
            Carrier loads; Target IDs are reference data, not proof of connectivity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PartnerSelect
            value={partnerFilter}
            onChange={setPartnerFilter}
            partners={partners}
            emptyLabel="All partners"
            aria-label="Filter loads by partner"
            className="w-full sm:w-56"
          />
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-white/40" />
            <Input
              aria-label="Search shipments"
              placeholder="Search loads, BOL, PRO…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full border-slate-700 bg-slate-900 text-white sm:w-64"
            />
          </div>
        </div>
      </div>

      {loading ? <p className="text-sm text-white/40">Loading shipments…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!loading && !error && filtered.length === 0 ? (
        <p className="text-sm text-white/40">No shipments found.</p>
      ) : null}

      <div className="space-y-3">
        {filtered.map((shipment) => (
          <Card
            key={shipment.id}
            className="border-slate-800 bg-slate-900 transition-colors hover:border-slate-700"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Package className="h-4 w-4 text-blue-400" />
                    <Link
                      href={`/carrier/shipments/${shipment.id}`}
                      className="text-sm font-semibold text-white underline-offset-4 hover:underline"
                    >
                      {shipment.targetLoadId ??
                        `Shipment #${shipment.id.slice(0, 8)}`}
                    </Link>
                    <Badge
                      variant={statusVariant[shipment.status] ?? "neutral"}
                    >
                      {shipment.status.replace("_", " ")}
                    </Badge>
                  </div>
                  {/* Whose freight this is — the first thing dispatch looks
                      for when scanning the board. */}
                  {shipment.partnerSlug ? (
                    <PartnerBadge
                      slug={shipment.partnerSlug}
                      partners={partners}
                      showStatus={false}
                      className="[&>span:nth-child(2)]:text-white/80"
                    />
                  ) : (
                    <p className="text-xs text-white/30">No partner assigned</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {locationLabel(shipment.origin)}
                    </span>
                    <span className="text-white/20">→</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {locationLabel(shipment.destination)}
                    </span>
                  </div>
                  {shipment.commodity ? (
                    <p className="text-xs text-white/40">
                      {shipment.commodity}
                      {shipment.weightLbs
                        ? ` · ${shipment.weightLbs.toLocaleString()} lbs`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1 text-right">
                  {shipment.rateCents !== null ? (
                    <p className="text-sm font-medium text-white">
                      ${(shipment.rateCents / 100).toFixed(2)}
                    </p>
                  ) : null}
                  {shipment.estimatedDeliveryAt ? (
                    <p className="flex items-center justify-end gap-1 text-xs text-white/40">
                      <Calendar className="h-3 w-3" />
                      {new Date(shipment.estimatedDeliveryAt).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
