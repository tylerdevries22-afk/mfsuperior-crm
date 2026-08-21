import { FreightMarketplaceSearchScreen, type MarketplaceSearchSpec } from "@/route-support/freight";

const SPEC = {
  title: "Search equipment",
  description: "Compare provider-neutral purchase, rental, and lease availability without implying a live partner connection.",
  filters: ["All", "Trailers", "Power", "Telematics"],
  results: [
    { id: "e-1", title: "2025 53′ dry van", subtitle: "Air ride · swing doors · 12-month lease", meta: "$1,280/mo · Denver", status: "available", tone: "success", icon: "box", route: "/equipment-marketplace/equipment-detail" },
    { id: "e-2", title: "Reefer with Carrier unit", subtitle: "Multi-temp · remote telemetry", meta: "$2,460/mo · Aurora", status: "2 left", tone: "warning", icon: "thermometer", route: "/equipment-marketplace/equipment-detail" },
    { id: "e-3", title: "Freightliner Cascadia day cab", subtitle: "2024 · 48,210 miles · full maintenance", meta: "$3,180/mo · Commerce City", status: "available", tone: "success", icon: "truck", route: "/equipment-marketplace/equipment-detail" },
  ],
} satisfies MarketplaceSearchSpec;

export default function EquipmentMarketplaceSearchScreen() {
  return <FreightMarketplaceSearchScreen spec={SPEC} />;
}
