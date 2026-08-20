"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Phone, Mail } from "lucide-react";

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  currentLat: string | null;
  currentLng: string | null;
  locationUpdatedAt: string | null;
  licenseState: string | null;
  cdhType: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  available: "bg-green-500/20 text-green-400 border-green-500/30",
  on_duty: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  off_duty: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  suspended: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function CarrierDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/carrier/drivers")
      .then((r) => r.json())
      .then((d) => { setDrivers(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = drivers.filter((d) =>
    `${d.firstName} ${d.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
    (d.email || "").toLowerCase().includes(query.toLowerCase()) ||
    (d.phone || "").includes(query)
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Drivers</h1>
          <p className="text-sm text-white/50">Fleet driver management and GPS tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-white/40" />
          <Input
            placeholder="Search drivers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64 bg-slate-900 border-slate-700 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-white/40 text-sm">Loading drivers...</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/40 text-sm">No drivers found.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((d) => (
            <Card key={d.id} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-400" />
                      <span className="font-semibold text-white text-sm">{d.firstName} {d.lastName}</span>
                      <Badge variant="outline" className={`text-xs ${statusColors[d.status] || "bg-slate-500/20 text-slate-400"}`}>
                        {d.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/50">
                      {d.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {d.email}</span>}
                      {d.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {d.phone}</span>}
                    </div>
                    {d.currentLat && d.currentLng && (
                      <p className="text-xs text-white/40">
                        Last seen: {Number(d.currentLat).toFixed(4)}, {Number(d.currentLng).toFixed(4)}
                        {d.locationUpdatedAt ? ` · ${new Date(d.locationUpdatedAt).toLocaleTimeString()}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {d.licenseState && <p className="text-xs text-white/40">{d.licenseState} CDL</p>}
                    {d.cdhType && <p className="text-xs text-white/40">{d.cdhType}</p>}
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
