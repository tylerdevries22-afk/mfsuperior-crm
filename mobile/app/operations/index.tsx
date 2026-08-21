import { FreightCollectionScreen, type FreightCollectionSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "ADMIN OPERATIONS",
  title: "Operations",
  description: "Customers, loads, drivers, revenue, agreements, integrations, and attention items.",
  metrics: [
    { label: "ACTIVE LOADS", value: "12", detail: "$31.6k revenue", tone: "brand" },
    { label: "ON TIME", value: "96%", detail: "+2.4%", tone: "success" },
    { label: "ATTENTION", value: "3", detail: "1 urgent", tone: "warning" },
  ],
  segments: ["Workspaces", "Attention", "Recent"],
  records: [
    { id: "op-1", title: "Shippers", subtitle: "18 customer companies · 9 open loads", meta: "4 priority accounts", icon: "briefcase", route: "/customers" },
    { id: "op-2", title: "Loads", subtitle: "Dispatch board and lifecycle records", meta: "12 active · 3 tenders", icon: "truck", route: "/loads" },
    { id: "op-3", title: "Drivers", subtitle: "Availability, duty clocks, and assignments", meta: "5 available · 4 on load", icon: "users", route: "/team" },
    { id: "op-4", title: "Quotes & invoices", subtitle: "Pricing, approvals, documents, and payments", meta: "$18.7k outstanding", icon: "file-text", route: "/quotes" },
    { id: "op-5", title: "Integration events", subtitle: "EDI and API processing audit", meta: "3 retrying · 1 failed", status: "attention", tone: "warning", icon: "activity", route: "/integration-events" },
  ],
} satisfies FreightCollectionSpec;

export default function OperationsScreen() {
  return <FreightCollectionScreen spec={SPEC} />;
}
