import { FreightCollectionScreen, type FreightCollectionSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "ASSET REQUESTS",
  title: "Capacity orders",
  description: "Internal equipment, supplies, repair, and readiness requests attached to capacity assets.",
  metrics: [
    { label: "OPEN", value: "6", detail: "2 urgent", tone: "warning" },
    { label: "APPROVED", value: "4", detail: "$8.1k", tone: "success" },
    { label: "RECEIVED", value: "9", detail: "This month", tone: "brand" },
  ],
  segments: ["Open", "Approved", "Received"],
  records: [
    { id: "co-1", title: "CO-218 · Trailer DV-092", subtitle: "Door seal inspection and replacement", meta: "$420 estimate · Due Aug 23", status: "approved", tone: "success", icon: "tool", route: "/capacity/trailer-dv092" },
    { id: "co-2", title: "CO-221 · Driver supplies", subtitle: "Load bars, straps, seals, and PPE", meta: "$318 · Awaiting review", status: "review", tone: "warning", icon: "package", route: "/driver-toolbox" },
  ],
} satisfies FreightCollectionSpec;

export default function CapacityOrdersScreen() {
  return <FreightCollectionScreen spec={SPEC} />;
}
