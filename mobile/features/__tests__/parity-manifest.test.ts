import {
  PARITY_MANIFEST,
  PARITY_STATES,
  REFERENCE_ROUTES,
  componentHashFor,
  getParityMapping,
  type ParityRole,
} from "../parity-manifest";

describe("reference parity manifest", () => {
  it("maps every pinned reference route exactly once", () => {
    const mappedRoutes = PARITY_MANIFEST.map(({ referenceRoute }) => referenceRoute);
    expect(REFERENCE_ROUTES).toHaveLength(66);
    expect(mappedRoutes).toHaveLength(REFERENCE_ROUTES.length);
    expect(new Set(mappedRoutes).size).toBe(REFERENCE_ROUTES.length);
    expect(new Set(mappedRoutes)).toEqual(new Set(REFERENCE_ROUTES));
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

  it("keeps supplier suites provider-neutral", () => {
    expect(getParityMapping("/encompass-parts").mfRoute).toBe("/capacity-marketplace");
    expect(getParityMapping("/marcone-parts").mfRoute).toBe("/equipment-marketplace");
    expect(getParityMapping("/union-parts").mfRoute).toBe("/suppliers");
  });
});
