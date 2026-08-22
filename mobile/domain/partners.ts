import type { ImageSourcePropType } from "react-native";

/**
 * Partner directory for the mobile app.
 *
 * Mirrors `src/data/partners.ts` in the web app — same slugs, names, and brand
 * colours — but carries `require()`d PNG handles instead of `/partners/*.svg`
 * paths, because React Native's bundler needs static asset references and the
 * app ships no SVG renderer. The PNGs in `assets/partners/` are rendered from
 * the same source SVGs at @1x/@2x/@3x; regenerate them whenever a logo changes
 * so the two directories cannot drift.
 */

export type PartnerStatus = "active" | "target";

export interface MobilePartner {
  readonly slug: string;
  readonly name: string;
  readonly logo: ImageSourcePropType;
  readonly status: PartnerStatus;
  /** Brand colour, used by the monogram fallback. */
  readonly accent: string;
}

export const PARTNERS: readonly MobilePartner[] = Object.freeze([
  { slug: "target-carrier", name: "Target Carrier", logo: require("../assets/partners/target-carrier.png"), status: "active", accent: "#CC0000" },
  { slug: "ch-robinson", name: "C.H. Robinson", logo: require("../assets/partners/ch-robinson.png"), status: "active", accent: "#00A0DF" },
  { slug: "rxo", name: "RXO", logo: require("../assets/partners/rxo.png"), status: "target", accent: "#00F49C" },
  { slug: "jb-hunt", name: "J.B. Hunt", logo: require("../assets/partners/jb-hunt.png"), status: "target", accent: "#FFDB00" },
  { slug: "curri", name: "Curri", logo: require("../assets/partners/curri.png"), status: "target", accent: "#00C2B2" },
  { slug: "frayt", name: "FRAYT", logo: require("../assets/partners/frayt.png"), status: "target", accent: "#0B5FFF" },
  { slug: "goshare", name: "GoShare", logo: require("../assets/partners/goshare.png"), status: "target", accent: "#0072CE" },
  { slug: "roadie", name: "Roadie", logo: require("../assets/partners/roadie.png"), status: "target", accent: "#F5C518" },
  { slug: "xpo", name: "XPO", logo: require("../assets/partners/xpo.png"), status: "target", accent: "#CC0000" },
  { slug: "estes", name: "Estes Express Lines", logo: require("../assets/partners/estes.png"), status: "target", accent: "#D3141B" },
  { slug: "old-dominion", name: "Old Dominion", logo: require("../assets/partners/old-dominion.png"), status: "target", accent: "#186944" },
  { slug: "amazon-relay", name: "Amazon Relay", logo: require("../assets/partners/amazon-relay.png"), status: "target", accent: "#FF9900" },
  { slug: "uber-freight", name: "Uber Freight", logo: require("../assets/partners/uber-freight.png"), status: "target", accent: "#000000" },
  { slug: "home-depot", name: "Home Depot", logo: require("../assets/partners/home-depot.png"), status: "target", accent: "#F96302" },
  { slug: "lowes", name: "Lowe's", logo: require("../assets/partners/lowes.png"), status: "target", accent: "#012169" },
  { slug: "north-park", name: "North Park Transportation", logo: require("../assets/partners/north-park.png"), status: "target", accent: "#123A6B" },
  { slug: "warp", name: "Warp", logo: require("../assets/partners/warp.png"), status: "target", accent: "#B8FF3C" },
  { slug: "dat", name: "DAT", logo: require("../assets/partners/dat.png"), status: "target", accent: "#0B3B75" },
  { slug: "truckstop", name: "Truckstop", logo: require("../assets/partners/truckstop.png"), status: "target", accent: "#00A44B" },
]);

/** Ids other surfaces use for a partner this directory names differently. */
const SLUG_ALIASES: Readonly<Record<string, string>> = {
  target: "target-carrier",
  chrobinson: "ch-robinson",
  jbhunt: "jb-hunt",
  uberfreight: "uber-freight",
  odfl: "old-dominion",
  nopk: "north-park",
  "estes-express": "estes",
};

function bySlug(slug: string): MobilePartner | null {
  return PARTNERS.find((partner) => partner.slug === slug) ?? null;
}

/** Resolve a slug or a known alias. */
export function findPartner(slug: string | null | undefined): MobilePartner | null {
  if (!slug) return null;
  return bySlug(slug) ?? bySlug(SLUG_ALIASES[slug] ?? "") ?? null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Map an integration row onto a partner.
 *
 * Integration ids are not always partner slugs: the demo fixtures use
 * `integration-target-edi` and `integration-target-production`, while the
 * partner-connection list uses bare ids like `ch-robinson` and `north-park`.
 * So the id is stripped of its `integration-` prefix and then shortened one
 * trailing segment at a time until something resolves — `target-edi` misses,
 * `target` hits the alias. Non-partner integrations such as `driver-gps`
 * exhaust their segments and correctly return null.
 *
 * Only if the id yields nothing does the display name get a look, matched by
 * containment so "C.H. Robinson Navisphere" still finds "C.H. Robinson".
 */
export function partnerForIntegration(
  id: string,
  name?: string,
): MobilePartner | null {
  const segments = id.replace(/^integration-/, "").split("-");
  for (let length = segments.length; length > 0; length -= 1) {
    const candidate = findPartner(segments.slice(0, length).join("-"));
    if (candidate) return candidate;
  }

  if (name) {
    const haystack = normalize(name);
    // Longest name first, so "C.H. Robinson" wins over a shorter prefix.
    const ranked = [...PARTNERS].sort((a, b) => b.name.length - a.name.length);
    const matched = ranked.find((partner) => haystack.includes(normalize(partner.name)));
    if (matched) return matched;
  }

  return null;
}

/** Up-to-two-letter monogram shown when a logo asset is unavailable. */
export function partnerMonogram(name: string): string {
  const words = name.split(/[\s.]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
