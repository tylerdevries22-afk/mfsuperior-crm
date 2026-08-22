import {
  NOT_PORTED_REASON,
  NOT_PORTED_ROUTES,
  PARITY_MANIFEST,
  PARITY_STATES,
  REFERENCE_ROUTES,
  componentHashFor,
  getParityMapping,
  type ParityRole,
} from "../parity-manifest";

describe("reference parity manifest", () => {
  /**
   * Every pinned reference route is accounted for exactly once: either it is
   * ported and appears in the manifest, or it is deliberately not ported and
   * appears in NOT_PORTED_ROUTES. Neither list may quietly lose a route, and
   * no route may appear in both.
   */
  it("accounts for every pinned reference route exactly once", () => {
    const mapped = PARITY_MANIFEST.map(({ referenceRoute }) => referenceRoute);
    const notPorted = NOT_PORTED_ROUTES.map(({ referenceRoute }) => referenceRoute);

    expect(REFERENCE_ROUTES).toHaveLength(66);
    expect(new Set(mapped).size).toBe(mapped.length);
    expect(new Set(notPorted).size).toBe(notPorted.length);

    // Disjoint.
    for (const route of notPorted) expect(mapped).not.toContain(route);

    // Exhaustive.
    expect(new Set([...mapped, ...notPorted])).toEqual(new Set(REFERENCE_ROUTES));
    expect(mapped.length + notPorted.length).toBe(REFERENCE_ROUTES.length);
  });

  it("records why the dropped routes were not ported", () => {
    expect(NOT_PORTED_ROUTES.length).toBeGreaterThan(0);
    expect(NOT_PORTED_REASON).toMatch(/freight/i);
    // The equipment register, equipment models, and both parts storefronts.
    for (const prefix of ["/parts", "/models", "/marcone-parts", "/encompass-parts"]) {
      expect(NOT_PORTED_ROUTES.some((r) => r.referenceRoute.startsWith(prefix))).toBe(true);
    }
  });

  it("covers every role and deterministic UI state without empty contracts", () => {
    const mappedRoles = new Set<ParityRole>();
    for (const mapping of PARITY_MANIFEST) {
      expect(mapping.roles.length).toBeGreaterThan(0);
      expect(mapping.components.length).toBeGreaterThan(0);
      expect(mapping.states).toEqual(PARITY_STATES);
      mapping.roles.forEach((role) => mappedRoles.add(role));
    }
    expect(mappedRoles).toEqual(new Set(["public", "admin", "driver", "customer"]));
  });

  it("uses reproducible hashes for every component contract", () => {
    const hashes = new Set<string>();
    for (const mapping of PARITY_MANIFEST) {
      const { componentHash, ...input } = mapping;
      expect(componentHash).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
      expect(componentHashFor(input)).toBe(componentHash);
      expect(componentHashFor(input)).toBe(componentHashFor(input));
      hashes.add(componentHash);
    }
    expect(hashes.size).toBe(PARITY_MANIFEST.length);
  });

  it("never maps to a generic feature facade or a named partner route", () => {
    const forbidden = /(?:\/feature(?:\/|$)|target|ch-robinson|jb-hunt|uber|rxo)/i;
    for (const mapping of PARITY_MANIFEST) {
      expect(mapping.mfRoute).not.toMatch(forbidden);
      expect(mapping.components.join(" ")).not.toMatch(/facade/i);
    }
  });

  it("keeps the remaining supplier suite provider-neutral", () => {
    expect(getParityMapping("/union-parts").mfRoute).toBe("/suppliers");
  });

  it("routes the inventory tab to HQ", () => {
    expect(getParityMapping("/(tabs)/inventory").mfRoute).toBe("/(tabs)/hq");
  });
});
