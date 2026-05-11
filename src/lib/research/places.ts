/**
 * Google Places API (New) — Text Search v1.
 *
 * Endpoint: POST https://places.googleapis.com/v1/places:searchText
 * Auth:     X-Goog-Api-Key header
 * Field mask is mandatory — we request only what the scorer + writer need.
 */

import type { Industry } from "./score";

export type Place = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { periods?: unknown[] };
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "nextPageToken",
].join(",");

export const COUNTIES = [
  "Adams",
  "Arapahoe",
  "Boulder",
  "Broomfield",
  "Denver",
  "Douglas",
  "Jefferson",
] as const;

export type County = (typeof COUNTIES)[number];

type Query = { textQuery: string; includedType?: string };

export const QUERIES_BY_INDUSTRY: Record<Industry, (county: County) => Query[]> = {
  restaurants: (c) => [
    { textQuery: `restaurants in ${c} County, CO`, includedType: "restaurant" },
    { textQuery: `cafes in ${c} County, CO`, includedType: "cafe" },
    { textQuery: `bakeries in ${c} County, CO`, includedType: "bakery" },
    { textQuery: `catering services in ${c} County, CO` },
    { textQuery: `butcher shops in ${c} County, CO` },
  ],
  bigbox: (c) => [
    { textQuery: `Home Depot in ${c} County, CO` },
    { textQuery: `Lowe's in ${c} County, CO` },
    { textQuery: `Costco in ${c} County, CO` },
    { textQuery: `Walmart Supercenter in ${c} County, CO` },
    { textQuery: `Target in ${c} County, CO` },
    { textQuery: `Sam's Club in ${c} County, CO` },
    { textQuery: `Best Buy in ${c} County, CO` },
    { textQuery: `Cracker Barrel in ${c} County, CO` },
  ],
  brokers: (c) => [
    { textQuery: `freight broker in ${c} County, CO` },
    { textQuery: `third party logistics warehouse in ${c} County, CO` },
    { textQuery: `trucking company in ${c} County, CO` },
  ],
  smallbiz: (c) => [
    { textQuery: `manufacturer in ${c} County, CO` },
    { textQuery: `medical supply in ${c} County, CO` },
    { textQuery: `auto parts wholesale in ${c} County, CO` },
    { textQuery: `grocery store in ${c} County, CO`, includedType: "grocery_store" },
  ],
  construction: (c) => [
    { textQuery: `general contractor in ${c} County, CO` },
    { textQuery: `lumber yard in ${c} County, CO` },
    { textQuery: `electrical supply in ${c} County, CO` },
    { textQuery: `plumbing supply in ${c} County, CO` },
    { textQuery: `cabinet shop in ${c} County, CO` },
    { textQuery: `roofing contractor in ${c} County, CO` },
    { textQuery: `building materials in ${c} County, CO` },
    { textQuery: `concrete supplier in ${c} County, CO` },
  ],
  cannabis: (c) => [
    { textQuery: `dispensary in ${c} County, CO` },
    { textQuery: `cannabis cultivation in ${c} County, CO` },
    { textQuery: `marijuana dispensary in ${c} County, CO` },
    { textQuery: `cannabis distributor in ${c} County, CO` },
  ],
};

/* ── HTTP ────────────────────────────────────────────────────────── */

type SearchResponse = {
  places?: Place[];
  nextPageToken?: string;
};

async function searchOnce(args: {
  apiKey: string;
  textQuery: string;
  includedType?: string;
  pageToken?: string;
}): Promise<SearchResponse> {
  const body: Record<string, unknown> = { textQuery: args.textQuery };
  if (args.includedType) body.includedType = args.includedType;
  if (args.pageToken) body.pageToken = args.pageToken;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": args.apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as SearchResponse;
}

/**
 * Run all queries for an (industry × county) tuple, follow nextPageToken
 * up to 3 pages (60 results max per query), dedupe by Place.id.
 */
export async function discoverPlaces(args: {
  apiKey: string;
  industry: Industry;
  county: County;
  /** Skip Place.ids already seen (e.g. from cache). */
  excludeIds?: Set<string>;
  /** Per-query page cap. Default 3. */
  maxPages?: number;
  /** Slow logger for visibility. */
  log?: (msg: string) => void;
}): Promise<Array<{ place: Place; industry: Industry; county: County }>> {
  const exclude = args.excludeIds ?? new Set<string>();
  const maxPages = args.maxPages ?? 3;
  const seen = new Set<string>(exclude);
  const out: Array<{ place: Place; industry: Industry; county: County }> = [];

  for (const q of QUERIES_BY_INDUSTRY[args.industry](args.county)) {
    let pageToken: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      let resp: SearchResponse;
      try {
        resp = await searchOnce({
          apiKey: args.apiKey,
          textQuery: q.textQuery,
          includedType: q.includedType,
          pageToken,
        });
      } catch (err) {
        args.log?.(`  ! Places error on "${q.textQuery}" pg${page}: ${(err as Error).message}`);
        break;
      }

      const places = resp.places ?? [];
      for (const p of places) {
        if (!p.id) continue;
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push({ place: p, industry: args.industry, county: args.county });
      }

      args.log?.(
        `  + ${args.industry}/${args.county} "${q.textQuery}" pg${page} → ${places.length} (total ${out.length})`,
      );

      if (!resp.nextPageToken) break;
      pageToken = resp.nextPageToken;
      // Google requires a short pause before nextPageToken becomes valid.
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return out;
}

/* ── URL → registrable domain ────────────────────────────────────── */

export function rootDomain(websiteUri: string | undefined | null): string | null {
  if (!websiteUri) return null;
  try {
    const u = new URL(websiteUri);
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host || null;
  } catch {
    return null;
  }
}

/* ── Address parsing helpers ────────────────────────────────────── */

export function splitAddress(formatted: string | undefined): {
  street: string | null;
  city: string | null;
  state: string | null;
} {
  if (!formatted) return { street: null, city: null, state: null };
  // Typical: "1234 Elm St, Denver, CO 80202, USA"
  const parts = formatted.split(",").map((s) => s.trim());
  if (parts.length < 3) return { street: parts[0] ?? null, city: null, state: null };
  const street = parts[0];
  const city = parts[1] ?? null;
  const stateZip = parts[2] ?? "";
  const state = (stateZip.match(/\b([A-Z]{2})\b/)?.[1] ?? null) as string | null;
  return { street, city, state };
}
