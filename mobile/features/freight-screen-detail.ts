import type { FreightDetailSpec } from "@/route-support/freight";

export const SHIPPER_DETAIL_SPEC = {
  eyebrow: "SHIPPER ACCOUNT",
  title: "Front Range Grocery",
  subtitle: "Priority customer · Aurora, Colorado · Retail replenishment and regional distribution.",
  status: "active",
  statusTone: "success",
  metrics: [
    { label: "OPEN LOADS", value: "6", detail: "$18.4k" },
    { label: "ON-TIME", value: "98.2%", detail: "Last 90 days" },
    { label: "TERMS", value: "Net 30", detail: "ACH" },
    { label: "PRIMARY", value: "A. Foster", detail: "Logistics manager" },
  ],
  timeline: [
    { id: "tl-1", title: "Shipment MF-2048 in transit", subtitle: "Brenna Lewis departed Aurora crossdock.", meta: "Today · 10:42 AM", tone: "success" },
    { id: "tl-2", title: "Quote Q-1184 opened", subtitle: "Denver to Fort Collins dry-van lane.", meta: "Yesterday · 3:18 PM", tone: "brand" },
    { id: "tl-3", title: "POD accepted", subtitle: "Shipment MF-2039 documents verified.", meta: "Aug 19 · 4:04 PM", tone: "neutral" },
  ],
  actions: [
    { label: "New load", icon: "plus", route: "/loads/new" },
    { label: "Message", icon: "message-circle", route: "/messages" },
  ],
} satisfies FreightDetailSpec;

export const MARKETPLACE_DETAIL_SPEC = {
  eyebrow: "VERIFIED AVAILABILITY",
  title: "Denver → Salt Lake City",
  subtitle: "Provider-neutral 53′ dry-van capacity with validated insurance and operating authority.",
  status: "available",
  statusTone: "success",
  metrics: [
    { label: "RATE", value: "$2.74/mi", detail: "$1,425 estimate" },
    { label: "PICKUP", value: "Within 24h", detail: "2-hour window" },
    { label: "EQUIPMENT", value: "53′ DV", detail: "Swing doors" },
    { label: "RATING", value: "4.8", detail: "96 verified loads" },
  ],
  timeline: [
    { id: "m-1", title: "Availability confirmed", subtitle: "Unit capacity refreshed through onboarding-safe adapter.", meta: "12 minutes ago", tone: "success" },
    { id: "m-2", title: "Insurance validated", subtitle: "Cargo and liability policies are current.", meta: "Aug 20", tone: "success" },
    { id: "m-3", title: "Authority verified", subtitle: "Operating authority is active.", meta: "Aug 20", tone: "brand" },
  ],
  actions: [
    { label: "Add to shortlist", icon: "bookmark", route: "/capacity-marketplace/cart" },
    { label: "Ask a question", icon: "message-circle", route: "/messages" },
  ],
} satisfies FreightDetailSpec;
