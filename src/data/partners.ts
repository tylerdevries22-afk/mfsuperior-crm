/**
 * Partner directory — the single source of truth for every logo the app
 * renders. `status` splits the book into partners MF Superior already hauls
 * for (`active`) and the ones sales is working toward (`target`).
 *
 * Logo files live in `public/partners/` (see the README there for format and
 * provenance). Swapping in an official press-kit asset is a one-line change
 * to `logo` — no surface reads a logo path from anywhere else.
 *
 * Operator edits made through Admin → Partners (status flips, uploaded
 * logos) are layered on top of this seed at runtime by
 * `src/lib/partners/store.ts`; this file stays the committed baseline.
 */

export type PartnerStatus = "active" | "target";

export type PartnerCategory =
  | "retailer-program"
  | "broker"
  | "final-mile"
  | "same-day-app"
  | "ltl"
  | "load-board"
  | "marketing";

export interface Partner {
  /** URL-safe id. Stored on `shipments.partner_slug`. */
  slug: string;
  name: string;
  /** Path under `public/`, e.g. `/partners/rxo.svg`. */
  logo: string;
  status: PartnerStatus;
  category: PartnerCategory;
  /**
   * Brand colour, used for the monogram fallback when a logo file is missing
   * and for the "Revenue by partner" series. Optional — `PARTNER_FALLBACK_ACCENT`
   * covers partners added through the admin upload field.
   */
  accent?: string;
}

export const PARTNER_CATEGORY_LABELS: Record<PartnerCategory, string> = {
  "retailer-program": "Retailer program",
  broker: "Broker",
  "final-mile": "Final mile",
  "same-day-app": "Same-day app",
  ltl: "LTL",
  "load-board": "Load board",
  marketing: "Marketing",
};

export const PARTNER_CATEGORIES = Object.keys(
  PARTNER_CATEGORY_LABELS,
) as PartnerCategory[];

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  active: "Active",
  target: "Target",
};

/** Accent for partners with no brand colour on file (admin uploads). */
export const PARTNER_FALLBACK_ACCENT = "#64748B";

export const PARTNERS: readonly Partner[] = [
  /* ── Active ─────────────────────────────────────────────────── */
  {
    slug: "target-carrier",
    name: "Target Carrier",
    logo: "/partners/target-carrier.svg",
    status: "active",
    category: "retailer-program",
    accent: "#CC0000",
  },
  {
    slug: "ch-robinson",
    name: "C.H. Robinson",
    logo: "/partners/ch-robinson.svg",
    status: "active",
    category: "broker",
    accent: "#00A0DF",
  },

  /* ── Target ─────────────────────────────────────────────────── */
  {
    slug: "rxo",
    name: "RXO",
    logo: "/partners/rxo.svg",
    status: "target",
    category: "broker",
    accent: "#00F49C",
  },
  {
    slug: "jb-hunt",
    name: "J.B. Hunt",
    logo: "/partners/jb-hunt.svg",
    status: "target",
    category: "broker",
    accent: "#FFDB00",
  },
  {
    slug: "curri",
    name: "Curri",
    logo: "/partners/curri.svg",
    status: "target",
    category: "final-mile",
    accent: "#00C2B2",
  },
  {
    slug: "frayt",
    name: "FRAYT",
    logo: "/partners/frayt.svg",
    status: "target",
    category: "final-mile",
    accent: "#0B5FFF",
  },
  {
    slug: "goshare",
    name: "GoShare",
    logo: "/partners/goshare.svg",
    status: "target",
    category: "same-day-app",
    accent: "#0072CE",
  },
  {
    slug: "roadie",
    name: "Roadie",
    logo: "/partners/roadie.svg",
    status: "target",
    category: "same-day-app",
    accent: "#F5C518",
  },
  {
    slug: "xpo",
    name: "XPO",
    logo: "/partners/xpo.svg",
    status: "target",
    category: "ltl",
    accent: "#CC0000",
  },
  {
    slug: "estes",
    name: "Estes Express Lines",
    logo: "/partners/estes.svg",
    status: "target",
    category: "ltl",
    accent: "#D3141B",
  },
  {
    slug: "old-dominion",
    name: "Old Dominion",
    logo: "/partners/old-dominion.svg",
    status: "target",
    category: "ltl",
    accent: "#186944",
  },
  {
    slug: "amazon-relay",
    name: "Amazon Relay",
    logo: "/partners/amazon-relay.svg",
    status: "target",
    category: "broker",
    accent: "#FF9900",
  },
  {
    slug: "uber-freight",
    name: "Uber Freight",
    logo: "/partners/uber-freight.svg",
    status: "target",
    category: "broker",
    accent: "#000000",
  },
  {
    slug: "home-depot",
    name: "Home Depot",
    logo: "/partners/home-depot.svg",
    status: "target",
    category: "retailer-program",
    accent: "#F96302",
  },
  {
    slug: "lowes",
    name: "Lowe's",
    logo: "/partners/lowes.svg",
    status: "target",
    category: "retailer-program",
    accent: "#012169",
  },
  {
    slug: "north-park",
    name: "North Park Transportation",
    logo: "/partners/north-park.svg",
    status: "target",
    category: "ltl",
    accent: "#123A6B",
  },
  {
    slug: "warp",
    name: "Warp",
    logo: "/partners/warp.svg",
    status: "target",
    category: "broker",
    accent: "#B8FF3C",
  },
  {
    slug: "dat",
    name: "DAT",
    logo: "/partners/dat.svg",
    status: "target",
    category: "load-board",
    accent: "#0B3B75",
  },
  {
    slug: "truckstop",
    name: "Truckstop",
    logo: "/partners/truckstop.svg",
    status: "target",
    category: "load-board",
    accent: "#00A44B",
  },
];

/* ── Lookup helpers ───────────────────────────────────────────── */

/**
 * Ids other surfaces already use for a partner this directory names
 * differently. The mobile connections list calls Target's program `target`
 * where the directory calls it `target-carrier`; rather than force a rename on
 * either side, `findPartner` resolves through here first.
 *
 * Keep this small — it exists for identifiers already in the wild, not as a
 * general naming escape hatch.
 */
export const PARTNER_SLUG_ALIASES: Readonly<Record<string, string>> = {
  target: "target-carrier",
  "target-corporation": "target-carrier",
  chrobinson: "ch-robinson",
  "jb-hunt-360": "jb-hunt",
  jbhunt: "jb-hunt",
  uberfreight: "uber-freight",
  "old-dominion-freight-line": "old-dominion",
  odfl: "old-dominion",
  "estes-express": "estes",
  "estes-express-lines": "estes",
  "home-depot-supply": "home-depot",
  lowe: "lowes",
  "truckstop-com": "truckstop",
  nopk: "north-park",
  "north-park-transportation": "north-park",
};

/** Canonical slug for an id that may be an alias. */
export function canonicalPartnerSlug(slug: string): string {
  return PARTNER_SLUG_ALIASES[slug] ?? slug;
}

/**
 * Resolve a slug against a partner list. Callers that render operator-editable
 * data pass the runtime list from `listPartners()`; callers that only need the
 * committed seed can omit it.
 */
export function findPartner(
  slug: string | null | undefined,
  partners: readonly Partner[] = PARTNERS,
): Partner | null {
  if (!slug) return null;
  const exact = partners.find((partner) => partner.slug === slug);
  if (exact) return exact;
  const canonical = canonicalPartnerSlug(slug);
  if (canonical === slug) return null;
  return partners.find((partner) => partner.slug === canonical) ?? null;
}

/** Brand colour for a partner, falling back to a neutral slate. */
export function partnerAccent(partner: Partner | null): string {
  return partner?.accent ?? PARTNER_FALLBACK_ACCENT;
}

/**
 * Up-to-two-letter monogram used when a logo file 404s. Multi-word names give
 * initials ("Home Depot" → "HD"); single words give their first two letters.
 */
export function partnerMonogram(name: string): string {
  const words = name.split(/[\s.]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Slugify a partner name typed into the admin upload form. */
export function partnerSlugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Active partners first, then alphabetical within each status. */
export function sortPartners(partners: readonly Partner[]): Partner[] {
  return [...partners].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
