"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Package, MapPin, Radio, Clock, TrendingUp } from "lucide-react";

interface Stats {
  activeShipments: number;
  todayDeliveries: number;
  onTimeRate: number;
  avgTransitHours: number;
  activeDrivers: number;
  pendingTenders: number;
}

export default function CarrierPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/carrier/dashboard")
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statCards = [
    { label: "Active Shipments", value: stats?.activeShipments ?? 0, icon: Package, color: "text-blue-400" },
    { label: "Today Deliveries", value: stats?.todayDeliveries ?? 0, icon: Truck, color: "text-green-400" },
    { label: "Active Drivers", value: stats?.activeDrivers ?? 0, icon: MapPin, color: "text-amber-400" },
    { label: "Pending Tenders", value: stats?.pendingTenders ?? 0, icon: Radio, color: "text-rose-400" },
    { label: "On-Time Rate", value: `${stats?.onTimeRate ?? 0}%`, icon: TrendingUp, color: "text-cyan-400" },
    { label: "Avg Transit", value: `${stats?.avgTransitHours ?? 0}h`, icon: Clock, color: "text-violet-400" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Target Carrier</h1>
        <p className="text-sm text-white/50">Logistics dashboard for Target Corporation partner operations</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-2 rounded-lg bg-slate-800 ${s.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{loading ? "—" : s.value}</p>
                  <p className="text-xs text-white/50">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-sm font-medium">EDI Integration Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Inbound X12 204 (Load Tender)</span>
            <span className="text-green-400 font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Inbound X12 214 (Shipment Status)</span>
            <span className="text-green-400 font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Outbound X12 990 (Response)</span>
            <span className="text-amber-400 font-medium">Pending Config</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Driver GPS Tracking</span>
            <span className="text-green-400 font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Geofence Alerts</span>
            <span className="text-green-400 font-medium">Active</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
