import {
  PARTNERS,
  findPartner,
  partnerForIntegration,
  partnerMonogram,
} from "../partners";

describe("mobile partner directory", () => {
  it("has a unique slug and a logo for every partner", () => {
    const slugs = PARTNERS.map((partner) => partner.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const partner of PARTNERS) {
      expect(partner.logo).toBeTruthy();
      expect(partner.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("covers every partner shown in the connections list", () => {
    for (const slug of [
      "target-carrier",
      "ch-robinson",
      "jb-hunt",
      "uber-freight",
      "rxo",
      "north-park",
      "warp",
    ]) {
      expect(findPartner(slug)).not.toBeNull();
    }
  });
});

describe("findPartner", () => {
  it("resolves an exact slug", () => {
    expect(findPartner("ch-robinson")?.name).toBe("C.H. Robinson");
  });

  it("resolves a known alias", () => {
    expect(findPartner("target")?.slug).toBe("target-carrier");
    expect(findPartner("nopk")?.slug).toBe("north-park");
  });

  it("returns null for unknown and nullish input", () => {
    expect(findPartner("nope")).toBeNull();
    expect(findPartner("")).toBeNull();
    expect(findPartner(null)).toBeNull();
    expect(findPartner(undefined)).toBeNull();
  });
});

describe("partnerForIntegration", () => {
  it("shortens a prefixed fixture id until it resolves", () => {
    expect(partnerForIntegration("integration-target-edi", "Target EDI")?.slug).toBe(
      "target-carrier",
    );
    expect(
      partnerForIntegration("integration-target-production", "Target Production Connection")
        ?.slug,
    ).toBe("target-carrier");
  });

  it("resolves the bare ids the partner-connection list uses", () => {
    const cases: readonly (readonly [string, string, string])[] = [
      ["target", "Target", "target-carrier"],
      ["ch-robinson", "C.H. Robinson Navisphere", "ch-robinson"],
      ["jb-hunt", "J.B. Hunt 360", "jb-hunt"],
      ["uber-freight", "Uber Freight", "uber-freight"],
      ["rxo", "RXO", "rxo"],
      ["north-park", "North Park Transportation", "north-park"],
      ["warp", "Warp", "warp"],
    ];
    for (const [id, name, expected] of cases) {
      expect(partnerForIntegration(id, name)?.slug).toBe(expected);
    }
  });

  it("falls back to the display name when the id says nothing", () => {
    expect(partnerForIntegration("conn-01", "C.H. Robinson Navisphere")?.slug).toBe(
      "ch-robinson",
    );
  });

  it("returns null for integrations that are not partners", () => {
    expect(partnerForIntegration("integration-driver-gps", "Driver GPS")).toBeNull();
    expect(partnerForIntegration("integration-geofences", "Geofence alerts")).toBeNull();
  });
});

describe("partnerMonogram", () => {
  it("takes initials from multi-word names", () => {
    expect(partnerMonogram("North Park Transportation")).toBe("NP");
    expect(partnerMonogram("C.H. Robinson")).toBe("CH");
  });

  it("takes two letters from a single word", () => {
    expect(partnerMonogram("Warp")).toBe("WA");
  });

  it("degrades rather than throwing", () => {
    expect(partnerMonogram("")).toBe("?");
  });
});
