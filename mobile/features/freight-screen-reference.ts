import type { FreightCollectionSpec } from "@/route-support/freight";

export const TAGS_SPEC = {
  eyebrow: "RECORD ORGANIZATION",
  title: "Tags",
  description: "Shared operational labels used across customers, loads, assets, and exceptions.",
  segments: ["All", "Customers", "Loads"],
  records: [
    { id: "tag-1", title: "Priority customer", subtitle: "Applied to 4 shippers", meta: "Lime · Customer", status: "active", tone: "brand", icon: "tag" },
    { id: "tag-2", title: "Reefer critical", subtitle: "Applied to 7 loads", meta: "Red · Shipment", status: "active", tone: "danger", icon: "thermometer" },
    { id: "tag-3", title: "Appointment required", subtitle: "Applied to 18 facilities", meta: "Amber · Facility", status: "active", tone: "warning", icon: "clock" },
  ],
  primaryAction: { label: "New tag", icon: "plus" },
} satisfies FreightCollectionSpec;

export const INTEGRATION_EVENTS_SPEC = {
  eyebrow: "INTEGRATION AUDIT",
  title: "Integration events",
  description: "Redacted inbound and outbound partner activity with traceable processing state.",
  metrics: [
    { label: "PROCESSED", value: "248", detail: "Last 24 hours", tone: "success" },
    { label: "RETRYING", value: "3", detail: "Backoff active", tone: "warning" },
    { label: "FAILED", value: "1", detail: "Acknowledged", tone: "danger" },
  ],
  segments: ["All", "EDI", "API"],
  records: [
    { id: "event-1", title: "X12 214 status update", subtitle: "Outbound · MF-2048 · in transit", meta: "10:42 AM · Request e48a…", status: "processed", tone: "success", icon: "activity", route: "/integration-events/e48a" },
    { id: "event-2", title: "X12 997 acknowledgement", subtitle: "Inbound · Accepted with errors", meta: "10:31 AM · Redacted raw retained", status: "review", tone: "warning", icon: "git-merge", route: "/integration-events/a97c" },
    { id: "event-3", title: "Capacity availability sync", subtitle: "Outbound · Credentials not configured", meta: "9:58 AM · Circuit open", status: "blocked", tone: "danger", icon: "slash", route: "/integration-events/f21b" },
  ],
} satisfies FreightCollectionSpec;

export const KNOWLEDGE_SPEC = {
  eyebrow: "FREIGHT KNOWLEDGE",
  title: "Knowledge",
  description: "Operational playbooks, EDI guidance, equipment references, safety procedures, and customer requirements.",
  segments: ["Recommended", "Saved", "Recent"],
  records: [
    { id: "kb-1", title: "Handling a rejected 214", subtitle: "Validate shipment identity, status code, and event time before retrying.", meta: "EDI · 6 min read", icon: "git-pull-request", route: "/edi-codes/214" },
    { id: "kb-2", title: "Reefer temperature exception", subtitle: "Secure cargo, capture probe readings, and notify dispatch before opening doors.", meta: "Safety · 4 min read", icon: "thermometer", route: "/diagnostics/reefer" },
    { id: "kb-3", title: "Proof of delivery checklist", subtitle: "Required signature, printed name, timestamps, and image-quality standards.", meta: "Delivery · 3 min read", icon: "check-square", route: "/documents/pod-checklist" },
  ],
} satisfies FreightCollectionSpec;

export const EDI_CODES_SPEC = {
  eyebrow: "EDI & FAULT REFERENCE",
  title: "Codes",
  description: "Search transaction sets, acknowledgements, carrier status codes, and fleet diagnostic faults.",
  segments: ["EDI", "Vehicle", "Reefer"],
  records: [
    { id: "code-204", title: "X12 204", subtitle: "Motor Carrier Load Tender", meta: "Inbound · Versioned envelope", status: "supported", tone: "success", icon: "download", route: "/edi-codes/204" },
    { id: "code-214", title: "X12 214", subtitle: "Transportation Carrier Shipment Status", meta: "Outbound · Event driven", status: "supported", tone: "success", icon: "upload", route: "/edi-codes/214" },
    { id: "code-spn", title: "SPN 5246 / FMI 0", subtitle: "Aftertreatment SCR operator inducement", meta: "Vehicle fault · Severity high", status: "attention", tone: "danger", icon: "alert-octagon", route: "/edi-codes/spn-5246" },
  ],
} satisfies FreightCollectionSpec;
