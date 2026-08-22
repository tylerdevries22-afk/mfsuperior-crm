import type {
  FreightCollectionSpec,
  FreightDetailSpec,
  FreightFormSpec,
} from "@/route-support/freight";

const operationsMetrics = [
  { label: "ACTIVE", value: "12", detail: "Across 7 lanes", tone: "brand" },
  { label: "ON TIME", value: "96%", detail: "+2.4% this week", tone: "success" },
  { label: "ATTENTION", value: "3", detail: "1 urgent", tone: "warning" },
] as const;

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

export const INVOICES_SPEC = {
  eyebrow: "ACCOUNTS RECEIVABLE",
  title: "Invoices",
  description: "Freight charges, supporting documents, delivery proof, and customer payment status.",
  metrics: [
    { label: "OUTSTANDING", value: "$18.7k", detail: "9 invoices", tone: "brand" },
    { label: "OVERDUE", value: "$2.1k", detail: "1 invoice", tone: "danger" },
    { label: "PAID MTD", value: "$44.2k", detail: "+12%", tone: "success" },
  ],
  segments: ["Open", "Overdue", "Paid"],
  records: [
    { id: "inv-1", title: "INV-2841 · Front Range Grocery", subtitle: "MF-2042 · POD attached", meta: "$2,480 · Due Sep 12", status: "sent", tone: "brand", icon: "file", route: "/invoices/inv-2841" },
    { id: "inv-2", title: "INV-2828 · Alpine Supply", subtitle: "MF-2024 · Net 30", meta: "$2,110 · 4 days overdue", status: "overdue", tone: "danger", icon: "alert-circle", route: "/invoices/inv-2828" },
    { id: "inv-3", title: "INV-2836 · Summit Retail", subtitle: "MF-2038 · ACH", meta: "$3,920 · Paid Aug 20", status: "paid", tone: "success", icon: "check", route: "/invoices/inv-2836" },
  ],
} satisfies FreightCollectionSpec;

export const SETTLEMENTS_SPEC = {
  eyebrow: "DRIVER PAY",
  title: "Settlements",
  description: "Driver compensation, reimbursable expenses, deductions, and approved payout records.",
  metrics: [
    { label: "READY", value: "$8.4k", detail: "6 drivers", tone: "success" },
    { label: "REVIEW", value: "3", detail: "Expense receipts", tone: "warning" },
    { label: "PAID MTD", value: "$31.2k", tone: "brand" },
  ],
  segments: ["Ready", "Review", "Paid"],
  records: [
    { id: "set-1", title: "ST-0921 · Brenna Lewis", subtitle: "8 loads · 2,146 miles", meta: "$2,948.20 · Ready Friday", status: "approved", tone: "success", icon: "credit-card", route: "/payments/st-0921" },
    { id: "set-2", title: "ST-0922 · Samuel Ortiz", subtitle: "6 loads · 1 lumper receipt", meta: "$2,116.75 · Review required", status: "review", tone: "warning", icon: "paperclip", route: "/payments/st-0922" },
  ],
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

export const NEW_LOAD_FORM = {
  eyebrow: "DISPATCH WORKFLOW",
  title: "Create load",
  description: "Add the customer, lane, appointments, equipment requirements, and reference identifiers.",
  fields: [
    { key: "customer", label: "Shipper", placeholder: "Choose or enter a customer" },
    { key: "pickup", label: "Pickup", placeholder: "Facility, date, and appointment" },
    { key: "delivery", label: "Delivery", placeholder: "Facility, date, and appointment" },
    { key: "freight", label: "Freight details", placeholder: "Pieces, weight, commodity, requirements", multiline: true },
  ],
  submitLabel: "Create draft load",
  successMessage: "Draft load created. Assign a driver and validate appointments before dispatch.",
} satisfies FreightFormSpec;

export const NEW_PROSPECT_FORM = {
  eyebrow: "SALES WORKFLOW",
  title: "Add prospect",
  description: "Capture the company, lane opportunity, contact, and next action without losing context.",
  fields: [
    { key: "company", label: "Company", placeholder: "Business name" },
    { key: "contact", label: "Primary contact", placeholder: "Name, email, and phone" },
    { key: "opportunity", label: "Freight opportunity", placeholder: "Lane, cadence, equipment, expected value", multiline: true },
    { key: "next", label: "Next action", placeholder: "Follow-up and due date" },
  ],
  submitLabel: "Save prospect",
  successMessage: "Prospect saved to the active pipeline.",
} satisfies FreightFormSpec;

export const RETURN_FORM = {
  eyebrow: "EQUIPMENT RETURN",
  title: "Request return",
  description: "Identify the equipment, reason, condition, and preferred handoff window.",
  fields: [
    { key: "order", label: "Order or unit", placeholder: "Order number or asset ID" },
    { key: "reason", label: "Return reason", placeholder: "Select or describe the reason" },
    { key: "condition", label: "Current condition", placeholder: "Damage, wear, accessories, photos", multiline: true },
    { key: "window", label: "Handoff window", placeholder: "Date and available time" },
  ],
  submitLabel: "Submit return request",
  successMessage: "Return request recorded. No provider action occurs until an admin confirms the handoff.",
} satisfies FreightFormSpec;

export const CLAIM_FORM = {
  eyebrow: "CAPACITY CLAIM",
  title: "Open claim",
  description: "Record the affected booking, loss type, evidence, and requested resolution.",
  fields: [
    { key: "booking", label: "Booking", placeholder: "Booking reference" },
    { key: "loss", label: "Loss type", placeholder: "Cargo, delay, equipment, or billing" },
    { key: "details", label: "Claim details", placeholder: "Describe the facts and requested resolution", multiline: true },
    { key: "evidence", label: "Evidence", placeholder: "Reference attached photos and documents" },
  ],
  submitLabel: "Save claim draft",
  successMessage: "Claim draft saved. An admin must review evidence before external submission.",
} satisfies FreightFormSpec;
