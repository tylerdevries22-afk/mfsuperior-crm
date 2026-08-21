export const FREIGHT_PARTNER_IDS = [
  "target",
  "ch-robinson",
  "jb-hunt",
  "uber-freight",
  "rxo",
  "north-park",
  "warp",
] as const;

export type FreightPartnerId = (typeof FREIGHT_PARTNER_IDS)[number];

export type PartnerCapability =
  | "load_search"
  | "load_offer"
  | "tender_response"
  | "shipment_status"
  | "document_exchange"
  | "rate_quote"
  | "booking"
  | "tracking"
  | "webhook_events"
  | "x12_204"
  | "x12_990"
  | "x12_214"
  | "x12_210"
  | "x12_997";

export type PartnerOnboardingState =
  | "portal_available_edi_onboarding_required"
  | "credentials_required";

export type FreightPartnerContract = Readonly<{
  id: FreightPartnerId;
  name: string;
  onboardingState: PartnerOnboardingState;
  statusLabel: string;
  capabilities: ReadonlyArray<PartnerCapability>;
  onboardingSteps: ReadonlyArray<string>;
  portalUrl: `https://${string}`;
  productionReady: false;
}>;

const X12_CAPABILITIES = [
  "x12_204",
  "x12_990",
  "x12_214",
  "x12_210",
  "x12_997",
] as const satisfies ReadonlyArray<PartnerCapability>;

export const FREIGHT_PARTNER_CONTRACTS: ReadonlyArray<FreightPartnerContract> =
  Object.freeze([
    {
      id: "target",
      name: "Target",
      onboardingState: "portal_available_edi_onboarding_required",
      statusLabel: "Portal available · EDI onboarding required",
      capabilities: X12_CAPABILITIES,
      onboardingSteps: [
        "Receive private companion guides, identifiers, and transport details.",
        "Agree on AS2, SFTP, or VAN transport.",
        "Complete certification and user acceptance testing.",
        "Approve production credentials and cutover.",
      ],
      portalUrl:
        "https://corporate.target.com/sustainability-governance/responsible-supply-chains/suppliers",
      productionReady: false,
    },
    {
      id: "ch-robinson",
      name: "C.H. Robinson Navisphere",
      onboardingState: "credentials_required",
      statusLabel: "Credentials required",
      capabilities: [
        "load_offer",
        "tender_response",
        "shipment_status",
        "document_exchange",
      ],
      onboardingSteps: [
        "Enroll MF as an approved carrier.",
        "Receive sandbox credentials.",
        "Validate mapped events.",
        "Complete user acceptance testing before enabling production.",
      ],
      portalUrl: "https://www.chrobinson.com/en-us/carriers/api-connectivity/",
      productionReady: false,
    },
    {
      id: "jb-hunt",
      name: "J.B. Hunt 360",
      onboardingState: "credentials_required",
      statusLabel: "Credentials required",
      capabilities: [
        "load_search",
        "booking",
        "tracking",
        "document_exchange",
      ],
      onboardingSteps: [
        "Complete carrier enrollment.",
        "Confirm the supported connectivity product.",
        "Receive test access.",
        "Pass operational user acceptance testing.",
      ],
      portalUrl: "https://www.jbhunt.com/technology/connectivity",
      productionReady: false,
    },
    {
      id: "uber-freight",
      name: "Uber Freight",
      onboardingState: "credentials_required",
      statusLabel: "Credentials required",
      capabilities: [
        "load_search",
        "booking",
        "shipment_status",
        "document_exchange",
      ],
      onboardingSteps: [
        "Request developer access.",
        "Register redirect and webhook endpoints.",
        "Validate provider idempotency behavior.",
        "Complete user acceptance testing and approval.",
      ],
      portalUrl: "https://developer.uberfreight.com/get-started",
      productionReady: false,
    },
    {
      id: "rxo",
      name: "RXO",
      onboardingState: "credentials_required",
      statusLabel: "Credentials required",
      capabilities: [
        "load_offer",
        "tender_response",
        "shipment_status",
        "document_exchange",
      ],
      onboardingSteps: [
        "Register an RXO developer application.",
        "Receive test credentials.",
        "Map external reference identifiers.",
        "Complete user acceptance testing and production review.",
      ],
      portalUrl: "https://developer.rxo.com/apis",
      productionReady: false,
    },
    {
      id: "north-park",
      name: "North Park Transportation",
      onboardingState: "credentials_required",
      statusLabel: "Credentials required",
      capabilities: [
        "rate_quote",
        "booking",
        "tracking",
        "document_exchange",
      ],
      onboardingSteps: [
        "Confirm account eligibility.",
        "Receive API credentials.",
        "Validate Denver service coverage.",
        "Run user acceptance testing with approved test shipments.",
      ],
      portalUrl: "https://api.nopk.com/v1/swagger",
      productionReady: false,
    },
    {
      id: "warp",
      name: "Warp",
      onboardingState: "credentials_required",
      statusLabel: "Credentials required",
      capabilities: [
        "rate_quote",
        "booking",
        "tracking",
        "webhook_events",
      ],
      onboardingSteps: [
        "Establish a Warp carrier account.",
        "Receive sandbox credentials.",
        "Validate webhook signatures.",
        "Complete user acceptance testing and approval.",
      ],
      portalUrl: "https://www.wearewarp.com/freight-api",
      productionReady: false,
    },
  ]);

export type PartnerConnectionEvidence = Readonly<{
  credentialsVerifiedAt?: Date;
  uatApprovedAt?: Date;
  productionEnabledAt?: Date;
}>;

export type PartnerConnectionState = Readonly<{
  provider: FreightPartnerId;
  state:
    | PartnerOnboardingState
    | "uat_required"
    | "production_approval_required"
    | "connected";
  label: string;
  canSendProductionTraffic: boolean;
}>;

/** Returns true only for one of the seven surfaced freight partner identifiers. */
export function isFreightPartnerId(value: string): value is FreightPartnerId {
  return (FREIGHT_PARTNER_IDS as ReadonlyArray<string>).includes(value);
}

/** Resolves a partner from the closed, reviewed catalog. */
export function getFreightPartnerContract(
  id: FreightPartnerId,
): FreightPartnerContract {
  const contract = FREIGHT_PARTNER_CONTRACTS.find((entry) => entry.id === id);
  if (!contract) throw new RangeError(`Unknown freight partner: ${id}`);
  return contract;
}

/** Derives connection truth from server-side evidence; defaults never claim connectivity. */
export function derivePartnerConnectionState(
  id: FreightPartnerId,
  evidence: PartnerConnectionEvidence = {},
): PartnerConnectionState {
  const contract = getFreightPartnerContract(id);
  if (!evidence.credentialsVerifiedAt) {
    return {
      provider: id,
      state: contract.onboardingState,
      label: contract.statusLabel,
      canSendProductionTraffic: false,
    };
  }
  if (!evidence.uatApprovedAt) {
    return {
      provider: id,
      state: "uat_required",
      label: "Credentials verified · UAT required",
      canSendProductionTraffic: false,
    };
  }
  if (!evidence.productionEnabledAt) {
    return {
      provider: id,
      state: "production_approval_required",
      label: "UAT passed · Production approval required",
      canSendProductionTraffic: false,
    };
  }
  return {
    provider: id,
    state: "connected",
    label: "Connected",
    canSendProductionTraffic: true,
  };
}

/** Returns the reviewed HTTPS portal URL; arbitrary redirects are never accepted. */
export function partnerPortalUrl(id: FreightPartnerId): `https://${string}` {
  const portalUrl = getFreightPartnerContract(id).portalUrl;
  const parsed = new URL(portalUrl);
  if (parsed.protocol !== "https:") {
    throw new TypeError("Freight partner portals must use HTTPS.");
  }
  return portalUrl;
}
