/**
 * Deterministic scoring rubric for Denver Metro freight leads. Sums to
 * 0-100; tier mapping ≥75 A, 50-74 B, 30-49 C, <30 drop.
 *
 * Each component maps to a column the existing xlsx parser
 * (src/lib/xlsx.ts:34) already recognizes — when written to the workbook,
 * `toLeadInsert()` rolls them into the lead's `notes` automatically.
 */

import type { Place } from "./places";

export type Industry = "restaurants" | "bigbox" | "brokers" | "smallbiz";

export type EmailConfidence =
  | "valid" // Hunter verifier "valid"
  | "accept_all" // catch-all domain
  | "scraped" // pulled from website mailto:, not verified
  | "none"; // no email at all

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

/* ── Refrigeration heuristic ─────────────────────────────────────── */

const REFRIGERATED_TYPES = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "butcher_shop",
  "food_store",
  "grocery_store",
  "supermarket",
  "convenience_store",
  "florist",
  "pharmacy",
  "meal_takeaway",
  "meal_delivery",
  "ice_cream_shop",
]);

const NON_REFRIGERATED_TYPES = new Set([
  "home_improvement_store",
  "hardware_store",
  "furniture_store",
  "auto_parts_store",
  "electronics_store",
  "clothing_store",
  "department_store",
]);

export function isRefrigerated(place: Place, industry: Industry): boolean {
  const allTypes = new Set<string>([...(place.types ?? [])]);
  if (place.primaryType) allTypes.add(place.primaryType);
  for (const t of allTypes) {
    if (REFRIGERATED_TYPES.has(t)) return true;
    if (NON_REFRIGERATED_TYPES.has(t)) return false;
  }
  // Fall back to industry default — restaurants always refrig, brokers/big-box don't.
  if (industry === "restaurants") return true;
  return false;
}

/* ── Industry weight (BoxFit) ────────────────────────────────────── */

const INDUSTRY_WEIGHT: Record<Industry, number> = {
  brokers: 30,
  restaurants: 25,
  smallbiz: 22, // average across mfg/medical/auto-parts/grocery/construction
  bigbox: 20,
};

/* ── Volume tier from review count ───────────────────────────────── */

function volumeFromReviews(count: number | null | undefined): number {
  const n = count ?? 0;
  if (n >= 500) return 15;
  if (n >= 100) return 10;
  if (n >= 20) return 5;
  return 0;
}

/* ── Operating-hours signal ──────────────────────────────────────── */

function windowFromHours(place: Place): number {
  const hrs = place.regularOpeningHours;
  if (!hrs?.periods) return 0;
  // Periods array length 14 == open + close per day, full week.
  if (hrs.periods.length >= 14) return 10;
  if (hrs.periods.length > 0) return 5;
  return 0;
}

/* ── DM-access from email confidence ─────────────────────────────── */

const DM_ACCESS: Record<EmailConfidence, number> = {
  valid: 15,
  accept_all: 10,
  scraped: 8,
  none: 0,
};

/* ── Distance from MFS HQ (Aurora, CO 80017) ─────────────────────── */

const HQ_LAT = 39.6911;
const HQ_LNG = -104.8214;

export function milesFromHQ(lat: number | null, lng: number | null): number | null {
  if (lat == null || lng == null) return null;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R_MI = 3958.8;
  const dLat = toRad(lat - HQ_LAT);
  const dLng = toRad(lng - HQ_LNG);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(HQ_LAT)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return R_MI * 2 * Math.asin(Math.sqrt(a));
}

function geoFitFromMiles(miles: number | null): number {
  if (miles == null) return 0;
  if (miles < 15) return 20;
  if (miles < 30) return 10;
  if (miles < 50) return 5;
  return 0;
}

/* ── Final score ─────────────────────────────────────────────────── */

export function scoreLead(args: {
  place: Place;
  industry: Industry;
  emailConfidence: EmailConfidence;
}): ScoreResult {
  const { place, industry, emailConfidence } = args;
  const refrigerated = isRefrigerated(place, industry);

  const breakdown: ScoreBreakdown = {
    boxFit: INDUSTRY_WEIGHT[industry],
    liftgate: refrigerated ? 10 : 0,
    volume: volumeFromReviews(place.userRatingCount),
    window: windowFromHours(place),
    dmAccess: DM_ACCESS[emailConfidence],
    geoFit: geoFitFromMiles(milesFromHQ(place.location?.latitude ?? null, place.location?.longitude ?? null)),
  };

  const score =
    breakdown.boxFit +
    breakdown.liftgate +
    breakdown.volume +
    breakdown.window +
    breakdown.dmAccess +
    breakdown.geoFit;

  const tier: "A" | "B" | "C" | null =
    score >= 75 ? "A" : score >= 50 ? "B" : score >= 30 ? "C" : null;

  return { score, tier, breakdown, refrigerated };
}

/* ── Helpers shared with the writer ──────────────────────────────── */

export function whyThisLead(args: {
  industry: Industry;
  city: string | null;
  refrigerated: boolean;
  reviews: number | null | undefined;
  miles: number | null;
  emailStatus: EmailConfidence;
}): string {
  const verticalLabel: Record<Industry, string> = {
    restaurants: "Restaurant",
    bigbox: "Big-box retail",
    brokers: "Freight broker / 3PL",
    smallbiz: "Small business",
  };
  const fleet = args.refrigerated ? "refrigerated" : "dry";
  const reviews = args.reviews ?? 0;
  const milesPart =
    args.miles != null ? `HQ ${Math.round(args.miles)}mi away` : "distance unknown";
  const emailLabel: Record<EmailConfidence, string> = {
    valid: "verified",
    accept_all: "catch-all (likely valid)",
    scraped: "scraped (unverified)",
    none: "missing — needs manual",
  };
  return `${verticalLabel[args.industry]} in ${args.city ?? "Denver Metro"}; ${fleet} fleet match; ${reviews} reviews; ${milesPart}; email ${emailLabel[args.emailStatus]}.`;
}

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
