"use client";

import { useEffect, useState } from "react";
import { Mail, MapPin, Phone, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchCarrierData } from "../_lib/api-client";

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
  cdlType: string | null;
}

const statusVariant: Record<
  string,
  "success" | "brand" | "muted" | "danger"
> = {
  available: "success",
  on_duty: "brand",
  off_duty: "muted",
  suspended: "danger",
};

export default function CarrierDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCarrierData<Driver[]>("/api/carrier/drivers?limit=100")
      .then((data) => {
        if (active) setDrivers(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unable to load drivers.");
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
  const filtered = drivers.filter(
    (driver) =>
      `${driver.firstName} ${driver.lastName}`
        .toLowerCase()
        .includes(normalizedQuery) ||
      (driver.email ?? "").toLowerCase().includes(normalizedQuery) ||
      (driver.phone ?? "").includes(query),
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Drivers</h1>
          <p className="text-sm text-white/50">
            Fleet status and last reported location
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-white/40" />
          <Input
            aria-label="Search drivers"
            placeholder="Search drivers…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full border-slate-700 bg-slate-900 text-white sm:w-64"
          />
        </div>
      </div>

      {loading ? <p className="text-sm text-white/40">Loading drivers…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!loading && !error && filtered.length === 0 ? (
        <p className="text-sm text-white/40">No drivers found.</p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filtered.map((driver) => (
          <Card key={driver.id} className="border-slate-800 bg-slate-900">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-semibold text-white">
                      {driver.firstName} {driver.lastName}
                    </span>
                    <Badge variant={statusVariant[driver.status] ?? "muted"}>
                      {driver.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                    {driver.email ? (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {driver.email}
                      </span>
                    ) : null}
                    {driver.phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {driver.phone}
                      </span>
                    ) : null}
                  </div>
                  {driver.currentLat && driver.currentLng ? (
                    <p className="text-xs text-white/40">
                      Last reported: {Number(driver.currentLat).toFixed(4)}, {" "}
                      {Number(driver.currentLng).toFixed(4)}
                      {driver.locationUpdatedAt
                        ? ` · ${new Date(driver.locationUpdatedAt).toLocaleString()}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-xs text-white/40">
                  {driver.licenseState ? <p>{driver.licenseState} CDL</p> : null}
                  {driver.cdlType ? <p>{driver.cdlType}</p> : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
