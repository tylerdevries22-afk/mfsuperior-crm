import type { FreightDetailSpec } from "@/route-support/freight";

export type FreightDetailFamily = "driver" | "quote" | "invoice" | "lead" | "payment" | "rate" | "program" | "event" | "supplier" | "code" | "equipment" | "session";

const FAMILY_COPY: Readonly<Record<FreightDetailFamily, { readonly eyebrow: string; readonly title: string; readonly subtitle: string; readonly status: string }>> = {
  driver: { eyebrow: "DRIVER PROFILE", title: "Brenna Lewis", subtitle: "CDL A · Regional driver · Assigned power unit 104.", status: "on duty" },
  quote: { eyebrow: "FREIGHT QUOTE", title: "Q-1184", subtitle: "Front Range Grocery · Aurora to Fort Collins dry-van lane.", status: "sent" },
  invoice: { eyebrow: "CUSTOMER INVOICE", title: "INV-2841", subtitle: "Front Range Grocery · Shipment MF-2042 · POD attached.", status: "open" },
  lead: { eyebrow: "PROSPECT", title: "Rocky Mountain Produce", subtitle: "Weekly reefer lane · Denver to Casper · Estimated $18k monthly.", status: "qualified" },
  payment: { eyebrow: "DRIVER SETTLEMENT", title: "ST-0921", subtitle: "Brenna Lewis · Eight completed loads · 2,146 dispatched miles.", status: "approved" },
  rate: { eyebrow: "RATE DETAIL", title: "Denver → Fort Collins", subtitle: "Dry van · Same-day service · Includes base fuel assumption.", status: "current" },
  program: { eyebrow: "SERVICE PROGRAM", title: "Front Range Grocery MSA", subtitle: "Local and regional dry-van agreement with twelve contracted lanes.", status: "active" },
  event: { eyebrow: "INTEGRATION EVENT", title: "X12 214 status update", subtitle: "Outbound shipment-status transaction for MF-2048. Sensitive payload fields are redacted.", status: "processed" },
  supplier: { eyebrow: "SUPPLIER PROFILE", title: "Front Range Trailer Services", subtitle: "Provider-neutral trailer rental, inspection, and mobile repair.", status: "verified" },
  code: { eyebrow: "CODE REFERENCE", title: "X12 214", subtitle: "Transportation Carrier Shipment Status Message with bounded, validated segments.", status: "supported" },
  equipment: { eyebrow: "EQUIPMENT MODEL", title: "53′ dry van", subtitle: "Reference specifications, operating constraints, and compatible capacity assets.", status: "supported" },
  session: { eyebrow: "TRIAGE SESSION", title: "Reefer temperature exception", subtitle: "Shipment MF-2045 · Trailer R-218 · Guided operational and equipment triage.", status: "in review" },
};

/** Build deterministic fixture detail while preserving each route family's identity. */
export function createFreightDetailSpec(family: FreightDetailFamily, requestedId?: string): FreightDetailSpec {
  const copy = FAMILY_COPY[family];
  const reference = requestedId?.trim() ? requestedId.replaceAll("-", " ") : copy.title;
  return {
    ...copy,
    title: family === "driver" || family === "lead" || family === "program" || family === "supplier" ? titleCase(reference) : reference.toUpperCase(),
    statusTone: copy.status === "in review" ? "warning" : "success",
    metrics: metricsFor(family),
    timeline: timelineFor(family),
    actions: actionsFor(family),
  };
}

function metricsFor(family: FreightDetailFamily): FreightDetailSpec["metrics"] {
  if (family === "driver") return [{ label: "DRIVE LEFT", value: "6h 42m" }, { label: "SHIFT LEFT", value: "8h 11m" }, { label: "ON TIME", value: "98%" }, { label: "UNIT", value: "104" }];
  if (family === "quote" || family === "invoice" || family === "payment" || family === "rate") return [{ label: "AMOUNT", value: "$2,480" }, { label: "MARGIN", value: "18.4%" }, { label: "CREATED", value: "Aug 20" }, { label: "OWNER", value: "Tyler" }];
  if (family === "event" || family === "code") return [{ label: "TYPE", value: family === "event" ? "Outbound" : "X12" }, { label: "VERSION", value: "005010" }, { label: "RETRIES", value: "0" }, { label: "RETENTION", value: "90 days" }];
  return [{ label: "OPEN LOADS", value: "4" }, { label: "ON TIME", value: "97%" }, { label: "UPDATED", value: "Today" }, { label: "OWNER", value: "Operations" }];
}

function timelineFor(family: FreightDetailFamily): FreightDetailSpec["timeline"] {
  return [
    { id: `${family}-1`, title: "Latest status verified", subtitle: "The normalized record and ownership scope passed validation.", meta: "Today · 10:42 AM", tone: "success" },
    { id: `${family}-2`, title: "Operational review completed", subtitle: "Required context and supporting records were checked.", meta: "Today · 9:18 AM", tone: "brand" },
    { id: `${family}-3`, title: "Record created", subtitle: "Audit context and originating source were retained.", meta: "Aug 20 · 4:06 PM", tone: "neutral" },
  ];
}

function actionsFor(family: FreightDetailFamily): FreightDetailSpec["actions"] {
  if (family === "session") return [{ label: "Continue triage", icon: "activity", route: "/exception-diagnostic" }, { label: "Message dispatch", icon: "message-circle", route: "/messages" }];
  if (family === "event") return [{ label: "Review trace", icon: "activity" }, { label: "Open shipment", icon: "truck", route: "/loads" }];
  return [{ label: "Open action", icon: "arrow-up-right" }, { label: "Message", icon: "message-circle", route: "/messages" }];
}

function titleCase(value: string): string {
  return value.split(/\s+/).map((word) => word ? `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}` : word).join(" ");
}
