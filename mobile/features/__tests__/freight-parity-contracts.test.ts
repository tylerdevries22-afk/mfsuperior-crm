import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  FreightCollectionSpec,
  FreightDetailSpec,
  FreightFormSpec,
  FreightMarketplaceSpec,
} from "@/route-support/freight";

import { createFreightDetailSpec, type FreightDetailFamily } from "../freight-detail-specs";
import * as freightSpecs from "../freight-screen-specs";
import {
  FREIGHT_PARTNERS,
  getFreightPartner,
  validatedPartnerPortal,
  type FreightPartnerDefinition,
  type FreightPartnerId,
} from "../partner-integrations";
import { PARITY_MANIFEST } from "../parity-manifest";

const APP_ROOT = resolve(__dirname, "../../app");

const COLLECTION_SPECS: readonly FreightCollectionSpec[] = [
  freightSpecs.SHIPPERS_SPEC,
  freightSpecs.LOADS_SPEC,
  freightSpecs.DRIVERS_SPEC,
  freightSpecs.QUOTES_SPEC,
  freightSpecs.INVOICES_SPEC,
  freightSpecs.SETTLEMENTS_SPEC,
  freightSpecs.PROSPECTS_SPEC,
  freightSpecs.RATES_SPEC,
  freightSpecs.CONTRACTS_SPEC,
  freightSpecs.TAGS_SPEC,
  freightSpecs.INTEGRATION_EVENTS_SPEC,
  freightSpecs.KNOWLEDGE_SPEC,
  freightSpecs.EDI_CODES_SPEC,
  freightSpecs.ASSETS_SPEC,
  freightSpecs.CAPACITY_ORDERS_SPEC,
  freightSpecs.EQUIPMENT_ORDERS_SPEC,
];

const DETAIL_SPECS: readonly FreightDetailSpec[] = [
  freightSpecs.SHIPPER_DETAIL_SPEC,
  freightSpecs.ASSET_DETAIL_SPEC,
  freightSpecs.MARKETPLACE_DETAIL_SPEC,
  freightSpecs.EQUIPMENT_DETAIL_SPEC,
];

const MARKETPLACE_SPECS: readonly FreightMarketplaceSpec[] = [
  freightSpecs.CAPACITY_MARKETPLACE_SPEC,
  freightSpecs.EQUIPMENT_MARKETPLACE_SPEC,
];

const FORM_SPECS: readonly FreightFormSpec[] = [
  freightSpecs.NEW_LOAD_FORM,
  freightSpecs.NEW_PROSPECT_FORM,
  freightSpecs.RETURN_FORM,
  freightSpecs.CLAIM_FORM,
];

const DETAIL_FAMILIES: readonly FreightDetailFamily[] = [
  "driver",
  "quote",
  "invoice",
  "lead",
  "payment",
  "rate",
  "program",
  "event",
  "supplier",
  "code",
  "equipment",
  "session",
];

function resolveExpoRoute(route: string): string | undefined {
  const routeBase = resolve(APP_ROOT, ...route.split("/").filter(Boolean));
  return [
    `${routeBase}.tsx`,
    `${routeBase}.ts`,
    resolve(routeBase, "index.tsx"),
    resolve(routeBase, "index.ts"),
  ].find((candidate) => existsSync(candidate));
}

function allSpecRoutes(): readonly string[] {
  const collectionRoutes = COLLECTION_SPECS.flatMap((spec) => [
    spec.primaryAction?.route,
    ...spec.records.map((record) => record.route),
  ]);
  const detailRoutes = DETAIL_SPECS.flatMap((spec) => spec.actions?.map((action) => action.route) ?? []);
  const marketplaceRoutes = MARKETPLACE_SPECS.flatMap((spec) => [
    spec.searchRoute,
    spec.cartRoute,
    ...spec.categories.map((record) => record.route),
    ...spec.featured.map((record) => record.route),
  ]);
  return [...collectionRoutes, ...detailRoutes, ...marketplaceRoutes].filter(
    (route): route is string => typeof route === "string",
  );
}

describe("Expo route parity contract", () => {
  it("backs every MF manifest route with a concrete default-exported Expo route", () => {
    for (const mapping of PARITY_MANIFEST) {
      const routeFile = resolveExpoRoute(mapping.mfRoute);
      if (!routeFile) {
        throw new Error(`Missing Expo route for ${mapping.referenceRoute} -> ${mapping.mfRoute}`);
      }
      expect(readFileSync(routeFile, "utf8")).toMatch(/export\s+default\s+/);
    }
  });

  it("keeps freight fixture navigation direct and provider-neutral", () => {
    for (const route of allSpecRoutes()) {
      expect(route).toMatch(/^\//);
      expect(route).not.toMatch(/\/feature(?:\/|$)/i);
      expect(route).not.toMatch(/target|ch-robinson|jb-hunt|uber-freight|rxo/i);
    }
  });
});

describe("freight partner contract", () => {
  it("preserves the approved seven-provider order and honest connection states", () => {
    expect(FREIGHT_PARTNERS.map(({ id, name, status, statusLabel }) => ({ id, name, status, statusLabel }))).toEqual([
      { id: "target", name: "Target", status: "portal_available", statusLabel: "Portal available · EDI onboarding required" },
      { id: "ch-robinson", name: "C.H. Robinson Navisphere", status: "credentials_required", statusLabel: "Credentials required" },
      { id: "jb-hunt", name: "J.B. Hunt 360", status: "credentials_required", statusLabel: "Credentials required" },
      { id: "uber-freight", name: "Uber Freight", status: "credentials_required", statusLabel: "Credentials required" },
      { id: "rxo", name: "RXO", status: "credentials_required", statusLabel: "Credentials required" },
      { id: "north-park", name: "North Park Transportation", status: "credentials_required", statusLabel: "Credentials required" },
      { id: "warp", name: "Warp", status: "credentials_required", statusLabel: "Credentials required" },
    ]);
    expect(FREIGHT_PARTNERS[0]?.summary).toMatch(/No public freight API/i);
  });

  it("resolves only declared partners and validates every portal as HTTPS", () => {
    for (const partner of FREIGHT_PARTNERS) {
      expect(getFreightPartner(partner.id)).toBe(partner);
      expect(validatedPartnerPortal(partner)).toBe(partner.portalUrl);
      expect(new URL(partner.portalUrl).protocol).toBe("https:");
      expect(partner.capabilities.length).toBeGreaterThan(0);
      expect(partner.onboarding.length).toBeGreaterThan(0);
    }
    expect(() => getFreightPartner("unknown" as FreightPartnerId)).toThrow(RangeError);

    const insecurePartner: FreightPartnerDefinition = {
      ...FREIGHT_PARTNERS[0],
      portalUrl: "http://example.invalid" as `https://${string}`,
    };
    expect(() => validatedPartnerPortal(insecurePartner)).toThrow(TypeError);
  });
});

describe("freight screen fixture contracts", () => {
  it("pins the complete exported fixture inventory", () => {
    expect(Object.keys(freightSpecs).sort()).toEqual([
      "ASSETS_SPEC",
      "ASSET_DETAIL_SPEC",
      "CAPACITY_MARKETPLACE_SPEC",
      "CAPACITY_ORDERS_SPEC",
      "CLAIM_FORM",
      "CONTRACTS_SPEC",
      "DRIVERS_SPEC",
      "EDI_CODES_SPEC",
      "EQUIPMENT_DETAIL_SPEC",
      "EQUIPMENT_MARKETPLACE_SPEC",
      "EQUIPMENT_ORDERS_SPEC",
      "INTEGRATION_EVENTS_SPEC",
      "INVOICES_SPEC",
      "KNOWLEDGE_SPEC",
      "LOADS_SPEC",
      "MARKETPLACE_DETAIL_SPEC",
      "NEW_LOAD_FORM",
      "NEW_PROSPECT_FORM",
      "PROSPECTS_SPEC",
      "QUOTES_SPEC",
      "RATES_SPEC",
      "RETURN_FORM",
      "SETTLEMENTS_SPEC",
      "SHIPPERS_SPEC",
      "SHIPPER_DETAIL_SPEC",
      "TAGS_SPEC",
    ]);
  });

  it("keeps collections, marketplaces, details, and forms structurally usable", () => {
    for (const spec of COLLECTION_SPECS) {
      expect(spec.eyebrow.trim()).not.toBe("");
      expect(spec.title.trim()).not.toBe("");
      expect(spec.records.length).toBeGreaterThan(0);
      expect(new Set(spec.records.map(({ id }) => id)).size).toBe(spec.records.length);
    }
    for (const spec of MARKETPLACE_SPECS) {
      expect(spec.categories.length).toBeGreaterThan(0);
      expect(spec.featured.length).toBeGreaterThan(0);
      expect(spec.searchRoute).toMatch(/^\//);
      expect(spec.cartRoute).toMatch(/^\//);
    }
    for (const spec of DETAIL_SPECS) {
      expect(spec.metrics).toHaveLength(4);
      expect(spec.timeline).toHaveLength(3);
      expect(new Set(spec.timeline.map(({ id }) => id)).size).toBe(spec.timeline.length);
    }
    for (const spec of FORM_SPECS) {
      expect(spec.fields.length).toBeGreaterThan(0);
      expect(new Set(spec.fields.map(({ key }) => key)).size).toBe(spec.fields.length);
      expect(spec.submitLabel.trim()).not.toBe("");
      expect(spec.successMessage.trim()).not.toBe("");
    }
  });

  it.each(DETAIL_FAMILIES)("builds deterministic, actionable %s detail fixtures", (family) => {
    const first = createFreightDetailSpec(family, "mf-2048");
    const second = createFreightDetailSpec(family, "mf-2048");
    expect(second).toEqual(first);
    expect(first.metrics).toHaveLength(4);
    expect(first.timeline).toHaveLength(3);
    expect(first.actions).toHaveLength(2);
    expect(new Set(first.timeline.map(({ id }) => id)).size).toBe(first.timeline.length);
    expect(first.timeline.every(({ id }) => id.startsWith(`${family}-`))).toBe(true);
    expect(first.title).not.toContain("-");
  });

  it("keeps person-like identifiers title-cased and record identifiers uppercase", () => {
    expect(createFreightDetailSpec("driver", "brenna-lewis").title).toBe("Brenna Lewis");
    expect(createFreightDetailSpec("supplier", "front-range-trailer-services").title).toBe("Front Range Trailer Services");
    expect(createFreightDetailSpec("quote", "q-1184").title).toBe("Q 1184");
    expect(createFreightDetailSpec("event", "e48a").title).toBe("E48A");
    expect(createFreightDetailSpec("session", "").title).toBe("REEFER TEMPERATURE EXCEPTION");
  });
});
