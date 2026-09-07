import type { FreightFormSpec } from "@/route-support/freight";

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
