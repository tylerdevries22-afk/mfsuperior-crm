"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, Search, MapPin, Calendar } from "lucide-react";

interface Shipment {
  id: string;
  targetLoadId: string | null;
  targetPoNumber: string | null;
  bolNumber: string | null;
  proNumber: string | null;
  status: string;
  origin: { city: string; state: string };
  destination: { city: string; state: string };
  commodity: string | null;
  weightLbs: number | null;
  rateCents: number | null;
  estimatedDeliveryAt: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  tendered: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  accepted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  dispatched: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  at_pickup: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  in_transit: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  at_delivery: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  delivered: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  exception: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

export default function CarrierShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/carrier/shipments")
      .then((r) => r.json())
      .then((d) => { setShipments(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = shipments.filter((s) =>
    (s.targetLoadId || "").toLowerCase().includes(query.toLowerCase()) ||
    (s.bolNumber || "").toLowerCase().includes(query.toLowerCase()) ||
    (s.proNumber || "").toLowerCase().includes(query.toLowerCase()) ||
    s.origin.city.toLowerCase().includes(query.toLowerCase()) ||
    s.destination.city.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Shipments</h1>
          <p className="text-sm text-white/50">All loads and delivery tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-white/40" />
          <Input
            placeholder="Search loads, BOL, PRO..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64 bg-slate-900 border-slate-700 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-white/40 text-sm">Loading shipments...</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/40 text-sm">No shipments found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <Card key={s.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-400" />
                      <span className="font-semibold text-white text-sm">{s.targetLoadId || `Shipment #${s.id.slice(0, 8)}`}</span>
                      <Badge variant="outline" className={`text-xs ${statusColors[s.status] || "bg-slate-500/20 text-slate-400"}`}>
                        {s.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-white/50">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.origin.city}, {s.origin.state}</span>
                      <span className="text-white/20">→</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.destination.city}, {s.destination.state}</span>
                    </div>
                    {s.commodity && (
                      <p className="text-xs text-white/40">{s.commodity} {s.weightLbs ? `· ${s.weightLbs.toLocaleString()} lbs` : ""}</p>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    {s.rateCents && <p className="text-sm font-medium text-white">${(s.rateCents / 100).toFixed(2)}</p>}
                    {s.estimatedDeliveryAt && (
                      <p className="text-xs text-white/40 flex items-center gap-1 justify-end"><Calendar className="h-3 w-3" /> {new Date(s.estimatedDeliveryAt).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
