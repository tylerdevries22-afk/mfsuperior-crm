/**
 * OpenStreetMap Overpass API — completely free business discovery, no
 * key required. Uses Overpass QL queries scoped to Denver Metro county
 * bounding boxes.
 *
 * Endpoint: https://overpass-api.de/api/interpreter
 * Rate-limit guidance: 10k queries/day per IP. Be polite — we space
 * county queries with a 1.5s gap.
 */

import type { Industry } from "./score";

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  /** centroid for ways/relations, raw lat/lon for nodes */
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Shape we hand back to the orchestrator — designed to slot in where
 *  the previous Place type sat, so the rest of the pipeline reuses code. */
export type Business = {
  /** Synthetic stable id: `${type}/${id}` */
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** OSM tag values we already pulled for the scorer. */
  amenity?: string;
  shop?: string;
  industrial?: string;
  office?: string;
  craft?: string;
  building?: string;
  /** Address pieces */
  street: string | null;
  city: string | null;
  state: string | null;
  /** Free-text contact pieces from OSM */
  website: string | null;
  phone: string | null;
  email: string | null;
  /** Fixed indicator that an `opening_hours` tag exists (richness proxy). */
  hasOpeningHours: boolean;
  /** Raw tag count — soft signal of how well-cataloged the entry is. */
  tagCount: number;
};

/* ── County bounding boxes (south, west, north, east) ───────────── */

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

const BBOX: Record<County, [number, number, number, number]> = {
  // [south, west, north, east]
  Adams:      [39.79, -105.08, 40.05, -103.62],
  Arapahoe:   [39.55, -105.10, 39.79, -103.62],
  Boulder:    [39.91, -105.70, 40.27, -105.05],
  Broomfield: [39.91, -105.15, 40.00, -105.00],
  Denver:     [39.61, -105.11, 39.92, -104.60],
  Douglas:    [39.13, -105.32, 39.56, -104.55],
  Jefferson:  [39.50, -105.65, 40.00, -105.05],
};

/* ── Overpass QL fragments per industry ─────────────────────────── */

function queryForIndustry(industry: Industry, bbox: [number, number, number, number]): string {
  const bboxStr = bbox.join(","); // OSM expects "south,west,north,east"
  const filters = OSM_FILTERS[industry]
    .map((tag) => `  ${tag}(${bboxStr});`)
    .join("\n");
  return `
[out:json][timeout:60];
(
${filters}
);
out tags center;
`.trim();
}

const OSM_FILTERS: Record<Industry, string[]> = {
  restaurants: [
    'nwr["amenity"="restaurant"]',
    'nwr["amenity"="cafe"]',
    'nwr["amenity"="fast_food"]',
    'nwr["amenity"="bar"]',
    'nwr["amenity"="ice_cream"]',
    'nwr["shop"="bakery"]',
    'nwr["shop"="butcher"]',
    'nwr["shop"="deli"]',
  ],
  bigbox: [
    'nwr["shop"="department_store"]',
    'nwr["shop"="supermarket"]',
    'nwr["shop"="hardware"]',
    'nwr["shop"="doityourself"]',
    'nwr["shop"="furniture"]',
    'nwr["shop"="electronics"]',
    'nwr["shop"="wholesale"]',
  ],
  brokers: [
    'nwr["industrial"="warehouse"]',
    'nwr["office"="logistics"]',
    'nwr["amenity"="logistics"]',
    'nwr["building"="warehouse"]',
    // OSM coverage of freight brokers is thin; the warehouse tags are
    // the closest proxy. Operator can append manual rows separately.
  ],
  smallbiz: [
    'nwr["shop"="convenience"]',
    'nwr["shop"="grocery"]',
    'nwr["shop"="supermarket"]',
    'nwr["shop"="florist"]',
    'nwr["amenity"="pharmacy"]',
    'nwr["shop"="medical_supply"]',
    'nwr["shop"="car_parts"]',
    'nwr["shop"="trade"]',
    'nwr["industrial"="manufacturing"]',
    'nwr["craft"]',
    'nwr["office"="company"]',
  ],
};

/* ── HTTP ────────────────────────────────────────────────────────── */

// Public Overpass instances. Some block cloud-host IPs; we try in order
// until one returns 200. All are free, all serve the same data.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];
const USER_AGENT =
  "Mozilla/5.0 (compatible; MF-Superior-Lead-Research/1.0; +https://mfsuperiorproducts.com)";

export async function fetchOsmBusinesses(args: {
  industry: Industry;
  county: County;
  log?: (msg: string) => void;
}): Promise<Business[]> {
  const log = args.log ?? (() => {});
  const bbox = BBOX[args.county];
  const ql = queryForIndustry(args.industry, bbox);

  let json: { elements?: OsmElement[] } = {};
  let success = false;
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        body: new URLSearchParams({ data: ql }),
        // 3s per-endpoint cap. The CLI variant fits within Node's full
        // 90s budget anyway; the admin server-action variant must fit
        // inside Vercel Hobby's 10s function timeout, and the outer
        // generateLeadsAction caller also wraps this in a 4s Promise.race
        // for total OSM budget. With 4 endpoints × 3s = 12s worst case,
        // the outer race aborts first; whichever endpoint replies first
        // wins.
        signal: AbortSignal.timeout(3_000),
      });
      if (!res.ok) {
        log(
          `  ! Overpass ${res.status} on ${endpoint.replace("https://", "").split("/")[0]} for ${args.industry}/${args.county}`,
        );
        continue;
      }
      json = await res.json();
      success = true;
      break;
    } catch (err) {
      log(
        `  ! Overpass threw on ${endpoint.replace("https://", "").split("/")[0]} for ${args.industry}/${args.county}: ${(err as Error).message}`,
      );
      continue;
    }
  }
  if (!success) {
    log(`  ! All Overpass endpoints failed for ${args.industry}/${args.county}; skipping.`);
    return [];
  }

  const elements = json.elements ?? [];
  const businesses: Business[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = (tags.name ?? "").trim();
    if (!name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;

    businesses.push({
      id: `${el.type}/${el.id}`,
      name,
      lat,
      lon,
      amenity: tags.amenity,
      shop: tags.shop,
      industrial: tags.industrial,
      office: tags.office,
      craft: tags.craft,
      building: tags.building,
      street:
        [tags["addr:housenumber"], tags["addr:street"]]
          .filter(Boolean)
          .join(" ") || null,
      city: tags["addr:city"] ?? null,
      state: tags["addr:state"] ?? null,
      website: normalizeUrl(tags.website ?? tags["contact:website"]),
      phone: tags.phone ?? tags["contact:phone"] ?? null,
      email: tags.email ?? tags["contact:email"] ?? null,
      hasOpeningHours: typeof tags.opening_hours === "string" && tags.opening_hours.length > 0,
      tagCount: Object.keys(tags).length,
    });
  }
  return businesses;
}

function normalizeUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

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

/* ── Haversine (HQ at Aurora, CO 80017) ────────────────────────── */

const HQ_LAT = 39.6911;
const HQ_LNG = -104.8214;

export function milesFromHq(lat: number, lon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat - HQ_LAT);
  const dLng = toRad(lon - HQ_LNG);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(HQ_LAT)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}
