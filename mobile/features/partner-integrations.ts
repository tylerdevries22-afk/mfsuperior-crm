export type FreightPartnerId = "target" | "ch-robinson" | "jb-hunt" | "uber-freight" | "rxo" | "north-park" | "warp";

export interface FreightPartnerDefinition {
  readonly id: FreightPartnerId;
  readonly name: string;
  readonly status: "portal_available" | "credentials_required";
  readonly statusLabel: string;
  readonly summary: string;
  readonly capabilities: readonly string[];
  readonly onboarding: readonly string[];
  readonly portalUrl: `https://${string}`;
}

export const FREIGHT_PARTNERS: readonly FreightPartnerDefinition[] = Object.freeze([
  {
    id: "target",
    name: "Target",
    status: "portal_available",
    statusLabel: "Portal available · EDI onboarding required",
    summary: "Public supplier requirements are available. No public freight API or private Target companion guides are configured.",
    capabilities: ["X12 204 tender", "X12 990 response", "X12 214 status", "X12 210 invoice", "X12 997 acknowledgement"],
    onboarding: ["Receive private companion guides and identifiers", "Agree on AS2, SFTP, or VAN transport", "Complete certification and UAT", "Approve production credentials and cutover"],
    portalUrl: "https://corporate.target.com/sustainability-governance/responsible-supply-chains/suppliers",
  },
  {
    id: "ch-robinson",
    name: "C.H. Robinson Navisphere",
    status: "credentials_required",
    statusLabel: "Credentials required",
    summary: "The adapter contract supports documented carrier connectivity, but no MF credentials or UAT approval exist.",
    capabilities: ["Load offers", "Tender response", "Shipment status", "Document exchange"],
    onboarding: ["Enroll MF as an approved carrier", "Receive sandbox credentials", "Validate mapped events", "Complete UAT before enabling"],
    portalUrl: "https://www.chrobinson.com/en-us/carriers/api-connectivity/",
  },
  {
    id: "jb-hunt",
    name: "J.B. Hunt 360",
    status: "credentials_required",
    statusLabel: "Credentials required",
    summary: "Connectivity capabilities are modeled from public documentation; this is not a live J.B. Hunt connection.",
    capabilities: ["Freight matching", "Load management", "Tracking events", "Document workflows"],
    onboarding: ["Complete carrier enrollment", "Confirm supported connectivity product", "Receive test access", "Pass operational UAT"],
    portalUrl: "https://www.jbhunt.com/technology/connectivity",
  },
  {
    id: "uber-freight",
    name: "Uber Freight",
    status: "credentials_required",
    statusLabel: "Credentials required",
    summary: "The client boundary is onboarding-safe and disabled until API access and UAT are complete.",
    capabilities: ["Load search", "Booking", "Shipment tracking", "Document exchange"],
    onboarding: ["Request developer access", "Register redirect and webhook endpoints", "Validate idempotency behavior", "Complete UAT and approval"],
    portalUrl: "https://developer.uberfreight.com/get-started",
  },
  {
    id: "rxo",
    name: "RXO",
    status: "credentials_required",
    statusLabel: "Credentials required",
    summary: "Public API contracts are represented, but no token, customer identifier, or production authorization exists.",
    capabilities: ["Load offers", "Tender workflow", "Status updates", "Shipment documents"],
    onboarding: ["Register an RXO developer application", "Receive test credentials", "Map reference identifiers", "Complete UAT and production review"],
    portalUrl: "https://developer.rxo.com/apis",
  },
  {
    id: "north-park",
    name: "North Park Transportation",
    status: "credentials_required",
    statusLabel: "Credentials required",
    summary: "The documented Denver-region API boundary is ready for credentials and test fixtures, not production traffic.",
    capabilities: ["Rates", "Shipment creation", "Tracking", "Documents"],
    onboarding: ["Confirm account eligibility", "Receive API credentials", "Validate Denver service coverage", "Run UAT with real test shipments"],
    portalUrl: "https://api.nopk.com/v1/swagger",
  },
  {
    id: "warp",
    name: "Warp",
    status: "credentials_required",
    statusLabel: "Credentials required",
    summary: "Freight API capabilities are modeled but intentionally remain disabled until credentials and UAT succeed.",
    capabilities: ["Quotes", "Booking", "Tracking", "Webhooks"],
    onboarding: ["Establish a Warp carrier account", "Receive sandbox credentials", "Validate webhook signatures", "Complete UAT and approval"],
    portalUrl: "https://www.wearewarp.com/freight-api",
  },
]);

/** Resolve a known integration without accepting an arbitrary portal URL. */
export function getFreightPartner(id: FreightPartnerId): FreightPartnerDefinition {
  const partner = FREIGHT_PARTNERS.find((candidate) => candidate.id === id);
  if (!partner) throw new RangeError(`Unknown freight partner: ${id}`);
  return partner;
}

/** Allow only the compile-time HTTPS portals declared in this module. */
export function validatedPartnerPortal(partner: FreightPartnerDefinition): `https://${string}` {
  const parsed = new URL(partner.portalUrl);
  if (parsed.protocol !== "https:") throw new TypeError("Partner portals must use HTTPS.");
  return partner.portalUrl;
}
