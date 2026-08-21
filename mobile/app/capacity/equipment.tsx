import { FreightCollectionScreen, type FreightCollectionSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "ASSIGNED UNIT",
  title: "My equipment",
  description: "The driver's assigned power unit, trailer, safety supplies, documents, and readiness checks.",
  metrics: [
    { label: "POWER", value: "104", detail: "Ready", tone: "success" },
    { label: "TRAILER", value: "R-218", detail: "36°F", tone: "brand" },
    { label: "SUPPLIES", value: "92%", detail: "2 low", tone: "warning" },
  ],
  segments: ["Assigned", "Supplies", "Documents"],
  records: [
    { id: "my-1", title: "Tractor 104", subtitle: "Freightliner Cascadia · Inspection passed", meta: "Fuel 68% · 48,210 mi", status: "ready", tone: "success", icon: "truck", route: "/capacity/tractor-104" },
    { id: "my-2", title: "Trailer R-218", subtitle: "53′ reefer · Setpoint 36°F", meta: "Carrier fuel 72% · Seal 018442", status: "ready", tone: "success", icon: "thermometer", route: "/capacity/trailer-r218" },
    { id: "my-3", title: "Safety & securement kit", subtitle: "PPE, triangles, extinguisher, straps", meta: "Load seals low · 4 remaining", status: "attention", tone: "warning", icon: "shield", route: "/driver-toolbox" },
  ],
} satisfies FreightCollectionSpec;

export default function AssignedEquipmentScreen() {
  return <FreightCollectionScreen spec={SPEC} />;
}
