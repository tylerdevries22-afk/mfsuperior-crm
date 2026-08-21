import { FreightMarketplaceSearchScreen, type MarketplaceSearchSpec } from "@/route-support/freight";

const SPEC = {
  title: "Search capacity registry",
  description: "Find MF-owned or assigned assets by unit, VIN, class, driver, readiness, or location.",
  filters: ["All", "Ready", "Assigned", "Attention"],
  results: [
    { id: "a-1", title: "Tractor 104", subtitle: "2024 Freightliner Cascadia · Brenna Lewis", meta: "I-25 N near Erie · 48,210 mi", status: "assigned", tone: "success", icon: "truck", route: "/capacity/tractor-104" },
    { id: "a-2", title: "Trailer R-218", subtitle: "53′ reefer · Carrier unit online", meta: "36°F · Fuel 72% · Aurora", status: "ready", tone: "success", icon: "thermometer", route: "/capacity/trailer-r218" },
    { id: "a-3", title: "Trailer DV-092", subtitle: "53′ dry van · door seal inspection", meta: "Denver terminal · Due Aug 23", status: "attention", tone: "warning", icon: "tool", route: "/capacity/trailer-dv092" },
  ],
} satisfies MarketplaceSearchSpec;

export default function CapacityRegistrySearchScreen() {
  return <FreightMarketplaceSearchScreen spec={SPEC} />;
}
