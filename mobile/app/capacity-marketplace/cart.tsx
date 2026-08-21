import { FreightCartScreen, type FreightCartSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "CAPACITY SHORTLIST",
  title: "Shortlist",
  description: "Compare selected capacity before requesting a confirmed booking.",
  items: [
    { id: "cap-1", title: "Denver → Salt Lake City", subtitle: "53′ dry van · Pickup within 24h", meta: "$1,425 estimate", icon: "truck" },
    { id: "cap-2", title: "Aurora → Albuquerque", subtitle: "Reefer · 34–38°F continuous", meta: "$2,180 estimate", icon: "thermometer" },
  ],
  totalLabel: "ESTIMATED TOTAL",
  total: "$3,605",
  submitLabel: "Request booking review",
} satisfies FreightCartSpec;

export default function CapacityShortlistScreen() {
  return <FreightCartScreen spec={SPEC} />;
}
