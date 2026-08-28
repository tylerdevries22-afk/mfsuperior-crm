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
  segments: ["Readiness", "On the road", "Delivery"],
  records: [
    { id: "tool-1", segment: "Readiness", title: "Hours of service", subtitle: "Check duty clock, breaks, and remaining drive time", meta: "6h 42m drive · 8h 11m shift", status: "current", tone: "success", icon: "clock", route: "/hours-of-service" },
    { id: "tool-vest", segment: "Readiness", title: "Safety vest", subtitle: "Wear at all times at the shipment center", meta: "Required PPE before entering the yard", status: "required", tone: "warning", icon: "shield" },
    { id: "tool-3", segment: "Readiness", title: "Safety equipment", subtitle: "PPE, triangles, extinguisher, and flashlight", meta: "Inspection passed today", status: "ready", tone: "success", icon: "check-circle" },
    { id: "tool-2", segment: "On the road", title: "Cargo securement kit", subtitle: "Straps, load bars, edge protectors, and seals", meta: "2 straps and seals low", status: "attention", tone: "warning", icon: "anchor", route: "/messages" },
    { id: "tool-location", segment: "On the road", title: "Location tracker", subtitle: "Share live progress with dispatch", meta: "Location services active", status: "live", tone: "success", icon: "map-pin", route: "/location-tracker" },
    { id: "tool-4", segment: "Delivery", title: "Proof of delivery", subtitle: "Photo, signature, receiver, and document checklist", meta: "Opens for active load", icon: "check-square", route: "/proof-of-delivery/shp-1002" },
    { id: "tool-issue", segment: "Delivery", title: "Report an issue", subtitle: "Start guided exception diagnosis", meta: "Dispatch is notified immediately", icon: "alert-triangle", route: "/exception-diagnostic" },
  ],
} satisfies FreightCollectionSpec;

export default function DriverToolboxScreen() {
  return <FreightCollectionScreen spec={SPEC} />;
}
