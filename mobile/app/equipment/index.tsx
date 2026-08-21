import { FreightCollectionScreen, type FreightCollectionSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "EQUIPMENT REFERENCE",
  title: "Equipment models",
  description: "Tractor, trailer, reefer, and telematics model guidance for capacity and fault triage.",
  segments: ["All", "Power", "Trailers"],
  records: [
    { id: "m-1", title: "Freightliner Cascadia", subtitle: "2024–2026 · Detroit powertrain", meta: "3 fleet units", status: "supported", tone: "success", icon: "truck", route: "/equipment/freightliner-cascadia" },
    { id: "m-2", title: "53′ dry van", subtitle: "Plate and sheet-and-post references", meta: "8 fleet units", status: "supported", tone: "success", icon: "box", route: "/equipment/53-dry-van" },
    { id: "m-3", title: "Carrier X4 reefer", subtitle: "Temperature control and fault reference", meta: "3 fleet units", status: "supported", tone: "success", icon: "thermometer", route: "/equipment/carrier-x4" },
  ],
} satisfies FreightCollectionSpec;

export default function EquipmentModelsScreen() {
  return <FreightCollectionScreen spec={SPEC} />;
}
