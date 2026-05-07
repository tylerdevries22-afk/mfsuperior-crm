import { snippetForVertical } from "./personalization";

/**
 * Mustache-style template variable substitution.
 *
 * Supported variables (case-sensitive):
 *   {{first_name}}        → lead.firstName ?? sensible fallback
 *   {{last_name}}         → lead.lastName ?? ""
 *   {{full_name}}         → "First Last" or first-only or empty
 *   {{company_name}}      → lead.companyName ?? ""
 *   {{city}}              → lead.city ?? ""
 *   {{state}}             → lead.state ?? ""
 *   {{vertical}}          → lead.vertical ?? ""
 *   {{personalization}}   → snippetForVertical(lead.vertical)  ← auto from kit map
 *   {{sender_name}}       → settings.senderName
 *   {{sender_email}}      → settings.senderEmail
 *   {{sender_company}}    → settings.businessName
 *   {{sender_title}}      → settings.senderTitle ?? "Owner"
 *   {{sender_phone}}      → settings.senderPhone ?? ""
 *   {{mc_number}}         → settings.businessMc ?? ""
 *   {{usdot_number}}      → settings.businessUsdot ?? ""
 *   {{call_time}}         → context.callTime ?? "this week"
 *
 * An unknown {{variable}} is left in place verbatim so the template editor's
 * "missing variables" linter can surface it. This is intentional — silent
 * substitution to "" hides bugs.
 */

export type RenderLead = {
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  city?: string | null;
  state?: string | null;
  vertical?: string | null;
};

export type RenderSettings = {
  senderName: string;
  senderEmail: string;
  businessName: string;
  senderTitle?: string | null;
  senderPhone?: string | null;
  businessMc?: string | null;
  businessUsdot?: string | null;
};

export type RenderContext = {
  callTime?: string;
};

const VAR_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function buildVariableMap(
  lead: RenderLead,
  settings: RenderSettings,
  context: RenderContext = {},
): Record<string, string> {
  const firstName = (lead.firstName ?? "").trim();
  const lastName = (lead.lastName ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    first_name: firstName || "there",
    last_name: lastName,
    full_name: fullName || "there",
    company_name: (lead.companyName ?? "").trim(),
    city: (lead.city ?? "").trim(),
    state: (lead.state ?? "").trim(),
    vertical: (lead.vertical ?? "").trim(),
    personalization: snippetForVertical(lead.vertical),
    sender_name: settings.senderName,
    sender_email: settings.senderEmail,
    sender_company: settings.businessName,
    sender_title: (settings.senderTitle ?? "Owner").trim(),
    sender_phone: (settings.senderPhone ?? "").trim(),
    mc_number: (settings.businessMc ?? "").trim(),
    usdot_number: (settings.businessUsdot ?? "").trim(),
    call_time: (context.callTime ?? "this week").trim(),
  };
}

export type RenderResult = {
  output: string;
  used: string[];
  unknown: string[];
};

export function renderTemplate(
  source: string,
  variables: Record<string, string>,
): RenderResult {
  const used = new Set<string>();
  const unknown = new Set<string>();
  const output = source.replace(VAR_PATTERN, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      used.add(name);
      return variables[name];
    }
    unknown.add(name);
    return match; // leave untouched so editor can highlight
  });
  return {
    output,
    used: [...used],
    unknown: [...unknown],
  };
}

/** Lists every {{variable}} that appears in the source, deduplicated, in order. */
export function extractVariables(source: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of source.matchAll(VAR_PATTERN)) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** All variables the renderer recognizes — used by the editor's variable picker. */
export const KNOWN_VARIABLES = [
  "first_name",
  "last_name",
  "full_name",
  "company_name",
  "city",
  "state",
  "vertical",
  "personalization",
  "sender_name",
  "sender_email",
  "sender_company",
  "sender_title",
  "sender_phone",
  "mc_number",
  "usdot_number",
  "call_time",
] as const;

export type KnownVariable = (typeof KNOWN_VARIABLES)[number];
