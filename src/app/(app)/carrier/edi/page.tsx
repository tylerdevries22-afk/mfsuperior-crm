"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Radio, Search, ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface EdiTx {
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

const statusColors: Record<string, string> = {
  received: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  parsed: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  processed: "bg-green-500/20 text-green-400 border-green-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  acknowledged: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const typeLabels: Record<string, string> = {
  "204": "Load Tender",
  "214": "Shipment Status",
  "990": "Response",
  "210": "Invoice",
  "997": "Acknowledgment",
};

export default function CarrierEdiPage() {
  const [transactions, setTransactions] = useState<EdiTx[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/carrier/edi")
      .then((r) => r.json())
      .then((d) => { setTransactions(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = transactions.filter((t) =>
    (t.transactionType || "").includes(query) ||
    (t.controlNumber || "").includes(query) ||
    (t.senderId || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">EDI Transaction Log</h1>
          <p className="text-sm text-white/50">X12 inbound and outbound audit trail</p>
        </div>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-white/40" />
          <Input
            placeholder="Search type, control #, sender..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64 bg-slate-900 border-slate-700 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-white/40 text-sm">Loading EDI transactions...</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/40 text-sm">No EDI transactions found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const DirectionIcon = t.direction === "inbound" ? ArrowDownLeft : ArrowUpRight;
            return (
              <Card key={t.id} className="bg-slate-900 border-slate-800">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded ${t.direction === "inbound" ? "bg-green-500/10" : "bg-blue-500/10"}`}>
                        <DirectionIcon className={`h-4 w-4 ${t.direction === "inbound" ? "text-green-400" : "text-blue-400"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Radio className="h-3 w-3 text-white/40" />
                          <span className="text-sm font-medium text-white">{typeLabels[t.transactionType] || t.transactionType}</span>
                          <Badge variant="outline" className={`text-xs ${statusColors[t.status] || "bg-slate-500/20 text-slate-400"}`}>
                            {t.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-white/40">
                          Control: {t.controlNumber || "—"} · Sender: {t.senderId || "—"} · Receiver: {t.receiverId || "—"}
                          {t.shipmentId ? ` · Shipment #${t.shipmentId.slice(0, 8)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/30">{new Date(t.createdAt).toLocaleString()}</p>
                      {t.errorMessage && <p className="text-xs text-red-400 mt-1">{t.errorMessage}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
