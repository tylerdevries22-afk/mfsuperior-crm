import type { FreightCollectionSpec } from "@/route-support/freight";

export const SHIPPERS_SPEC = {
  eyebrow: "CUSTOMER NETWORK",
  title: "Shippers",
  description: "Customer companies, contacts, service history, and freight activity in one account view.",
  metrics: [
    { label: "ACTIVE", value: "18", detail: "4 priority", tone: "success" },
    { label: "OPEN LOADS", value: "9", detail: "$42.8k value", tone: "brand" },
    { label: "REQUESTS", value: "4", detail: "2 new today", tone: "warning" },
  ],
  segments: ["Active", "Prospects", "All"],
  records: [
    { id: "shipper-1", title: "Front Range Grocery", subtitle: "Aurora, CO · 6 active shipments", meta: "Last contact 24 min ago", status: "priority", tone: "brand", icon: "briefcase", route: "/customers/front-range-grocery" },
    { id: "shipper-2", title: "Summit Retail Group", subtitle: "Denver, CO · 2 active shipments", meta: "Net 30 · API source", status: "active", tone: "success", icon: "shopping-bag", route: "/customers/summit-retail" },
    { id: "shipper-3", title: "High Plains Foods", subtitle: "Commerce City, CO · Reefer", meta: "EDI onboarding in review", status: "onboarding", tone: "warning", icon: "thermometer", route: "/customers/high-plains-foods" },
  ],
  primaryAction: { label: "Add shipper", icon: "plus", route: "/leads/new" },
} satisfies FreightCollectionSpec;

export const QUOTES_SPEC = {
  eyebrow: "REVENUE PIPELINE",
  title: "Quotes",
  description: "Lane pricing, accessorials, customer approvals, and conversion into assigned freight.",
  metrics: [
    { label: "OPEN", value: "7", detail: "$28.4k", tone: "brand" },
    { label: "WON", value: "68%", detail: "30-day rate", tone: "success" },
    { label: "EXPIRING", value: "2", detail: "Within 48 hours", tone: "warning" },
  ],
  segments: ["Open", "Accepted", "Expired"],
  records: [
    { id: "quote-1", title: "Q-1184 · Front Range Grocery", subtitle: "Aurora → Fort Collins · 26 pallets", meta: "$2,480 · Expires Aug 23", status: "sent", tone: "brand", icon: "file-text", route: "/quotes/q-1184" },
    { id: "quote-2", title: "Q-1182 · Summit Retail", subtitle: "Denver metro multi-stop · 6 drops", meta: "$3,920 · Accepted today", status: "accepted", tone: "success", icon: "check-circle", route: "/quotes/q-1182" },
    { id: "quote-3", title: "Q-1179 · High Plains Foods", subtitle: "Reefer · 36°F continuous", meta: "$1,860 · Follow-up due", status: "attention", tone: "warning", icon: "thermometer", route: "/quotes/q-1179" },
  ],
  primaryAction: { label: "New quote", icon: "plus", route: "/quotes/new" },
} satisfies FreightCollectionSpec;

export const PROSPECTS_SPEC = {
  eyebrow: "SALES PIPELINE",
  title: "Prospects",
  description: "Qualified freight opportunities, next actions, decision makers, and expected lane value.",
  metrics: [
    { label: "PIPELINE", value: "$92k", detail: "Monthly value", tone: "brand" },
    { label: "ACTIVE", value: "14", detail: "5 high intent", tone: "success" },
    { label: "FOLLOW-UPS", value: "4", detail: "Due today", tone: "warning" },
  ],
  segments: ["Priority", "Active", "Won"],
  records: [
    { id: "lead-1", title: "Rocky Mountain Produce", subtitle: "Weekly reefer lane · Denver → Casper", meta: "$18k/mo · Call at 2:30 PM", status: "qualified", tone: "success", icon: "target", route: "/leads/rocky-mountain-produce" },
    { id: "lead-2", title: "Mile High Fixtures", subtitle: "Final-mile store replenishment", meta: "$11k/mo · Rate requested", status: "proposal", tone: "brand", icon: "map-pin", route: "/leads/mile-high-fixtures" },
  ],
  primaryAction: { label: "Add prospect", icon: "plus", route: "/leads/new" },
} satisfies FreightCollectionSpec;

export const RATES_SPEC = {
  eyebrow: "PRICING LIBRARY",
  title: "Rates",
  description: "Reusable lane, equipment, fuel, and accessorial pricing for consistent freight quotes.",
  metrics: [
    { label: "LANES", value: "42", detail: "31 current", tone: "brand" },
    { label: "AVG RPM", value: "$2.84", detail: "+$0.11", tone: "success" },
    { label: "REVIEW", value: "6", detail: "Older than 30d", tone: "warning" },
  ],
  segments: ["Lane", "Equipment", "Accessorial"],
  records: [
    { id: "rate-1", title: "Denver → Fort Collins", subtitle: "Dry van · Same-day", meta: "$780 base · $2.96/mi", status: "current", tone: "success", icon: "map", route: "/rate-book/denver-fort-collins" },
    { id: "rate-2", title: "Reefer continuous", subtitle: "34–38°F · Fuel included", meta: "+$310 equipment premium", status: "current", tone: "success", icon: "thermometer", route: "/rate-book/reefer-continuous" },
    { id: "rate-3", title: "Driver assist unload", subtitle: "First 90 minutes", meta: "$185 · Review due", status: "review", tone: "warning", icon: "package", route: "/rate-book/driver-assist" },
  ],
} satisfies FreightCollectionSpec;

export const CONTRACTS_SPEC = {
  eyebrow: "CUSTOMER AGREEMENTS",
  title: "Contracts",
  description: "Service commitments, insurance requirements, contracted lanes, and renewal status.",
  metrics: [
    { label: "ACTIVE", value: "11", tone: "success" },
    { label: "RENEWALS", value: "2", detail: "Next 60 days", tone: "warning" },
    { label: "LANES", value: "27", tone: "brand" },
  ],
  segments: ["Active", "Renewal", "Archived"],
  records: [
    { id: "contract-1", title: "Front Range Grocery MSA", subtitle: "Local and regional dry van", meta: "Renews Dec 1 · 12 contracted lanes", status: "active", tone: "success", icon: "shield", route: "/service-programs/front-range-grocery" },
    { id: "contract-2", title: "High Plains Cold Chain", subtitle: "Temperature-controlled freight", meta: "Insurance update due Sep 15", status: "attention", tone: "warning", icon: "thermometer", route: "/service-programs/high-plains" },
  ],
} satisfies FreightCollectionSpec;
