/**
 * Shared lead-research orchestrator. Used by:
 *   - `scripts/research-leads.ts` (CLI, writes xlsx+csv too)
 *   - `src/app/(app)/admin/research-actions.ts` (server actions for the
 *     /admin "Run free research" / "Run paid research" buttons)
 *
 * Two modes that share scoring + output + DB-upsert:
 *   - "free" — OSM Overpass discovery + cheerio scrape + node:dns MX
 *   - "paid" — Google Places API + Hunter domain-search + verifier
 */

import { parsePhoneNumberFromString } from "libphonenumber-js";
import { CURATED_DENVER, type CuratedEntry } from "./curated-denver";
import {
  fetchOsmBusinesses,
  rootDomain,
  milesFromHq,
  COUNTIES as OSM_COUNTIES,
  type Business,
  type County,
} from "./osm";
import { scrapeDomainForContacts, pickBestScrapedContact } from "./scrape";
import { validateEmail, probeCommonEmails } from "./mx-validate";
import {
  HunterClient,
  pickBestContact,
  type Budget,
  type HunterEmail,
} from "./hunter";
import {
  discoverPlaces,
  splitAddress,
  type Place,
} from "./places";
import {
  scoreLead,
  whyThisLead,
  isBigBoxChain,
  VERTICAL_FOR,
  type Industry,
  type EmailConfidence,
} from "./score";
import { loadCache, saveCache, currentMonth, type CacheShape } from "./cache";
import type { EnrichedRow } from "./output";
import type { Db } from "@/lib/leads/upsert";
import { upsertLead } from "@/lib/leads/upsert";
import { auditLog } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export type RunMode = "free" | "paid";

export type RunOptions = {
  mode: RunMode;
  limit: number;
  industries: Industry[];
  counties: County[];
  /** Cap per (industry, county) pair; default 80. */
  maxPerCounty?: number;
  /** Hunter monthly budget (paid mode only); default 25. */
  hunterBudget?: number;
  /** When true, ignore the on-disk cache. */
  noCache?: boolean;
  /**
   * Fast mode: skip OSM Overpass entirely, take exactly `limit` curated
   * entries, and skip the per-domain web scrape (probeCommonEmails
   * directly). Designed for the /admin server-action button on Vercel
   * Hobby (10s function timeout).
   */
  fast?: boolean;
  /** Drizzle DB; when undefined, the upsert step is skipped. */
  db?: Db;
  /** Source string written into leads.source. */
  sourceLabel?: string;
  /** Logging hook. */
  log?: (msg: string) => void;
};

export type RunReport = {
  mode: RunMode;
  discovered: number;
  fromCache: number;
  enriched: number;
  tierA: number;
  tierB: number;
  tierC: number;
  refrigerated: number;
  bigboxChain: number;
  needsManualEmail: number;
  emailUnverified: number;
  freemail: number;
  roleAccount: number;
  catchAll: number;
  dropped: number;
  inserted: number;
  updated: number;
  conflicts: number;
  hunterSearches: number;
  hunterVerifications: number;
  notes: string[];
  /** Final, ranked rows. Caller writes them to xlsx if it wants. */
  rows: EnrichedRow[];
};

/* ── Helpers ─────────────────────────────────────────────────────── */

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, "US");
  if (!parsed?.isValid()) return null;
  return parsed.format("E.164");
}

function rowToLeadInsert(row: EnrichedRow, source: string) {
  const tags: string[] = [`tier-${row.tier}`, row.category];
  if (/refrigerated/.test(row.whyThisLead)) tags.push("refrigerated");
  if (/needs manual/.test(row.whyThisLead)) tags.push("needs-manual-email");
  if (/free-webmail/.test(row.whyThisLead)) tags.push("freemail");
  if (/role account/.test(row.whyThisLead)) tags.push("role-account");
  if (/scraped \(unverified\)/.test(row.whyThisLead)) tags.push("email-unverified");
  if (/catch-all/.test(row.whyThisLead)) tags.push("catch-all");
  if (/chain-store/.test(row.whyThisLead)) tags.push("chain-store");
  if (/email-guessed/.test(row.whyThisLead)) tags.push("email-guessed");
  if (/tier-untriaged/.test(row.whyThisLead)) tags.push("tier-untriaged");

  const breakdownLine =
    `Score breakdown — ` +
    [
      ["BoxFit", row.breakdown.boxFit],
      ["Liftgate", row.breakdown.liftgate],
      ["Volume", row.breakdown.volume],
      ["Window", row.breakdown.window],
      ["DM Access", row.breakdown.dmAccess],
      ["Geo Fit", row.breakdown.geoFit],
    ]
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ") +
    ".";

  return {
    email: row.email,
    phone: row.phone,
    companyName: row.companyName,
    website: row.website,
    vertical: row.category,
    address: row.address,
    city: row.city,
    state: row.state,
    source,
    tier: row.tier,
    score: row.score,
    tags,
    notes: `${row.whyThisLead}\n\n${breakdownLine}`,
  };
}

/* ── Place → Business adapter (so scoring is mode-agnostic) ─────── */

function placeToBusiness(p: Place): Business {
  const id = p.id;
  const name = p.displayName?.text?.trim() ?? "";
  const addr = splitAddress(p.formattedAddress);
  const types = new Set([...(p.types ?? []), p.primaryType ?? ""]);
  // Map Places types loosely onto OSM amenity/shop slots so the scorer's
  // refrigeration table keeps working.
  let amenity: string | undefined;
  let shop: string | undefined;
  if (types.has("restaurant")) amenity = "restaurant";
  else if (types.has("cafe")) amenity = "cafe";
  else if (types.has("bakery")) shop = "bakery";
  else if (types.has("butcher_shop")) shop = "butcher";
  else if (types.has("grocery_store") || types.has("supermarket")) shop = "supermarket";
  else if (types.has("pharmacy")) amenity = "pharmacy";
  else if (types.has("home_improvement_store")) shop = "hardware";
  else if (types.has("furniture_store")) shop = "furniture";
  else if (types.has("electronics_store")) shop = "electronics";

  return {
    id,
    name,
    lat: p.location?.latitude ?? 0,
    lon: p.location?.longitude ?? 0,
    amenity,
    shop,
    industrial: undefined,
    office: undefined,
    craft: undefined,
    building: undefined,
    street: addr.street,
    city: addr.city,
    state: addr.state,
    website: p.websiteUri ?? null,
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    email: null,
    hasOpeningHours: !!p.regularOpeningHours,
    // Use review count as the volume proxy in paid mode by encoding it in
    // tagCount range (15+ ratings ≈ rich entry).
    tagCount: ratingCountToTagProxy(p.userRatingCount),
  };
}

function ratingCountToTagProxy(n: number | undefined): number {
  if (!n) return 0;
  if (n >= 500) return 18;
  if (n >= 100) return 12;
  if (n >= 20) return 8;
  return 4;
}

/* ── Discovery dispatchers ───────────────────────────────────────── */

/* ── Curated → Business adapter ─────────────────────────────────── */

// Denver Metro centroid; used as a placeholder for curated entries that
// don't carry a specific store address. Geo-fit scoring still works (it's
// "in metro" by definition, contributing the in-county bonus).
const DENVER_METRO_LAT = 39.74;
const DENVER_METRO_LNG = -104.99;

function curatedToBusiness(c: CuratedEntry): Business {
  return {
    id: `curated/${c.domain}`,
    name: c.name,
    lat: DENVER_METRO_LAT,
    lon: DENVER_METRO_LNG,
    amenity: c.industry === "restaurants" ? "restaurant" : undefined,
    shop:
      c.industry === "bigbox"
        ? "department_store"
        : c.refrigerated && c.industry === "smallbiz"
          ? "supermarket"
          : undefined,
    industrial: c.industry === "brokers" ? "warehouse" : undefined,
    office: c.industry === "brokers" ? "logistics" : undefined,
    craft: undefined,
    building: undefined,
    street: null,
    city: "Denver Metro",
    state: "CO",
    website: `https://${c.domain}`,
    phone: null,
    email: null,
    hasOpeningHours: false,
    // Boost tagCount so curated entries clear the volume threshold; they
    // are nationally-known chains by definition.
    tagCount: 12,
  };
}

async function discoverFree(args: {
  industries: Industry[];
  counties: County[];
  excludeIds: Set<string>;
  maxPerCounty: number;
  /** Stop discovery once we have at least this many candidates. */
  earlyExitTarget?: number;
  log: (msg: string) => void;
}): Promise<Array<{ business: Business; industry: Industry; county: County }>> {
  const out: Array<{ business: Business; industry: Industry; county: County }> = [];

  // 1. Curated seed — guaranteed source. Always available regardless of
  //    Vercel/sandbox outbound restrictions on Overpass.
  const curatedSelected = CURATED_DENVER.filter((c) =>
    args.industries.includes(c.industry),
  );
  for (const c of curatedSelected) {
    const business = curatedToBusiness(c);
    if (args.excludeIds.has(business.id)) continue;
    args.excludeIds.add(business.id);
    out.push({ business, industry: c.industry, county: "Denver" });
    if (args.earlyExitTarget && out.length >= args.earlyExitTarget) {
      args.log(`  → curated-only: ${out.length} candidates (target ${args.earlyExitTarget})`);
      return out;
    }
  }
  args.log(`  + curated: ${curatedSelected.length} entries seeded (${out.length} new)`);

  // 2. OSM Overpass — supplemental. Best-effort; failures are tolerated
  //    silently because curated already gave us a usable baseline.
  for (const county of args.counties) {
    for (const industry of args.industries) {
      if (args.earlyExitTarget && out.length >= args.earlyExitTarget) {
        args.log(`  → early-exit: have ${out.length} candidates, target ${args.earlyExitTarget}`);
        return out;
      }
      const list = await fetchOsmBusinesses({ industry, county, log: args.log });
      let added = 0;
      for (const b of list) {
        if (args.excludeIds.has(b.id)) continue;
        if (added >= args.maxPerCounty) break;
        args.excludeIds.add(b.id);
        out.push({ business: b, industry, county });
        added++;
      }
      args.log(`  + ${industry}/${county}: ${list.length} found, ${added} new (running total ${out.length})`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return out;
}

async function discoverPaid(args: {
  apiKey: string;
  industries: Industry[];
  counties: County[];
  excludeIds: Set<string>;
  log: (msg: string) => void;
}): Promise<Array<{ business: Business; industry: Industry; county: County }>> {
  const out: Array<{ business: Business; industry: Industry; county: County }> = [];
  for (const county of args.counties) {
    for (const industry of args.industries) {
      try {
        const found = await discoverPlaces({
          apiKey: args.apiKey,
          industry,
          county,
          excludeIds: args.excludeIds,
          log: args.log,
        });
        for (const f of found) {
          out.push({
            business: placeToBusiness(f.place),
            industry: f.industry,
            county: f.county,
          });
        }
      } catch (err) {
        args.log(`  ! ${industry}/${county} discovery failed: ${(err as Error).message}`);
      }
    }
  }
  return out;
}

/* ── Email enrichment dispatchers ────────────────────────────────── */

type EmailOutcome = {
  email: string | null;
  confidence: EmailConfidence;
  /** Free-form annotations to bake into whyThisLead. */
  annotations: string[];
};

async function enrichFree(
  business: Business,
  log: (m: string) => void,
  opts: { fast?: boolean } = {},
): Promise<EmailOutcome> {
  const out: EmailOutcome = { email: null, confidence: "none", annotations: [] };
  if (isBigBoxChain(business.name)) {
    out.annotations.push("chain-store — corporate contact only");
  }

  // 1. OSM may already carry an email.
  if (business.email) {
    const v = await validateEmail(business.email);
    if (v.confidence !== "rejected") {
      out.email = v.email;
      if (v.confidence === "high") out.confidence = "high";
      else if (v.confidence === "medium") {
        out.confidence = "medium";
        out.annotations.push("free-webmail address (lower priority)");
      } else if (v.confidence === "low") {
        out.confidence = "low";
        out.annotations.push("role account");
      }
      return out;
    }
  }

  const domain = rootDomain(business.website);
  if (domain) {
    // 2. Scrape website for mailto: links. Skipped in fast mode (each
    //    scrape can take 5-30s — too slow for the /admin button on
    //    Vercel Hobby's 10s function timeout).
    if (!opts.fast) {
      try {
        const scraped = await scrapeDomainForContacts(domain, log);
        const pick = pickBestScrapedContact(scraped);
        if (pick) {
          const v = await validateEmail(pick.email);
          if (v.confidence !== "rejected") {
            out.email = v.email;
            if (v.confidence === "high") out.confidence = "high";
            else if (v.confidence === "medium") {
              out.confidence = "medium";
              out.annotations.push("free-webmail address (lower priority)");
            } else {
              out.confidence = "low";
              out.annotations.push("role account");
            }
            return out;
          }
        }
      } catch (err) {
        log(`    ! scrape failed on ${domain}: ${(err as Error).message}`);
      }
    }

    // 3. Common-pattern probe (always runs — fast DNS MX lookup, ~50ms).
    //    If the domain has MX, guess `info@domain`. For B2B small biz
    //    this is the right address ~80% of the time. Tag email-guessed
    //    so the operator can backfill if a real address surfaces later.
    try {
      const probe = await probeCommonEmails(domain);
      if (probe) {
        out.email = probe.email;
        out.confidence = "low";
        out.annotations.push("email-guessed");
        return out;
      }
    } catch (err) {
      log(`    ! probe failed on ${domain}: ${(err as Error).message}`);
    }
  }

  out.annotations.push("needs-manual-email");
  return out;
}

async function enrichPaid(
  business: Business,
  hunter: HunterClient,
  log: (m: string) => void,
): Promise<EmailOutcome> {
  const out: EmailOutcome = { email: null, confidence: "none", annotations: [] };
  if (isBigBoxChain(business.name)) {
    out.annotations.push("chain-store — route via corporate procurement.");
    return out;
  }
  const domain = rootDomain(business.website);
  if (!domain) {
    out.annotations.push("needs-manual-email");
    return out;
  }

  let chosen: HunterEmail | null = null;
  const ds = await hunter.domainSearch(domain);
  if (ds) chosen = pickBestContact(ds.emails);

  if (chosen?.value) {
    const ver = await hunter.verify(chosen.value.toLowerCase());
    if (ver?.status === "valid") {
      out.email = chosen.value.toLowerCase();
      out.confidence = "high";
      return out;
    }
    if (ver?.status === "accept_all") {
      out.email = chosen.value.toLowerCase();
      out.confidence = "medium";
      out.annotations.push("catch-all");
      return out;
    }
    out.annotations.push("email-unverified");
  }

  // Fallback to scrape if Hunter found nothing or it didn't verify.
  try {
    const scraped = await scrapeDomainForContacts(domain, log);
    const pick = pickBestScrapedContact(scraped);
    if (pick) {
      out.email = pick.email;
      out.confidence = "low";
      out.annotations.push("scraped (unverified)");
      return out;
    }
  } catch (err) {
    log(`    ! scrape failed on ${domain}: ${(err as Error).message}`);
  }
  out.annotations.push("needs-manual-email");
  return out;
}

/* ── Run ──────────────────────────────────────────────────────────── */

export async function runResearch(opts: RunOptions): Promise<RunReport> {
  const log = opts.log ?? (() => {});
  const maxPerCounty = opts.maxPerCounty ?? 80;
  const sourceLabel = opts.sourceLabel ?? `research-${opts.mode}`;

  const cache: CacheShape = opts.noCache
    ? {
        seenPlaceIds: [],
        hunterUsage: { month: currentMonth(), searches: 0, verifications: 0 },
        results: {},
      }
    : loadCache();
  const seenIds = new Set<string>(cache.seenPlaceIds);

  log(`=== research-leads (mode=${opts.mode}) ===`);
  log(
    `industries: ${opts.industries.join(",")}  counties: ${opts.counties.join(",")}  limit: ${opts.limit}`,
  );

  /* ─── 1. Discovery ─── */

  log("\n[1/3] Discovery…");
  let candidates: Array<{ business: Business; industry: Industry; county: County }> = [];

  if (opts.mode === "free") {
    if (opts.fast) {
      // Fast path: just take the first N curated entries that match the
      // selected industries and aren't in the cache. Skips OSM entirely.
      const wanted = opts.industries;
      const picked: typeof candidates = [];
      for (const c of CURATED_DENVER) {
        if (!wanted.includes(c.industry)) continue;
        const business = curatedToBusiness(c);
        if (seenIds.has(business.id)) continue;
        seenIds.add(business.id);
        picked.push({ business, industry: c.industry, county: "Denver" });
        if (picked.length >= opts.limit) break;
      }
      candidates = picked;
      log(`  + fast curated: ${candidates.length} entries`);
    } else {
      candidates = await discoverFree({
        industries: opts.industries,
        counties: opts.counties,
        excludeIds: seenIds,
        maxPerCounty,
        earlyExitTarget: Math.max(opts.limit * 3, 30),
        log,
      });
    }
  } else {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is required for paid mode");
    candidates = await discoverPaid({
      apiKey,
      industries: opts.industries,
      counties: opts.counties,
      excludeIds: seenIds,
      log,
    });
  }

  log(
    `  → ${candidates.length} candidates after dedupe (cache had ${cache.seenPlaceIds.length} prior).`,
  );

  /* ─── 2. Enrichment ─── */

  log("\n[2/3] Enrichment + scoring…");

  // Sort candidates: prefer those with website + email + tag richness up front.
  candidates.sort((a, b) => {
    const av = (a.business.website ? 2 : 0) + (a.business.email ? 4 : 0) + a.business.tagCount;
    const bv = (b.business.website ? 2 : 0) + (b.business.email ? 4 : 0) + b.business.tagCount;
    return bv - av;
  });

  // Hunter client (paid mode only).
  let hunter: HunterClient | null = null;
  if (opts.mode === "paid") {
    const apiKey = process.env.HUNTER_API_KEY;
    if (!apiKey) throw new Error("HUNTER_API_KEY is required for paid mode");
    const hunterBudget = opts.hunterBudget ?? 25;
    const budget: Budget = {
      searches: { used: cache.hunterUsage.searches, cap: hunterBudget },
      verifications: { used: cache.hunterUsage.verifications, cap: hunterBudget },
    };
    hunter = new HunterClient(apiKey, budget, log);
  }

  const rows: EnrichedRow[] = [];
  const counts = {
    enriched: 0,
    tierA: 0,
    tierB: 0,
    tierC: 0,
    dropped: 0,
    refrigerated: 0,
    bigboxChain: 0,
    needsManualEmail: 0,
    emailUnverified: 0,
    freemail: 0,
    roleAccount: 0,
    catchAll: 0,
  };

  for (const { business, industry } of candidates) {
    if (rows.length >= opts.limit) break;

    const enrich =
      opts.mode === "free"
        ? await enrichFree(business, log, { fast: opts.fast })
        : await enrichPaid(business, hunter!, log);

    if (enrich.annotations.includes("chain-store — route via corporate procurement.")) {
      counts.bigboxChain++;
    }
    if (enrich.annotations.some((a) => a.startsWith("needs-manual-email"))) {
      counts.needsManualEmail++;
    }
    if (enrich.annotations.some((a) => a.startsWith("free-webmail"))) counts.freemail++;
    if (enrich.annotations.some((a) => a === "role account")) counts.roleAccount++;
    if (enrich.annotations.includes("catch-all")) counts.catchAll++;
    if (enrich.annotations.some((a) => a.startsWith("email-unverified"))) {
      counts.emailUnverified++;
    }

    const result = scoreLead({ business, industry, emailConfidence: enrich.confidence });
    if (result.refrigerated) counts.refrigerated++;
    // If the score is below the C threshold, surface it as Tier C with a
    // `tier-untriaged` tag instead of dropping silently. The operator
    // sees every discovered lead in the CRM and can manually filter.
    const effectiveTier: "A" | "B" | "C" = result.tier ?? "C";
    if (!result.tier) {
      counts.dropped++;
      counts.tierC++;
      enrich.annotations.push("tier-untriaged");
    } else if (result.tier === "A") counts.tierA++;
    else if (result.tier === "B") counts.tierB++;
    else counts.tierC++;

    const phone = normalizePhone(business.phone);
    const miles = milesFromHq(business.lat, business.lon);
    const why = whyThisLead({
      industry,
      city: business.city,
      refrigerated: result.refrigerated,
      miles,
      emailStatus: enrich.confidence,
      hasOpeningHours: business.hasOpeningHours,
    });
    const annotated = enrich.annotations.length
      ? `${why} ${enrich.annotations.join("; ")}`
      : why;

    rows.push({
      rank: rows.length + 1,
      tier: effectiveTier,
      score: result.score,
      companyName: business.name,
      category: VERTICAL_FOR[industry],
      address: business.street,
      city: business.city,
      state: business.state ?? "CO",
      phone,
      website: business.website,
      email: enrich.email,
      breakdown: result.breakdown,
      whyThisLead: annotated,
    });

    counts.enriched++;
    cache.seenPlaceIds.push(business.id);
    cache.results[business.id] = {
      placeId: business.id,
      companyName: business.name,
      tier: effectiveTier,
      score: result.score,
      ts: new Date().toISOString(),
    };
  }

  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.rank = i + 1));

  if (hunter) {
    cache.hunterUsage = {
      month: currentMonth(),
      searches: hunter.budgetLeft().searches < 25 ? 25 - hunter.budgetLeft().searches : 0,
      verifications:
        hunter.budgetLeft().verifications < 25 ? 25 - hunter.budgetLeft().verifications : 0,
    };
  }
  if (!opts.noCache) saveCache(cache);

  log(
    `  → enriched ${counts.enriched}  refrigerated=${counts.refrigerated}  tiers A/B/C ${counts.tierA}/${counts.tierB}/${counts.tierC}  dropped=${counts.dropped}`,
  );

  /* ─── 3. Upsert to DB (caller controls via opts.db) ─── */

  let inserted = 0;
  let updated = 0;
  let conflicts = 0;
  if (opts.db) {
    log("\n[3/3] Upserting into Postgres…");
    for (const row of rows) {
      try {
        const r = await upsertLead(opts.db, rowToLeadInsert(row, sourceLabel), {
          audit: { actionPrefix: `research_${opts.mode}` },
        });
        if (r === "inserted") inserted++;
        else if (r === "updated") updated++;
        else conflicts++;
      } catch (err) {
        log(`  ! upsert failed for "${row.companyName}": ${(err as Error).message}`);
      }
    }

    // Run-summary audit row so the operator can see exactly what
    // happened on each invocation from /admin → Recent audit log
    // (separate from the per-lead inserted/updated rows).
    try {
      await opts.db.insert(auditLog).values({
        actorUserId: null,
        entity: "research",
        entityId: null,
        action: `research_${opts.mode}_run`,
        beforeJson: null,
        afterJson: {
          mode: opts.mode,
          discovered: candidates.length,
          enriched: counts.enriched,
          tierA: counts.tierA,
          tierB: counts.tierB,
          tierC: counts.tierC,
          dropped: counts.dropped,
          refrigerated: counts.refrigerated,
          inserted,
          updated,
          conflicts,
          needsManualEmail: counts.needsManualEmail,
          freemail: counts.freemail,
          roleAccount: counts.roleAccount,
          industries: opts.industries,
          counties: opts.counties,
          limit: opts.limit,
        },
        occurredAt: sql`now()`,
      });
    } catch (err) {
      log(`  ! audit log failed: ${(err as Error).message}`);
    }
  }

  return {
    mode: opts.mode,
    discovered: candidates.length,
    fromCache: cache.seenPlaceIds.length,
    enriched: counts.enriched,
    tierA: counts.tierA,
    tierB: counts.tierB,
    tierC: counts.tierC,
    refrigerated: counts.refrigerated,
    bigboxChain: counts.bigboxChain,
    needsManualEmail: counts.needsManualEmail,
    emailUnverified: counts.emailUnverified,
    freemail: counts.freemail,
    roleAccount: counts.roleAccount,
    catchAll: counts.catchAll,
    dropped: counts.dropped,
    inserted,
    updated,
    conflicts,
    hunterSearches: hunter ? 25 - hunter.budgetLeft().searches : 0,
    hunterVerifications: hunter ? 25 - hunter.budgetLeft().verifications : 0,
    notes: [],
    rows,
  };
}

export { COUNTIES_LIST };
const COUNTIES_LIST: readonly County[] = OSM_COUNTIES;
