import type { AppRole } from "@/domain/types";

export type FeatureSlug =
  | "customers"
  | "drivers"
  | "quotes"
  | "invoices"
  | "payments"
  | "prospects"
  | "rate-cards"
  | "contracts"
  | "tags"
  | "edi-events"
  | "equipment-models"
  | "operating-documents"
  | "driver-gear"
  | "fleet-parts"
  | "maintenance-vendor"
  | "tire-service"
  | "fuel-roadside"
  | "parts-orders"
  | "asset-scan"
  | "stock-transfers"
  | "truck-inventory"
  | "fleet-cost-analytics"
  | "exception-triage"
  | "incident-history"
  | "gps-tracker"
  | "hours-of-service";

export interface FeatureItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly meta?: string;
  readonly tone?: "neutral" | "info" | "success" | "warning" | "danger";
}

export interface FeatureDefinition {
  readonly slug: FeatureSlug;
  readonly title: string;
  readonly subtitle: string;
  readonly eyebrow: string;
  readonly roles: readonly AppRole[];
  readonly simulationNotice?: string;
  readonly items: readonly FeatureItem[];
}

const internalRoles = ["driver", "dispatcher"] as const;
const dispatcherOnly = ["dispatcher"] as const;

export const FEATURE_DEFINITIONS: Readonly<Record<FeatureSlug, FeatureDefinition>> = {
  customers: {
    slug: "customers",
    title: "Shippers & receivers",
    subtitle: "Accounts, receiving contacts, locations, and delivery preferences.",
    eyebrow: "OPERATIONS CRM",
    roles: dispatcherOnly,
    items: [
      { id: "front-range", title: "Front Range Market", subtitle: "Aurora, CO · 4 receiving locations", meta: "12 active loads", tone: "success" },
      { id: "mile-high", title: "Mile High Foods", subtitle: "Denver, CO · Refrigerated", meta: "3 active loads", tone: "info" },
      { id: "foothills", title: "Foothills Hospitality", subtitle: "Boulder, CO · Appointment required", meta: "Quote requested", tone: "warning" },
    ],
  },
  drivers: {
    slug: "drivers",
    title: "Drivers",
    subtitle: "Duty state, current assignment, and last reported location.",
    eyebrow: "TEAM",
    roles: dispatcherOnly,
    items: [
      { id: "marcus", title: "Marcus Reed", subtitle: "Unit 214 · Driving", meta: "TGT-28471", tone: "success" },
      { id: "dana", title: "Dana Whitfield", subtitle: "Unit 118 · Available", meta: "Denver yard", tone: "info" },
      { id: "lena", title: "Lena Ortiz", subtitle: "Unit 309 · Off duty", meta: "10h reset", tone: "neutral" },
    ],
  },
  quotes: {
    slug: "quotes",
    title: "Freight quotes",
    subtitle: "Open lane requests and pricing decisions.",
    eyebrow: "SALES",
    roles: dispatcherOnly,
    items: [
      { id: "q-1092", title: "Aurora → Colorado Springs", subtitle: "Reefer · 34,000 lb · Aug 24", meta: "$1,480 draft", tone: "warning" },
      { id: "q-1088", title: "Denver → Fort Collins", subtitle: "Dry van · 18 pallets", meta: "$980 sent", tone: "info" },
      { id: "q-1079", title: "Commerce City → Pueblo", subtitle: "Liftgate · 12 stops", meta: "$2,240 accepted", tone: "success" },
    ],
  },
  invoices: {
    slug: "invoices",
    title: "Invoices",
    subtitle: "Linehaul, fuel surcharge, accessorials, and payment status.",
    eyebrow: "FINANCE",
    roles: dispatcherOnly,
    items: [
      { id: "inv-8821", title: "INV-8821 · TGT-28396", subtitle: "Linehaul $1,250 · Fuel $184", meta: "$1,434 due", tone: "warning" },
      { id: "inv-8812", title: "INV-8812 · FRM-1842", subtitle: "Delivered Aug 17", meta: "$2,108 paid", tone: "success" },
      { id: "inv-8809", title: "INV-8809 · MHF-993", subtitle: "Detention documentation attached", meta: "$1,760 review", tone: "info" },
    ],
  },
  payments: {
    slug: "payments",
    title: "Settlements",
    subtitle: "Customer receipts and driver settlement activity.",
    eyebrow: "FINANCE",
    roles: dispatcherOnly,
    items: [
      { id: "pay-448", title: "$2,108 received", subtitle: "Front Range Market · ACH", meta: "Aug 20", tone: "success" },
      { id: "pay-447", title: "$684 driver settlement", subtitle: "Marcus Reed · Week 34", meta: "Scheduled", tone: "info" },
      { id: "pay-446", title: "$1,434 receivable", subtitle: "Target partner account · Simulation", meta: "Net 30", tone: "warning" },
    ],
  },
  prospects: {
    slug: "prospects",
    title: "Carrier prospects",
    subtitle: "Qualified shippers and partnership outreach from the CRM.",
    eyebrow: "PIPELINE",
    roles: dispatcherOnly,
    items: [
      { id: "lead-1", title: "Mile High Meats", subtitle: "Denver · Refrigerated · Tier A", meta: "Replied", tone: "success" },
      { id: "lead-2", title: "Rocky Mountain Commissary", subtitle: "Commerce City · Tier B", meta: "Follow-up due", tone: "warning" },
      { id: "lead-3", title: "Flatiron Freight Brokers", subtitle: "Boulder · 3PL · Tier B", meta: "Contacted", tone: "info" },
    ],
  },
  "rate-cards": {
    slug: "rate-cards",
    title: "Rate cards",
    subtitle: "Reusable lane, equipment, fuel, and accessorial pricing.",
    eyebrow: "PRICEBOOK",
    roles: dispatcherOnly,
    items: [
      { id: "rate-den", title: "Denver metro base", subtitle: "$485 minimum · 60 included miles", meta: "Active", tone: "success" },
      { id: "rate-reefer", title: "Reefer premium", subtitle: "$0.42/mile · temperature log included", meta: "Active", tone: "success" },
      { id: "rate-det", title: "Detention", subtitle: "$85/hour after 2 free hours", meta: "Contract varies", tone: "info" },
    ],
  },
  contracts: {
    slug: "contracts",
    title: "Customer contracts",
    subtitle: "Service levels, lanes, insurance, and renewal dates.",
    eyebrow: "AGREEMENTS",
    roles: dispatcherOnly,
    items: [
      { id: "contract-1", title: "Front Range Market", subtitle: "Dedicated Denver metro · 98% on-time SLA", meta: "Renews Nov 1", tone: "success" },
      { id: "contract-2", title: "Target partner workflow", subtitle: "Prototype operating requirements", meta: "Not connected", tone: "warning" },
      { id: "contract-3", title: "Mile High Foods", subtitle: "Reefer overflow agreement", meta: "Review due", tone: "info" },
    ],
  },
  tags: {
    slug: "tags",
    title: "Operational tags",
    subtitle: "Reusable labels for loads, customers, exceptions, and equipment.",
    eyebrow: "CONFIGURATION",
    roles: dispatcherOnly,
    items: [
      { id: "tag-cold", title: "Cold chain", subtitle: "24 loads · temperature control required", tone: "info" },
      { id: "tag-appt", title: "Appointment only", subtitle: "18 receiving locations", tone: "warning" },
      { id: "tag-priority", title: "Priority account", subtitle: "6 customers", tone: "success" },
    ],
  },
  "edi-events": {
    slug: "edi-events",
    title: "Integration events",
    subtitle: "Inbound and outbound transport messages across connected accounts.",
    eyebrow: "WEBHOOKS",
    roles: dispatcherOnly,
    simulationNotice: "Target transactions in this prototype are simulated and never leave the device.",
    items: [
      { id: "edi-204", title: "204 · Load tender", subtitle: "TGT-28471 · Received 07:42", meta: "Simulated", tone: "info" },
      { id: "edi-990", title: "990 · Tender response", subtitle: "TGT-28471 · Accepted 07:46", meta: "Simulated", tone: "success" },
      { id: "edi-214", title: "214 · Shipment status", subtitle: "Arrived pickup · 08:02", meta: "Simulated", tone: "success" },
    ],
  },
  "equipment-models": {
    slug: "equipment-models",
    title: "Equipment models",
    subtitle: "Tractors, trailers, refrigeration units, and liftgates.",
    eyebrow: "EQUIPMENT",
    roles: internalRoles,
    items: [
      { id: "unit-214", title: "Unit 214 · Freightliner Cascadia", subtitle: "VIN ending 4821 · 286,440 mi", meta: "In service", tone: "success" },
      { id: "trailer-509", title: "Trailer 509 · Utility 3000R", subtitle: "53 ft reefer · Thermo King S-700", meta: "Assigned", tone: "info" },
      { id: "trailer-418", title: "Trailer 418 · Great Dane", subtitle: "53 ft dry van", meta: "Inspection due", tone: "warning" },
    ],
  },
  "operating-documents": {
    slug: "operating-documents",
    title: "Operating documents",
    subtitle: "Equipment guides, permits, insurance, and account procedures.",
    eyebrow: "DOCUMENT LIBRARY",
    roles: internalRoles,
    items: [
      { id: "doc-1", title: "Target partner delivery checklist", subtitle: "Prototype account procedure · 8 pages", meta: "Updated Aug 18", tone: "info" },
      { id: "doc-2", title: "Thermo King S-700 quick guide", subtitle: "Temperature setpoint and alarm response", meta: "PDF", tone: "neutral" },
      { id: "doc-3", title: "MF Superior insurance certificate", subtitle: "Cargo and general liability", meta: "Expires Mar 2027", tone: "success" },
    ],
  },
  "driver-gear": {
    slug: "driver-gear",
    title: "Driver equipment",
    subtitle: "Safety, securement, paperwork, and cab supplies.",
    eyebrow: "TOOLS & SUPPLIES",
    roles: internalRoles,
    items: [
      { id: "gear-1", title: "Load securement kit", subtitle: "12 straps · 4 load bars · edge protectors", meta: "Complete", tone: "success" },
      { id: "gear-2", title: "PPE kit", subtitle: "Vest, glasses, gloves, hard hat", meta: "Gloves low", tone: "warning" },
      { id: "gear-3", title: "Delivery documents", subtitle: "BOL envelopes · seal log · inspection forms", meta: "14 remaining", tone: "info" },
    ],
  },
  "fleet-parts": {
    slug: "fleet-parts",
    title: "Fleet parts",
    subtitle: "Search stocked and approved maintenance parts.",
    eyebrow: "PARTS CATALOG",
    roles: internalRoles,
    items: [
      { id: "part-1", title: "Air dryer cartridge", subtitle: "Bendix AD-9 equivalent · 3 in stock", meta: "$84.50", tone: "success" },
      { id: "part-2", title: "Trailer marker lamp", subtitle: "2.5 in LED red · 12 in stock", meta: "$9.20", tone: "success" },
      { id: "part-3", title: "Reefer door seal", subtitle: "Utility 3000R · special order", meta: "4 days", tone: "warning" },
    ],
  },
  "maintenance-vendor": {
    slug: "maintenance-vendor",
    title: "Maintenance parts vendor",
    subtitle: "Approved replacement parts and order history.",
    eyebrow: "VENDOR PORTAL",
    roles: dispatcherOnly,
    simulationNotice: "Catalog and ordering are local prototype interactions.",
    items: [
      { id: "mv-1", title: "Open purchase order PO-1842", subtitle: "Brake chamber and fittings", meta: "$386.40", tone: "info" },
      { id: "mv-2", title: "Recent order PO-1831", subtitle: "Trailer lamps and wiring", meta: "Delivered", tone: "success" },
      { id: "mv-3", title: "Core return RMA-448", subtitle: "Alternator · label generated", meta: "Due Aug 26", tone: "warning" },
    ],
  },
  "tire-service": {
    slug: "tire-service",
    title: "Tire & service network",
    subtitle: "Road service locations, tire inventory, and work orders.",
    eyebrow: "SERVICE NETWORK",
    roles: internalRoles,
    simulationNotice: "Provider availability is simulated for the prototype.",
    items: [
      { id: "ts-1", title: "Commerce City service center", subtitle: "8.4 mi · Open · Tractor and trailer", meta: "42 min", tone: "success" },
      { id: "ts-2", title: "Mobile tire service", subtitle: "I-70 corridor · 24 hours", meta: "68 min", tone: "info" },
      { id: "ts-3", title: "Unit 214 tire inspection", subtitle: "Right steer at 7/32 in", meta: "Monitor", tone: "warning" },
    ],
  },
  "fuel-roadside": {
    slug: "fuel-roadside",
    title: "Fuel & roadside",
    subtitle: "Preferred fuel stops and roadside-assistance requests.",
    eyebrow: "DRIVER SERVICES",
    roles: internalRoles,
    simulationNotice: "Fuel prices and service availability are seeded demo data.",
    items: [
      { id: "fuel-1", title: "Preferred stop · Aurora", subtitle: "Diesel $3.42 · DEF available", meta: "11 mi", tone: "success" },
      { id: "fuel-2", title: "Preferred stop · Limon", subtitle: "Diesel $3.51 · truck parking", meta: "72 mi", tone: "info" },
      { id: "road-1", title: "Roadside request", subtitle: "No active request for Unit 214", meta: "Ready", tone: "neutral" },
    ],
  },
  "parts-orders": {
    slug: "parts-orders",
    title: "Fleet orders",
    subtitle: "Purchase orders, receiving, and returns.",
    eyebrow: "INVENTORY",
    roles: dispatcherOnly,
    items: [
      { id: "po-1842", title: "PO-1842", subtitle: "Brake chamber and fittings · 4 items", meta: "In transit", tone: "info" },
      { id: "po-1839", title: "PO-1839", subtitle: "PPE replenishment · 18 items", meta: "Ready to receive", tone: "success" },
      { id: "po-1837", title: "PO-1837", subtitle: "Reefer consumables · 7 items", meta: "Approval needed", tone: "warning" },
    ],
  },
  "asset-scan": {
    slug: "asset-scan",
    title: "Scan asset or document",
    subtitle: "Capture trailer tags, seals, BOLs, and equipment labels.",
    eyebrow: "SCANNER",
    roles: internalRoles,
    simulationNotice: "The prototype demonstrates scan outcomes without uploading an image.",
    items: [
      { id: "scan-seal", title: "Trailer seal", subtitle: "Recognize and attach a seal number to the active load", meta: "Ready", tone: "info" },
      { id: "scan-bol", title: "Bill of lading", subtitle: "Capture document number and shipment references", meta: "Ready", tone: "info" },
      { id: "scan-asset", title: "Equipment tag", subtitle: "Open the matching tractor or trailer record", meta: "Ready", tone: "info" },
    ],
  },
  "stock-transfers": {
    slug: "stock-transfers",
    title: "Asset transfers",
    subtitle: "Move parts, gear, and equipment between yard and trucks.",
    eyebrow: "INVENTORY",
    roles: internalRoles,
    items: [
      { id: "transfer-1", title: "Yard → Unit 214", subtitle: "2 load bars · seal envelopes", meta: "Pending receipt", tone: "warning" },
      { id: "transfer-2", title: "Unit 118 → Yard", subtitle: "Spare reefer sensor", meta: "Completed", tone: "success" },
      { id: "transfer-3", title: "Yard → Trailer 509", subtitle: "Pallet jack inspection tag", meta: "Scheduled", tone: "info" },
    ],
  },
  "truck-inventory": {
    slug: "truck-inventory",
    title: "My truck",
    subtitle: "Equipment assigned to Unit 214.",
    eyebrow: "MOBILE INVENTORY",
    roles: internalRoles,
    items: [
      { id: "truck-1", title: "Safety & PPE", subtitle: "8 required items", meta: "Complete", tone: "success" },
      { id: "truck-2", title: "Load securement", subtitle: "18 tracked items", meta: "1 due inspection", tone: "warning" },
      { id: "truck-3", title: "Paperwork & seals", subtitle: "14 seal packs · 22 BOL envelopes", meta: "Stocked", tone: "success" },
    ],
  },
  "fleet-cost-analytics": {
    slug: "fleet-cost-analytics",
    title: "Fleet cost analytics",
    subtitle: "Maintenance, parts, tires, and cost per mile.",
    eyebrow: "ANALYTICS",
    roles: dispatcherOnly,
    items: [
      { id: "cost-1", title: "$0.19 maintenance / mile", subtitle: "Rolling 30 days · down 4%", meta: "On target", tone: "success" },
      { id: "cost-2", title: "$4,820 open work orders", subtitle: "3 tractors · 2 trailers", meta: "Review", tone: "warning" },
      { id: "cost-3", title: "Unit 309 highest variance", subtitle: "$0.27/mile · cooling system", meta: "+18%", tone: "danger" },
    ],
  },
  "exception-triage": {
    slug: "exception-triage",
    title: "Exception triage",
    subtitle: "Guided response for delays, shortages, damage, temperature, and equipment issues.",
    eyebrow: "OPERATIONS ASSISTANT",
    roles: internalRoles,
    items: [
      { id: "triage-delay", title: "Delay or missed appointment", subtitle: "Document cause, ETA, and receiver notification", meta: "Start", tone: "warning" },
      { id: "triage-temp", title: "Temperature variance", subtitle: "Capture setpoint, return air, alarm, and corrective action", meta: "Start", tone: "danger" },
      { id: "triage-damage", title: "Damage or shortage", subtitle: "Record count, condition, photos, and disposition", meta: "Start", tone: "warning" },
    ],
  },
  "incident-history": {
    slug: "incident-history",
    title: "Incident history",
    subtitle: "Resolved shipment exceptions and operating notes.",
    eyebrow: "HISTORY",
    roles: internalRoles,
    items: [
      { id: "incident-1", title: "TGT-28396 · Detention", subtitle: "Receiver delay · 84 minutes", meta: "Resolved", tone: "success" },
      { id: "incident-2", title: "MHF-993 · Temperature alarm", subtitle: "Door open alarm · product unaffected", meta: "Resolved", tone: "success" },
      { id: "incident-3", title: "FRM-1820 · Shortage", subtitle: "1 case refused and documented", meta: "Claim review", tone: "warning" },
    ],
  },
  "gps-tracker": {
    slug: "gps-tracker",
    title: "Route tracking",
    subtitle: "Simulated movement, ETA, and geofence activity for the active load.",
    eyebrow: "LOCATION",
    roles: internalRoles,
    simulationNotice: "No device location is collected or transmitted. Movement is generated locally.",
    items: [
      { id: "gps-1", title: "Unit 214", subtitle: "I-70 E near Havana St · 52 mph", meta: "Simulated live", tone: "success" },
      { id: "gps-2", title: "Next geofence", subtitle: "Target Store 0284 receiving · 8.6 mi", meta: "ETA 16 min", tone: "info" },
      { id: "gps-3", title: "Last event", subtitle: "Departed pickup geofence", meta: "10:18 AM", tone: "neutral" },
    ],
  },
  "hours-of-service": {
    slug: "hours-of-service",
    title: "Hours of service",
    subtitle: "Duty state and available driving, shift, and cycle clocks.",
    eyebrow: "COMPLIANCE",
    roles: internalRoles,
    simulationNotice: "This prototype is not an electronic logging device and is not for compliance use.",
    items: [
      { id: "hos-drive", title: "Driving", subtitle: "7h 42m available", meta: "11-hour clock", tone: "success" },
      { id: "hos-shift", title: "Shift", subtitle: "10h 18m available", meta: "14-hour clock", tone: "success" },
      { id: "hos-break", title: "Break", subtitle: "Required in 5h 06m", meta: "30 minutes", tone: "info" },
    ],
  },
};

/** Return a freight feature only when the slug is part of the supported route catalog. */
export function getFeatureDefinition(slug: string): FeatureDefinition | null {
  return Object.prototype.hasOwnProperty.call(FEATURE_DEFINITIONS, slug)
    ? FEATURE_DEFINITIONS[slug as FeatureSlug]
    : null;
}

/** Check whether a role is permitted to open a freight feature. */
export function canRoleOpenFeature(role: AppRole, feature: FeatureDefinition): boolean {
  return feature.roles.includes(role);
}
