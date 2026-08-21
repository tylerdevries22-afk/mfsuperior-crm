import { FreightCollectionScreen, type FreightCollectionSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "FIELD READINESS",
  title: "Driver toolbox",
  description: "Safety equipment, cargo securement, documents, duty tools, and commonly used field workflows.",
  metrics: [
    { label: "READINESS", value: "92%", detail: "2 attention", tone: "success" },
    { label: "HOS", value: "6h 42m", detail: "Drive time", tone: "brand" },
    { label: "SUPPLIES", value: "2 low", detail: "Seals · straps", tone: "warning" },
  ],
  segments: ["Tools", "Supplies", "Safety"],
  records: [
    { id: "tool-1", title: "Hours of service", subtitle: "Duty clock, breaks, and remaining drive time", meta: "6h 42m drive · 8h 11m shift", status: "current", tone: "success", icon: "clock", route: "/hours-of-service" },
    { id: "tool-2", title: "Cargo securement kit", subtitle: "Straps, load bars, edge protectors, and seals", meta: "2 straps and seals low", status: "attention", tone: "warning", icon: "anchor", route: "/capacity/orders" },
    { id: "tool-3", title: "Safety equipment", subtitle: "PPE, triangles, extinguisher, flashlight", meta: "Inspection passed today", status: "ready", tone: "success", icon: "shield" },
    { id: "tool-4", title: "Proof of delivery", subtitle: "Photo, signature, receiver, and document checklist", meta: "Opens for active load", icon: "check-square", route: "/proof-of-delivery/shp-1002" },
  ],
} satisfies FreightCollectionSpec;

export default function DriverToolboxScreen() {
  return <FreightCollectionScreen spec={SPEC} />;
}
