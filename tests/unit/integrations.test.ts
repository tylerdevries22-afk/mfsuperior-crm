import { describe, expect, it, vi } from "vitest";
import {
  derivePartnerConnectionState,
  executePartnerOperation,
  FREIGHT_PARTNER_CONTRACTS,
  getFreightPartnerContract,
  isFreightPartnerId,
  PartnerIntegrationError,
  partnerPortalUrl,
  type PartnerAdapterConfig,
} from "@/lib/integrations/partners";
import {
  FileBoundaryError,
  inspectInboundFile,
} from "@/lib/integrations/security";
import {
  parseX12Envelope,
  validateX12Envelope,
  X12BoundaryError,
  type SupportedX12TransactionType,
} from "@/lib/integrations/x12";

const functionalCodeByType = {
  "204": "SM",
  "990": "GF",
  "214": "QM",
  "210": "IM",
  "997": "FA",
} satisfies Record<SupportedX12TransactionType, string>;

function padded(value: string, width: number): string {
  return value.padEnd(width, " ").slice(0, width);
}

function x12Fixture(type: SupportedX12TransactionType = "204"): string {
  const isa = [
    "ISA",
    "00",
    padded("", 10),
    "00",
    padded("", 10),
    "ZZ",
    padded("MF-SUPERIOR", 15),
    "ZZ",
    padded("PARTNER", 15),
    "260821",
    "1200",
    "^",
    "00501",
    "000000001",
    "0",
    "P",
    ":",
  ].join("*");
  if (isa.length !== 105) throw new Error("The test ISA fixture must be fixed-width.");
  const code = functionalCodeByType[type];
  return [
    isa,
    `GS*${code}*MF-SUPERIOR*PARTNER*20260821*1200*1*X*005010`,
    `ST*${type}*0001`,
    "N1*SH*MF SUPERIOR PRODUCTS",
    "SE*3*0001",
    "GE*1*1",
    "IEA*1*000000001",
    "",
  ].join("~");
}

function productionConfig(
  overrides: Partial<PartnerAdapterConfig> = {},
): PartnerAdapterConfig {
  return {
    provider: "uber-freight",
    environment: "production",
    endpointBaseUrl: "https://sandbox.partner.example/v1/",
    connectionEvidence: {
      credentialsVerifiedAt: new Date("2026-08-20T10:00:00Z"),
      uatApprovedAt: new Date("2026-08-21T10:00:00Z"),
      productionEnabledAt: new Date("2026-08-21T12:00:00Z"),
    },
    timeoutMs: 500,
    ...overrides,
  };
}

describe("freight partner contracts", () => {
  it("keeps the seven approved partners in the required order with honest defaults", () => {
    expect(FREIGHT_PARTNER_CONTRACTS.map((partner) => partner.name)).toEqual([
      "Target",
      "C.H. Robinson Navisphere",
      "J.B. Hunt 360",
      "Uber Freight",
      "RXO",
      "North Park Transportation",
      "Warp",
    ]);
    expect(FREIGHT_PARTNER_CONTRACTS.every((partner) => !partner.productionReady)).toBe(true);
    expect(getFreightPartnerContract("target")).toMatchObject({
      onboardingState: "portal_available_edi_onboarding_required",
      statusLabel: "Portal available · EDI onboarding required",
    });
  });

  it("narrows identifiers and exposes only reviewed HTTPS portals", () => {
    expect(isFreightPartnerId("rxo")).toBe(true);
    expect(isFreightPartnerId("echo")).toBe(false);
    expect(partnerPortalUrl("north-park")).toBe("https://api.nopk.com/v1/swagger");
  });

  it("does not report connected until credentials, UAT, and cutover are evidenced", () => {
    expect(derivePartnerConnectionState("target").state).toBe(
      "portal_available_edi_onboarding_required",
    );
    expect(
      derivePartnerConnectionState("warp", {
        credentialsVerifiedAt: new Date("2026-08-20T10:00:00Z"),
      }).state,
    ).toBe("uat_required");
    expect(
      derivePartnerConnectionState("warp", {
        credentialsVerifiedAt: new Date("2026-08-20T10:00:00Z"),
        uatApprovedAt: new Date("2026-08-21T10:00:00Z"),
      }).state,
    ).toBe("production_approval_required");
    expect(
      derivePartnerConnectionState("warp", productionConfig().connectionEvidence),
    ).toMatchObject({ state: "connected", canSendProductionTraffic: true });
  });
});

describe("partner adapter boundary", () => {
  it("fails closed before credentials, UAT, and explicit production cutover", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    await expect(
      executePartnerOperation(
        productionConfig({ connectionEvidence: {} }),
        { capability: "load_search", method: "GET", path: "/loads" },
        { fetch: fetchMock },
      ),
    ).rejects.toMatchObject({ code: "CONNECTION_NOT_READY" } satisfies Partial<PartnerIntegrationError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported capabilities and unsafe mutations before transport", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    await expect(
      executePartnerOperation(
        productionConfig({ provider: "warp" }),
        { capability: "x12_204", method: "GET", path: "/loads" },
        { fetch: fetchMock },
      ),
    ).rejects.toMatchObject({ code: "CAPABILITY_NOT_SUPPORTED" });
    await expect(
      executePartnerOperation(
        productionConfig(),
        { capability: "booking", method: "POST", path: "/bookings", body: "{}" },
        { fetch: fetchMock },
      ),
    ).rejects.toMatchObject({ code: "UNSAFE_MUTATION" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries a transient read with 10-second-class timeout policy and redacted events", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ loads: [] }));
    const events: Array<Record<string, unknown>> = [];
    const response = await executePartnerOperation(
      productionConfig({ timeoutMs: 10_000 }),
      { capability: "load_search", method: "GET", path: "/loads" },
      {
        fetch: fetchMock,
        random: () => 0,
        sleep: async () => undefined,
        observe: (event) => events.push(event),
      },
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events.map((event) => event.event)).toEqual([
      "attempt",
      "retry",
      "attempt",
      "completed",
    ]);
    expect(JSON.stringify(events)).not.toContain("sandbox.partner.example");
  });

  it("attaches provider idempotency and retries a safe mutation", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const response = await executePartnerOperation(
      productionConfig(),
      {
        capability: "booking",
        method: "POST",
        path: "/bookings",
        body: "{}",
        mutationSafety: {
          kind: "provider_idempotency",
          key: "booking-550e8400-e29b-41d4-a716-446655440000",
        },
      },
      { fetch: fetchMock, sleep: async () => undefined },
    );
    const firstInit = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(firstInit?.headers).get("idempotency-key")).toContain("booking-");
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe(
      "https://sandbox.partner.example/v1/bookings",
    );
    expect(response.status).toBe(202);
  });

  it("reconciles an ambiguous mutation before retrying", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    const reconcile = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const response = await executePartnerOperation(
      productionConfig(),
      {
        capability: "booking",
        method: "POST",
        path: "/bookings",
        mutationSafety: { kind: "outcome_reconciliation", reconcile },
      },
      { fetch: fetchMock },
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("rejects endpoint traversal and wraps exhausted network failures", async () => {
    await expect(
      executePartnerOperation(
        productionConfig(),
        { capability: "load_search", method: "GET", path: "/../secrets" },
      ),
    ).rejects.toMatchObject({ code: "INVALID_ENDPOINT" });

    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("socket included secret"));
    await expect(
      executePartnerOperation(
        productionConfig(),
        { capability: "load_search", method: "GET", path: "/loads" },
        { fetch: fetchMock, sleep: async () => undefined },
      ),
    ).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "The freight partner did not respond within the bounded retry policy.",
    });
  });

  it("rejects reserved idempotency headers and wraps an unresolved transient response", async () => {
    await expect(
      executePartnerOperation(
        productionConfig(),
        {
          capability: "booking",
          method: "POST",
          path: "/bookings",
          mutationSafety: {
            kind: "provider_idempotency",
            key: "booking-550e8400-e29b-41d4-a716-446655440000",
            headerName: "Authorization",
          },
        },
      ),
    ).rejects.toMatchObject({ code: "UNSAFE_MUTATION" });

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(
      executePartnerOperation(
        productionConfig(),
        { capability: "load_search", method: "GET", path: "/loads" },
        { fetch: fetchMock, sleep: async () => undefined },
      ),
    ).rejects.toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops when outcome reconciliation itself is unavailable", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(
      executePartnerOperation(
        productionConfig(),
        {
          capability: "booking",
          method: "POST",
          path: "/bookings",
          mutationSafety: {
            kind: "outcome_reconciliation",
            reconcile: async () => {
              throw new Error("secret provider error");
            },
          },
        },
        { fetch: fetchMock },
      ),
    ).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "The mutation outcome could not be safely reconciled.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("bounded X12 boundary", () => {
  it.each(["204", "990", "214", "210", "997"] as const)(
    "parses and validates a supported %s transaction",
    (transactionType) => {
      const envelope = validateX12Envelope(parseX12Envelope(x12Fixture(transactionType)));
      expect(envelope.groups[0]?.transactions[0]?.type).toBe(transactionType);
      expect(envelope.senderId).toBe("MF-SUPERIOR");
    },
  );

  it("checks expected document types and rejects control/count tampering", () => {
    const envelope = parseX12Envelope(x12Fixture("204"));
    expect(() => validateX12Envelope(envelope, ["214"])).toThrow(X12BoundaryError);
    expect(() =>
      validateX12Envelope(parseX12Envelope(x12Fixture().replace("SE*3*0001", "SE*4*0001"))),
    ).toThrowError(/segment count/i);
    expect(() =>
      validateX12Envelope(parseX12Envelope(x12Fixture().replace("IEA*1*000000001", "IEA*1*000000099"))),
    ).toThrowError(/control numbers/i);
  });

  it("rejects malformed magic, unsafe controls, segment floods, and long elements", () => {
    expect(() => parseX12Envelope(`BAD${x12Fixture().slice(3)}`)).toThrowError(/begin with an ISA/i);
    expect(() => parseX12Envelope(`${x12Fixture()}\u0000`)).toThrowError(/control characters/i);
    expect(() => parseX12Envelope(x12Fixture(), { maxSegments: 4 })).toThrowError(/segment limit/i);
    expect(() => parseX12Envelope(x12Fixture(), { maxElementLength: 2 })).toThrowError(/length limit/i);
  });
});

describe("inbound file magic and quarantine boundary", () => {
  it("accepts matching PDF/image signatures and requires image re-encoding", () => {
    expect(
      inspectInboundFile({
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
        declaredContentType: "application/pdf",
      }),
    ).toMatchObject({
      detectedContentType: "application/pdf",
      quarantineRequired: true,
      imageReencodingRequired: false,
    });
    expect(
      inspectInboundFile({
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        declaredContentType: "image/jpeg",
      }).imageReencodingRequired,
    ).toBe(true);
  });

  it("parses X12 bytes and rejects MIME, size, and magic mismatches", () => {
    const x12Bytes = new TextEncoder().encode(x12Fixture());
    expect(
      inspectInboundFile({
        bytes: x12Bytes,
        declaredContentType: "application/edi-x12",
        declaredByteSize: x12Bytes.byteLength,
      }).detectedContentType,
    ).toBe("application/edi-x12");
    expect(() =>
      inspectInboundFile({ bytes: x12Bytes, declaredContentType: "application/pdf" }),
    ).toThrow(FileBoundaryError);
    expect(() =>
      inspectInboundFile({
        bytes: new Uint8Array([1, 2, 3]),
        declaredContentType: "application/pdf",
      }),
    ).toThrowError(/signature/i);
    expect(() =>
      inspectInboundFile({
        bytes: x12Bytes,
        declaredContentType: "application/edi-x12",
        declaredByteSize: x12Bytes.byteLength + 1,
      }),
    ).toThrowError(/declared file size/i);
  });
});
