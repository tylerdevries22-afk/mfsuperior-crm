/**
 * Deterministic scoring rubric for Denver Metro freight leads. Sums to
 * 0-100; tier mapping ≥70 A, 45-69 B, 25-44 C, <25 drop.
 *
 * Each component maps to a column the existing xlsx parser
 * (src/lib/xlsx.ts:34) already recognizes — `toLeadInsert()` rolls them
 * into the lead's `notes` automatically.
 *
 * All inputs are derived from free signals (OSM tags + cheerio scrape +
 * node:dns MX). No paid APIs.
 */

import type { Business } from "./osm";
import { milesFromHq } from "./osm";

export type Industry =
  | "restaurants"
  | "bigbox"
  | "brokers"
  | "smallbiz"
  | "construction"
  | "cannabis";

export type EmailConfidence =
  | "high" // domain has own MX, not webmail/role
  | "medium" // free-webmail (gmail.com etc) but domain MX OK
  | "low" // role account (info@, support@) with valid MX
  | "none"; // no email at all OR rejected by MX

export type ScoreBreakdown = {
  boxFit: number;
  liftgate: number;
  volume: number;
  window: number;
  dmAccess: number;
  geoFit: number;
};

export type ScoreResult = {
  score: number;
  tier: "A" | "B" | "C" | null;
  breakdown: ScoreBreakdown;
  refrigerated: boolean;
};

/* ── Refrigeration heuristic (OSM tags) ──────────────────────────── */

const REFRIG_AMENITY = new Set(["restaurant", "cafe", "fast_food", "ice_cream", "pharmacy", "bar"]);
const REFRIG_SHOP = new Set([
  "bakery",
  "butcher",
  "deli",
  "supermarket",
  "convenience",
  "grocery",
  "florist",
  "medical_supply",
]);
const NON_REFRIG_SHOP = new Set([
  "department_store",
  "hardware",
  "doityourself",
  "furniture",
  "electronics",
  "wholesale",
  "car_parts",
  "trade",
]);

export function isRefrigerated(b: Business, industry: Industry): boolean {
  if (b.amenity && REFRIG_AMENITY.has(b.amenity)) return true;
  if (b.shop && REFRIG_SHOP.has(b.shop)) return true;
  if (b.shop && NON_REFRIG_SHOP.has(b.shop)) return false;
  if (industry === "restaurants") return true;
  return false;
}

/* ── Industry weight (BoxFit) ────────────────────────────────────── */

const INDUSTRY_WEIGHT: Record<Industry, number> = {
  brokers: 30,
  construction: 28, // contractor / supply yards run their own fleets, high freight value
  cannabis: 26, // dispensary + cultivation supply chain, high cadence
  restaurants: 25,
  smallbiz: 22,
  bigbox: 20,
};

/* ── Volume proxy: OSM tag richness ─────────────────────────────── */
// OSM doesn't have review counts, so we use tag richness as a proxy for
// "well-cataloged commercial entry". Businesses with rich tags tend to be
// real, established, and findable — proxies for size in absence of reviews.

function volumeFromTagCount(tagCount: number): number {
  if (tagCount >= 15) return 15;
  if (tagCount >= 10) return 10;
  if (tagCount >= 6) return 5;
  return 0;
}

/* ── Window: opening_hours present ──────────────────────────────── */

function windowFromHours(b: Business): number {
  return b.hasOpeningHours ? 8 : 0;
}

/* ── DM-access from email confidence ─────────────────────────────── */

const DM_ACCESS: Record<EmailConfidence, number> = {
  high: 15,
  medium: 8,
  low: 5,
  none: 0,
};

/* ── GeoFit: distance from MFS HQ ───────────────────────────────── */

function geoFitFromMiles(miles: number): number {
  if (miles < 15) return 20;
  if (miles < 30) return 10;
  if (miles < 50) return 5;
  return 0;
}

/* ── Final score ─────────────────────────────────────────────────── */

export function scoreLead(args: {
  business: Business;
  industry: Industry;
  emailConfidence: EmailConfidence;
}): ScoreResult {
  const { business, industry, emailConfidence } = args;
  const refrigerated = isRefrigerated(business, industry);

  const breakdown: ScoreBreakdown = {
    boxFit: INDUSTRY_WEIGHT[industry],
    liftgate: refrigerated ? 10 : 0,
    volume: volumeFromTagCount(business.tagCount),
    window: windowFromHours(business),
    dmAccess: DM_ACCESS[emailConfidence],
    geoFit: geoFitFromMiles(milesFromHq(business.lat, business.lon)),
  };

  const score =
    breakdown.boxFit +
    breakdown.liftgate +
    breakdown.volume +
    breakdown.window +
    breakdown.dmAccess +
    breakdown.geoFit;

  // Tier thresholds tuned for OSM's lower information density vs Places.
  const tier: "A" | "B" | "C" | null =
    score >= 70 ? "A" : score >= 45 ? "B" : score >= 25 ? "C" : null;

  return { score, tier, breakdown, refrigerated };
}

/* ── Helpers ─────────────────────────────────────────────────────── */

const VERTICAL_LABEL: Record<Industry, string> = {
  restaurants: "Restaurant",
  bigbox: "Big-box retail",
  brokers: "Freight broker / 3PL",
  smallbiz: "Small business",
  construction: "Construction / contractor",
  cannabis: "Cannabis (dispensary / cultivation)",
};

export function whyThisLead(args: {
  industry: Industry;
  city: string | null;
  refrigerated: boolean;
  miles: number;
  emailStatus: EmailConfidence;
  hasOpeningHours: boolean;
}): string {
  const fleet = args.refrigerated ? "refrigerated" : "dry";
  const milesPart = `HQ ${Math.round(args.miles)}mi away`;
  const emailLabel: Record<EmailConfidence, string> = {
    high: "verified (MX-checked, business domain)",
    medium: "free-webmail address (lower priority)",
    low: "role account (info@/support@)",
    none: "missing — needs manual",
  };
  const hoursPart = args.hasOpeningHours ? "hours listed" : "hours not listed";
  return `${VERTICAL_LABEL[args.industry]} in ${args.city ?? "Denver Metro"}; ${fleet} fleet match; ${hoursPart}; ${milesPart}; email ${emailLabel[args.emailStatus]}.`;
}

export const VERTICAL_FOR = VERTICAL_LABEL;

export const BIG_BOX_BRANDS = new Set(
  [
    "home depot",
    "lowe's",
    "lowes",
    "costco",
    "walmart",
    "target",
    "sam's club",
    "sams club",
    "best buy",
    "cracker barrel",
  ].map((s) => s.toLowerCase()),
);

export function isBigBoxChain(name: string): boolean {
  const lower = name.toLowerCase();
  for (const brand of BIG_BOX_BRANDS) {
    if (lower.includes(brand)) return true;
  }
  return false;
}
