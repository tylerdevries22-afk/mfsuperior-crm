"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Radio, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchCarrierData } from "../_lib/api-client";

interface EdiTransaction {
  id: string;
  transactionType: string;
  direction: string;
  senderId: string | null;
  receiverId: string | null;
  controlNumber: string | null;
  shipmentId: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

const statusVariant: Record<
  string,
  "brand" | "warning" | "success" | "danger" | "neutral"
> = {
  received: "brand",
  parsed: "warning",
  processed: "success",
  error: "danger",
  acknowledged: "neutral",
};

const typeLabels: Record<string, string> = {
  "204": "Load Tender",
  "214": "Shipment Status",
  "990": "Response",
  "210": "Invoice",
  "997": "Acknowledgment",
};

export default function CarrierEdiPage() {
  const [transactions, setTransactions] = useState<EdiTransaction[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCarrierData<EdiTransaction[]>("/api/carrier/edi?limit=100")
      .then((data) => {
        if (active) setTransactions(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Unable to load EDI records.",
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
  const filtered = transactions.filter(
    (transaction) =>
      transaction.transactionType.includes(query) ||
      (transaction.controlNumber ?? "").includes(query) ||
      (transaction.senderId ?? "").toLowerCase().includes(normalizedQuery),
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">EDI Audit Trail</h1>
          <p className="text-sm text-white/50">
            Recorded X12 workflow events; live Target EDI is not configured.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-white/40" />
          <Input
            aria-label="Search EDI transactions"
            placeholder="Search type, control #, sender…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full border-slate-700 bg-slate-900 text-white sm:w-64"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-white/40">Loading EDI transactions…</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!loading && !error && filtered.length === 0 ? (
        <p className="text-sm text-white/40">No EDI transactions found.</p>
      ) : null}

      <div className="space-y-2">
        {filtered.map((transaction) => {
          const DirectionIcon =
            transaction.direction === "inbound" ? ArrowDownLeft : ArrowUpRight;
          return (
            <Card
              key={transaction.id}
              className="border-slate-800 bg-slate-900"
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded bg-blue-500/10 p-1.5">
                      <DirectionIcon className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Radio className="h-3 w-3 text-white/40" />
                        <span className="text-sm font-medium text-white">
                          {typeLabels[transaction.transactionType] ??
                            transaction.transactionType}
                        </span>
                        <Badge
                          variant={statusVariant[transaction.status] ?? "neutral"}
                        >
                          {transaction.status}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-white/40">
                        Control: {transaction.controlNumber ?? "—"} · Sender: {" "}
                        {transaction.senderId ?? "—"} · Receiver: {" "}
                        {transaction.receiverId ?? "—"}
                        {transaction.shipmentId
                          ? ` · Shipment #${transaction.shipmentId.slice(0, 8)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-white/30">
                      {new Date(transaction.createdAt).toLocaleString()}
                    </p>
                    {transaction.errorMessage ? (
                      <p className="mt-1 text-xs text-destructive">
                        {transaction.errorMessage}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
