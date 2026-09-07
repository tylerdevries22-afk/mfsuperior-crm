import type { FreightCollectionSpec } from "@/route-support/freight";

const operationsMetrics = [
  { label: "ACTIVE", value: "12", detail: "Across 7 lanes", tone: "brand" },
  { label: "ON TIME", value: "96%", detail: "+2.4% this week", tone: "success" },
  { label: "ATTENTION", value: "3", detail: "1 urgent", tone: "warning" },
] as const;

export const LOADS_SPEC = {
  eyebrow: "DISPATCH CONTROL",
  title: "Loads",
  description: "Every tender, appointment, driver assignment, exception, and delivery milestone.",
  metrics: operationsMetrics,
  segments: ["Active", "Tenders", "Delivered"],
  records: [
    { id: "load-1", title: "MF-2048 · Aurora → Loveland", subtitle: "Front Range Grocery · Brenna Lewis", meta: "Delivery today · 2:00–3:00 PM", status: "in transit", tone: "success", icon: "truck", route: "/load/shp-1002" },
    { id: "load-2", title: "MF-2051 · Denver → Pueblo", subtitle: "Summit Retail Group · Driver unassigned", meta: "Pickup tomorrow · 7:30 AM", status: "tendered", tone: "warning", icon: "inbox", route: "/load/shp-1001" },
    { id: "load-3", title: "MF-2045 · Brighton → Golden", subtitle: "High Plains Foods · Reefer 36°F", meta: "Temperature exception under review", status: "exception", tone: "danger", icon: "alert-triangle", route: "/load/shp-1003" },
  ],
  primaryAction: { label: "New load", icon: "plus", route: "/loads/new" },
} satisfies FreightCollectionSpec;

export const DRIVERS_SPEC = {
  eyebrow: "TEAM OPERATIONS",
  title: "Drivers",
  description: "Availability, duty clocks, qualifications, assignments, and safety status for the field team.",
  metrics: [
    { label: "AVAILABLE", value: "5", detail: "2 in Denver", tone: "success" },
    { label: "ON LOAD", value: "4", detail: "All tracking", tone: "brand" },
    { label: "HOS ALERTS", value: "1", detail: "2h 14m remaining", tone: "warning" },
  ],
  segments: ["All", "Available", "On load"],
  records: [
    { id: "driver-1", title: "Brenna Lewis", subtitle: "In transit · MF-2048", meta: "6h 42m drive time remaining", status: "on duty", tone: "success", icon: "navigation", route: "/team/brenna-lewis" },
    { id: "driver-2", title: "Samuel Ortiz", subtitle: "Denver terminal · CDL A", meta: "Available now", status: "available", tone: "success", icon: "user-check", route: "/team/samuel-ortiz" },
    { id: "driver-3", title: "Maya Chen", subtitle: "Post-trip inspection", meta: "Shift ends in 1h 25m", status: "attention", tone: "warning", icon: "clock", route: "/team/maya-chen" },
  ],
  primaryAction: { label: "Invite driver", icon: "user-plus", route: "/team/invite" },
} satisfies FreightCollectionSpec;
