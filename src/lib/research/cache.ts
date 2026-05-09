/**
 * .cache/lead-research.json — local-only state so re-runs don't reprocess
 * the same Place IDs and don't lose track of Hunter monthly usage on
 * restart.
 *
 * NOT committed (added to .gitignore). Safe to delete; the script just
 * starts fresh.
 */

import fs from "node:fs";
import path from "node:path";

export type CacheShape = {
  /** Set of Place IDs we've already enriched + persisted. */
  seenPlaceIds: string[];
  /** Hunter usage counter, reset on month rollover. */
  hunterUsage: { month: string; searches: number; verifications: number };
  /** Raw enrichment results keyed by placeId for diagnostics. */
  results: Record<
    string,
    {
      placeId: string;
      companyName: string;
      tier: "A" | "B" | "C" | null;
      score: number;
      ts: string;
    }
  >;
};

function emptyCache(): CacheShape {
  return {
    seenPlaceIds: [],
    hunterUsage: { month: currentMonth(), searches: 0, verifications: 0 },
    results: {},
  };
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const CACHE_PATH = path.resolve(process.cwd(), ".cache/lead-research.json");

export function loadCache(): CacheShape {
  if (!fs.existsSync(CACHE_PATH)) return emptyCache();
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as CacheShape;
    // Roll over month if needed.
    const m = currentMonth();
    if (raw.hunterUsage?.month !== m) {
      raw.hunterUsage = { month: m, searches: 0, verifications: 0 };
    }
    return raw;
  } catch {
    return emptyCache();
  }
}

export function saveCache(cache: CacheShape): void {
  // On Vercel's serverless functions the filesystem is read-only at
  // runtime — mkdirSync throws EROFS. Swallow the error: the DB
  // unique indexes on (email) and (companyName, email IS NULL) handle
  // dedup at insert time, so a missing on-disk cache just means we
  // re-discover the same curated entries next click and the upsert
  // path no-ops on conflict.
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch {
    // EROFS / EACCES on serverless. Intentional silent fallback.
  }
}
