import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PARTNERS,
  PARTNER_CATEGORIES,
  PARTNER_CATEGORY_LABELS,
  findPartner,
  partnerAccent,
  partnerMonogram,
  partnerSlugify,
  sortPartners,
  type Partner,
} from "@/data/partners";

const PUBLIC_DIR = path.join(process.cwd(), "public");

describe("partner directory", () => {
  it("has a unique slug for every partner", () => {
    const slugs = PARTNERS.map((partner) => partner.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses slugs that survive a round trip through the slugifier", () => {
    for (const partner of PARTNERS) {
      expect(partnerSlugify(partner.slug)).toBe(partner.slug);
    }
  });

  it("seeds Target Carrier and C.H. Robinson as the active partners", () => {
    const active = PARTNERS.filter((partner) => partner.status === "active");
    expect(active.map((partner) => partner.slug).sort()).toEqual([
      "ch-robinson",
      "target-carrier",
    ]);
  });

  it("seeds the full target list", () => {
    const targets = PARTNERS.filter((partner) => partner.status === "target");
    expect(targets.map((partner) => partner.slug).sort()).toEqual(
      [
        "amazon-relay",
        "curri",
        "dat",
        "estes",
        "frayt",
        "goshare",
        "home-depot",
        "jb-hunt",
        "lowes",
        "old-dominion",
        "roadie",
        "rxo",
        "truckstop",
        "uber-freight",
        "xpo",
      ].sort(),
    );
  });

  it("only uses declared categories", () => {
    for (const partner of PARTNERS) {
      expect(PARTNER_CATEGORIES).toContain(partner.category);
      expect(PARTNER_CATEGORY_LABELS[partner.category]).toBeTruthy();
    }
  });

  it("declares the agreed taxonomy, each with a label", () => {
    expect([...PARTNER_CATEGORIES].sort()).toEqual([
      "broker",
      "final-mile",
      "load-board",
      "ltl",
      "marketing",
      "retailer-program",
      "same-day-app",
    ]);
    for (const category of PARTNER_CATEGORIES) {
      expect(PARTNER_CATEGORY_LABELS[category]).toBeTruthy();
    }
  });

  it("leaves `marketing` available for uploads without seeding one", () => {
    // No named partner is a marketing partner; the category exists so the
    // admin upload form can file one without a code change.
    const used = new Set(PARTNERS.map((partner) => partner.category));
    expect(used.has("marketing")).toBe(false);
    expect(PARTNER_CATEGORIES).toContain("marketing");
  });
});

describe("partner logo assets", () => {
  it("points every partner at a file that exists under public/", () => {
    for (const partner of PARTNERS) {
      expect(partner.logo.startsWith("/partners/")).toBe(true);
      const file = path.join(PUBLIC_DIR, partner.logo.replace(/^\//, ""));
      expect(existsSync(file), `missing asset for ${partner.slug}`).toBe(true);
    }
  });

  it("ships SVGs that parse and carry no scripting", () => {
    for (const partner of PARTNERS) {
      if (!partner.logo.endsWith(".svg")) continue;
      const svg = readFileSync(
        path.join(PUBLIC_DIR, partner.logo.replace(/^\//, "")),
        "utf8",
      );
      expect(svg.trimStart().startsWith("<svg")).toBe(true);
      expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
      expect(svg).not.toMatch(/<script|javascript:|\son\w+\s*=/i);
      // Everything must be self-contained — a remote reference would leak the
      // viewer's IP and break behind the app's CSP.
      expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    }
  });
});

describe("findPartner", () => {
  it("resolves a known slug", () => {
    expect(findPartner("ch-robinson")?.name).toBe("C.H. Robinson");
  });

  it("returns null for unknown, empty, and nullish slugs", () => {
    expect(findPartner("nope")).toBeNull();
    expect(findPartner("")).toBeNull();
    expect(findPartner(null)).toBeNull();
    expect(findPartner(undefined)).toBeNull();
  });

  it("searches the supplied directory rather than the seed", () => {
    const runtime: Partner[] = [
      {
        slug: "werner",
        name: "Werner",
        logo: "/partners/werner.svg",
        status: "target",
        category: "broker",
      },
    ];
    expect(findPartner("werner", runtime)?.name).toBe("Werner");
    // A seeded partner missing from the runtime list must not leak through.
    expect(findPartner("ch-robinson", runtime)).toBeNull();
  });
});

describe("partnerAccent", () => {
  it("uses the partner's brand colour", () => {
    expect(partnerAccent(findPartner("target-carrier"))).toBe("#CC0000");
  });

  it("falls back to neutral slate for null and accent-less partners", () => {
    expect(partnerAccent(null)).toBe("#64748B");
    expect(
      partnerAccent({
        slug: "x",
        name: "X",
        logo: "/partners/x.svg",
        status: "target",
        category: "broker",
      }),
    ).toBe("#64748B");
  });
});

describe("partnerMonogram", () => {
  it("takes initials from multi-word names", () => {
    expect(partnerMonogram("Home Depot")).toBe("HD");
    expect(partnerMonogram("Old Dominion")).toBe("OD");
  });

  it("takes the first two letters of a single word", () => {
    expect(partnerMonogram("Curri")).toBe("CU");
  });

  it("splits on the dots inside abbreviated names", () => {
    expect(partnerMonogram("C.H. Robinson")).toBe("CH");
  });

  it("degrades rather than throwing on empty input", () => {
    expect(partnerMonogram("")).toBe("?");
    expect(partnerMonogram("   ")).toBe("?");
  });
});

describe("partnerSlugify", () => {
  it("lowercases and hyphenates", () => {
    expect(partnerSlugify("Werner Enterprises")).toBe("werner-enterprises");
  });

  it("strips punctuation and collapses separators", () => {
    expect(partnerSlugify("J.B.  Hunt!!")).toBe("j-b-hunt");
    expect(partnerSlugify("  --Lowe's--  ")).toBe("lowe-s");
  });

  it("returns an empty string when nothing survives", () => {
    expect(partnerSlugify("!!!")).toBe("");
  });

  it("caps length so it fits the varchar(64) column", () => {
    expect(partnerSlugify("a".repeat(200)).length).toBe(64);
  });
});

describe("sortPartners", () => {
  it("puts active partners first, alphabetical within each status", () => {
    const sorted = sortPartners(PARTNERS);
    const firstTarget = sorted.findIndex(
      (partner) => partner.status === "target",
    );
    expect(sorted.slice(0, firstTarget).every((p) => p.status === "active")).toBe(
      true,
    );
    expect(sorted[0].name).toBe("C.H. Robinson");
    expect(sorted[firstTarget].name).toBe("Amazon Relay");
  });

  it("does not mutate its input", () => {
    const original = [...PARTNERS];
    sortPartners(PARTNERS);
    expect(PARTNERS).toEqual(original);
  });
});
