"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  MapPin,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerBadge, PartnerSelect, usePartners } from "@/components/partners";
import { CarrierApiError, fetchCarrierData } from "../../_lib/api-client";

interface ShipmentLocation {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

interface ShipmentEvent {
  id: string;
  eventType: string;
  statusReason: string | null;
  notes: string | null;
  locationAddress: string | null;
  recordedAt: string;
}

interface ShipmentDetail {
  id: string;
  partnerSlug: string | null;
  targetLoadId: string | null;
  targetPoNumber: string | null;
  bolNumber: string | null;
  proNumber: string | null;
  scac: string | null;
  status: string;
  origin: ShipmentLocation;
  destination: ShipmentLocation;
  commodity: string | null;
  weightLbs: number | null;
  palletCount: number | null;
  equipmentType: string | null;
  specialInstructions: string | null;
  rateCents: number | null;
  fuelSurchargeCents: number | null;
  accessorialsCents: number | null;
  estimatedPickupAt: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  events: ShipmentEvent[];
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

function money(cents: number | null) {
  return cents === null ? "—" : `$${(cents / 100).toFixed(2)}`;
}

function timestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function CarrierShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const partners = usePartners();
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCarrierData<ShipmentDetail>(`/api/carrier/shipments/${id}`)
      .then((data) => {
        if (active) setShipment(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Unable to load the load.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  /**
   * Reassigning the partner writes straight through to the API. The optimistic
   * update is reverted on failure so the picker never shows a value the server
   * rejected.
   */
  async function assignPartner(slug: string | null) {
    if (!shipment || slug === shipment.partnerSlug) return;
    const previous = shipment.partnerSlug;
    setShipment({ ...shipment, partnerSlug: slug });
    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/carrier/shipments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerSlug: slug }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new CarrierApiError(
          body?.error?.message ?? "The partner could not be saved.",
          "API_ERROR",
          response.status,
        );
      }
    } catch (reason) {
      setShipment((current) =>
        current ? { ...current, partnerSlug: previous } : current,
      );
      setSaveError(
        reason instanceof Error ? reason.message : "The partner could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-white/40">Loading load…</p>;
  }
  if (error || !shipment) {
    return (
      <div className="space-y-4 p-6">
        <BackLink />
        <p className="text-sm text-destructive">{error ?? "Load not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <BackLink />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Package className="h-5 w-5 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">
              {shipment.targetLoadId ?? `Shipment #${shipment.id.slice(0, 8)}`}
            </h1>
            <Badge variant={statusVariant[shipment.status] ?? "neutral"}>
              {shipment.status.replace("_", " ")}
            </Badge>
          </div>
          {shipment.partnerSlug ? (
            <PartnerBadge
              slug={shipment.partnerSlug}
              size="md"
              partners={partners}
              className="[&>span:nth-child(2)]:text-white"
            />
          ) : (
            <p className="text-sm text-white/40">No partner assigned</p>
          )}
        </div>
        <div className="text-right text-sm text-white/60">
          <p className="flex items-center justify-end gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {locationLabel(shipment.origin)}
            <span className="text-white/20">→</span>
            {locationLabel(shipment.destination)}
          </p>
          <p className="mt-1 flex items-center justify-end gap-1 text-xs text-white/40">
            <Calendar className="h-3 w-3" />
            ETA {timestamp(shipment.estimatedDeliveryAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900 lg:col-span-1">
          <CardHeader className="border-slate-800">
            <CardTitle className="text-sm font-medium text-white">
              Customer / broker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PartnerSelect
              value={shipment.partnerSlug}
              onChange={assignPartner}
              partners={partners}
              emptyLabel="No partner"
              disabled={saving}
              aria-label="Assign this load to a partner"
            />
            {saving && (
              <p className="flex items-center gap-1.5 text-xs text-white/40">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </p>
            )}
            {saveError && <p className="text-xs text-destructive">{saveError}</p>}
            <p className="text-xs text-white/40">
              Sets which partner this load bills to. Drives the logo shown on the
              board and the revenue split on the dashboard.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900 lg:col-span-2">
          <CardHeader className="border-slate-800">
            <CardTitle className="text-sm font-medium text-white">
              Load details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Detail label="BOL" value={shipment.bolNumber ?? "—"} />
              <Detail label="PRO" value={shipment.proNumber ?? "—"} />
              <Detail label="PO" value={shipment.targetPoNumber ?? "—"} />
              <Detail label="SCAC" value={shipment.scac ?? "—"} />
              <Detail label="Commodity" value={shipment.commodity ?? "—"} />
              <Detail
                label="Equipment"
                value={shipment.equipmentType ?? "—"}
              />
              <Detail
                label="Weight"
                value={
                  shipment.weightLbs
                    ? `${shipment.weightLbs.toLocaleString()} lbs`
                    : "—"
                }
              />
              <Detail
                label="Pallets"
                value={shipment.palletCount?.toString() ?? "—"}
              />
              <Detail label="Line haul" value={money(shipment.rateCents)} />
              <Detail label="Fuel" value={money(shipment.fuelSurchargeCents)} />
              <Detail
                label="Accessorials"
                value={money(shipment.accessorialsCents)}
              />
              <Detail
                label="Pickup ETA"
                value={timestamp(shipment.estimatedPickupAt)}
              />
            </dl>
            {shipment.specialInstructions && (
              <p className="mt-4 border-t border-slate-800 pt-3 text-xs text-white/50">
                {shipment.specialInstructions}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="border-slate-800">
          <CardTitle className="text-sm font-medium text-white">
            Event history
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {shipment.events.length === 0 ? (
            <p className="text-sm text-white/40">No events recorded.</p>
          ) : (
            shipment.events.map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between gap-4 border-b border-slate-800 pb-2 text-sm last:border-b-0 last:pb-0"
              >
                <div>
                  <p className="text-white/80">
                    {event.eventType.replace(/_/g, " ")}
                    {event.statusReason ? ` · ${event.statusReason}` : ""}
                  </p>
                  {event.notes && (
                    <p className="text-xs text-white/40">{event.notes}</p>
                  )}
                </div>
                <p className="shrink-0 text-xs text-white/40">
                  {timestamp(event.recordedAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/carrier/shipments"
      className="inline-flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> All loads
    </Link>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-white/40">
        {label}
      </dt>
      <dd className="font-mono text-sm tabular-nums text-white/80">{value}</dd>
    </div>
  );
}
