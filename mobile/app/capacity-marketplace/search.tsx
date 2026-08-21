import { FreightMarketplaceSearchScreen, type MarketplaceSearchSpec } from "@/route-support/freight";

const SPEC = {
  title: "Search capacity",
  description: "Search provider-neutral capacity by lane, equipment, date, and verified readiness.",
  filters: ["All", "Dry van", "Reefer", "Team"],
  results: [
    { id: "c-1", title: "Denver → Salt Lake City", subtitle: "53′ dry van · pickup within 24h", meta: "$2.74/mi · Verified insurance", status: "available", tone: "success", icon: "truck", route: "/capacity-marketplace/capacity-detail" },
    { id: "c-2", title: "Aurora → Albuquerque", subtitle: "Reefer · 34–38°F continuous", meta: "$3.21/mi · Two units", status: "limited", tone: "warning", icon: "thermometer", route: "/capacity-marketplace/capacity-detail" },
    { id: "c-3", title: "Pueblo → Cheyenne", subtitle: "Team dry van · expedited", meta: "$3.08/mi · Ready tomorrow", status: "available", tone: "success", icon: "users", route: "/capacity-marketplace/capacity-detail" },
  ],
} satisfies MarketplaceSearchSpec;

export default function CapacityMarketplaceSearchScreen() {
  return <FreightMarketplaceSearchScreen spec={SPEC} />;
}
