/**
 * scripts/research-leads.ts
 *
 * Discover Denver-Metro freight leads with verified contact emails, score
 * them, write a ranked xlsx + csv, and (by default) upsert into the same
 * Postgres `leads` table the live CRM reads — so new rows appear instantly
 * on https://mfsuperiorproducts.com/leads after the run finishes.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=... HUNTER_API_KEY=... \
 *   DATABASE_URL=... \
 *     npx tsx scripts/research-leads.ts [flags]
 *
 * Flags:
 *   --limit N             default 50
 *   --industries CSV      restaurants,bigbox,brokers,smallbiz (default all)
 *   --counties CSV        Adams,Arapahoe,... (default all 7)
 *   --output PATH         default ./01_Lead_List.xlsx
 *   --no-db               skip Postgres upsert
 *   --dry-run             discovery + scoring only, no Hunter, no DB
 *   --smoke               --limit 5 --counties Arapahoe --industries restaurants --hunter-budget 5
 *   --no-cache            ignore .cache/lead-research.json
 *   --hunter-budget N     default 25
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import * as schema from "../src/lib/db/schema";
import { upsertLead, type Db } from "../src/lib/leads/upsert";
import {
  COUNTIES,
  type County,
  type Place,
  discoverPlaces,
  rootDomain,
  splitAddress,
} from "../src/lib/research/places";
import {
  HunterClient,
  pickBestContact,
  type Budget,
} from "../src/lib/research/hunter";
import {
  scrapeDomainForContacts,
  pickBestScrapedContact,
} from "../src/lib/research/scrape";
import {
  scoreLead,
  whyThisLead,
  isBigBoxChain,
  type Industry,
  type EmailConfidence,
} from "../src/lib/research/score";
import { loadCache, saveCache, currentMonth } from "../src/lib/research/cache";
import { writeXlsx, writeCsv, type EnrichedRow } from "../src/lib/research/output";

/* ── Manually load .env.local (mirrors seed-leads.ts) ────────────── */

const envLocalPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envLocalPath)) {
  for (const line of fs.readFileSync(envLocalPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

/* ── Argv ────────────────────────────────────────────────────────── */

type Args = {
  limit: number;
  industries: Industry[];
  counties: County[];
  output: string;
  noDb: boolean;
  dryRun: boolean;
  noCache: boolean;
  hunterBudget: number;
};

const ALL_INDUSTRIES: Industry[] = ["restaurants", "bigbox", "brokers", "smallbiz"];

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const has = (flag: string): boolean => argv.includes(flag);

  let args: Args = {
    limit: Number(get("--limit") ?? 50),
    industries:
      (get("--industries")?.split(",") as Industry[] | undefined)?.filter((i) =>
        ALL_INDUSTRIES.includes(i),
      ) ?? ALL_INDUSTRIES,
    counties:
      (get("--counties")?.split(",") as County[] | undefined)?.filter((c) =>
        (COUNTIES as readonly string[]).includes(c),
      ) ?? [...COUNTIES],
    output: get("--output") ?? path.resolve(process.cwd(), "01_Lead_List.xlsx"),
    noDb: has("--no-db"),
    dryRun: has("--dry-run"),
    noCache: has("--no-cache"),
    hunterBudget: Number(get("--hunter-budget") ?? 25),
  };

  if (has("--smoke")) {
    args = {
      ...args,
      limit: 5,
      counties: ["Arapahoe"],
      industries: ["restaurants"],
      hunterBudget: 5,
    };
  }

  return args;
}

/* ── Vertical labels ─────────────────────────────────────────────── */

const VERTICAL_LABEL: Record<Industry, string> = {
  restaurants: "Restaurants & food",
  bigbox: "Big-box retail",
  brokers: "Freight broker / 3PL",
  smallbiz: "Small business",
};

/* ── Phone helper ────────────────────────────────────────────────── */

function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, "US");
  if (!parsed?.isValid()) return null;
  return parsed.format("E.164");
}

/* ── Build the LeadInsert from an enriched row ───────────────────── */

function rowToLeadInsert(row: EnrichedRow, source: string) {
  const tags: string[] = [`tier-${row.tier}`, row.category];
  // Append refrigeration / status tags by checking which "Why" string was emitted.
  if (/refrigerated/.test(row.whyThisLead)) tags.push("refrigerated");
  if (/needs manual/.test(row.whyThisLead)) tags.push("needs-manual-email");
  if (/scraped \(unverified\)/.test(row.whyThisLead)) tags.push("email-unverified");
  if (/catch-all/.test(row.whyThisLead)) tags.push("catch-all");

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

/* ── Main ────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const args = parseArgs();
  const log = (msg: string) => console.log(msg);
  const warn = (msg: string) => console.warn(msg);

  log("=== research-leads ===");
  log(
    `industries: ${args.industries.join(",")}  counties: ${args.counties.join(",")}  limit: ${args.limit}  ` +
      `dry-run: ${args.dryRun}  no-db: ${args.noDb}  hunter-budget: ${args.hunterBudget}`,
  );

  const placesKey = process.env.GOOGLE_MAPS_API_KEY;
  const hunterKey = process.env.HUNTER_API_KEY;
  if (!placesKey) {
    console.error("ERROR: GOOGLE_MAPS_API_KEY is not set. Add it to .env.local.");
    process.exit(1);
  }
  if (!args.dryRun && !hunterKey) {
    console.error(
      "ERROR: HUNTER_API_KEY is not set. Add it to .env.local or use --dry-run.",
    );
    process.exit(1);
  }

  const cache = args.noCache
    ? { seenPlaceIds: [] as string[], hunterUsage: { month: currentMonth(), searches: 0, verifications: 0 }, results: {} as Record<string, { placeId: string; companyName: string; tier: "A" | "B" | "C" | null; score: number; ts: string }> }
    : loadCache();

  // Build Hunter client with budget rolled over per month.
  const budget: Budget = {
    searches: { used: cache.hunterUsage.searches, cap: args.hunterBudget },
    verifications: { used: cache.hunterUsage.verifications, cap: args.hunterBudget },
  };
  const hunter = !args.dryRun && hunterKey ? new HunterClient(hunterKey, budget, log) : null;

  /* ─── Discovery ─── */

  log("\n[1/3] Discovery (Google Places)…");
  const exclude = new Set(cache.seenPlaceIds);
  const candidates: Array<{ place: Place; industry: Industry; county: County }> = [];

  for (const county of args.counties) {
    for (const industry of args.industries) {
      try {
        const found = await discoverPlaces({
          apiKey: placesKey,
          industry,
          county,
          excludeIds: exclude,
          log,
        });
        candidates.push(...found);
      } catch (err) {
        warn(`  ! ${industry}/${county} discovery failed: ${(err as Error).message}`);
      }
    }
  }

  log(`  → ${candidates.length} candidates after dedupe (cache had ${exclude.size} prior).`);

  /* ─── Enrichment + scoring ─── */

  log("\n[2/3] Enrichment (Hunter / scrape) + scoring…");

  const rows: EnrichedRow[] = [];
  const counts = {
    discovered: candidates.length,
    fromCache: exclude.size,
    enriched: 0,
    bigboxChain: 0,
    needsManualEmail: 0,
    emailUnverified: 0,
    catchAll: 0,
    refrigerated: 0,
    tierA: 0,
    tierB: 0,
    tierC: 0,
    dropped: 0,
  };

  for (const { place, industry, county } of candidates) {
    if (rows.length >= args.limit) {
      log(`  → reached --limit ${args.limit}; stopping enrichment`);
      break;
    }

    const companyName = place.displayName?.text?.trim() ?? "(unknown)";
    if (!companyName || companyName === "(unknown)") {
      counts.dropped++;
      continue;
    }

    let email: string | null = null;
    let confidence: EmailConfidence = "none";
    let tag: "chain-store" | "needs-manual" | "scraped" | "valid" | "accept_all" | null = null;

    if (isBigBoxChain(companyName)) {
      // Chains: skip Hunter, leave email null, tag chain-store.
      tag = "chain-store";
      counts.bigboxChain++;
    } else if (hunter) {
      const domain = rootDomain(place.websiteUri);
      if (domain) {
        const ds = await hunter.domainSearch(domain);
        const best = ds ? pickBestContact(ds.emails) : null;
        if (best?.value) {
          email = best.value.toLowerCase();
        } else {
          // Scrape fallback
          const scraped = await scrapeDomainForContacts(domain, log);
          const pick = pickBestScrapedContact(scraped);
          if (pick) {
            email = pick.email;
            confidence = "scraped";
          }
        }

        // Verify only if we have an email AND the company would be Tier C+ pre-verification.
        if (email && confidence !== "scraped") {
          const ver = await hunter.verify(email);
          if (ver?.status === "valid") confidence = "valid";
          else if (ver?.status === "accept_all") {
            confidence = "accept_all";
            counts.catchAll++;
            tag = "accept_all";
          } else {
            // Drop the email entirely; mark unverified
            email = null;
            confidence = "none";
            counts.emailUnverified++;
            tag = "needs-manual";
          }
        } else if (email && confidence === "scraped") {
          counts.emailUnverified++;
          tag = "scraped";
        }
      }
      if (!email) {
        // tag is constrained to non-"chain-store" inside this branch;
        // the chain-store path is the outer if.
        tag = "needs-manual";
        counts.needsManualEmail++;
      }
    } else {
      // dry-run path: no email enrichment
      if (!isBigBoxChain(companyName)) {
        tag = "needs-manual";
        counts.needsManualEmail++;
      }
    }

    const result = scoreLead({ place, industry, emailConfidence: confidence });
    if (result.refrigerated) counts.refrigerated++;
    if (!result.tier) {
      counts.dropped++;
      continue;
    }
    if (result.tier === "A") counts.tierA++;
    if (result.tier === "B") counts.tierB++;
    if (result.tier === "C") counts.tierC++;

    const addr = splitAddress(place.formattedAddress);
    const phone = normalizePhone(place.nationalPhoneNumber ?? place.internationalPhoneNumber);

    const why = whyThisLead({
      industry,
      city: addr.city,
      refrigerated: result.refrigerated,
      reviews: place.userRatingCount,
      miles:
        place.location
          ? Math.round(
              (() => {
                // re-compute miles without re-importing — small dup but keeps the why string honest
                const HQ_LAT = 39.6911;
                const HQ_LNG = -104.8214;
                const toRad = (d: number) => (d * Math.PI) / 180;
                const R = 3958.8;
                const dLat = toRad(place.location!.latitude - HQ_LAT);
                const dLng = toRad(place.location!.longitude - HQ_LNG);
                const a =
                  Math.sin(dLat / 2) ** 2 +
                  Math.cos(toRad(HQ_LAT)) *
                    Math.cos(toRad(place.location!.latitude)) *
                    Math.sin(dLng / 2) ** 2;
                return R * 2 * Math.asin(Math.sqrt(a));
              })(),
            )
          : null,
      emailStatus: confidence,
    });

    rows.push({
      rank: rows.length + 1,
      tier: result.tier,
      score: result.score,
      companyName,
      category: VERTICAL_LABEL[industry],
      address: addr.street,
      city: addr.city,
      state: addr.state,
      phone,
      website: place.websiteUri ?? null,
      email,
      breakdown: result.breakdown,
      whyThisLead: tag === "chain-store" ? `${why} chain-store — route via corporate procurement.` : why,
    });

    counts.enriched++;
    cache.seenPlaceIds.push(place.id);
    cache.results[place.id] = {
      placeId: place.id,
      companyName,
      tier: result.tier,
      score: result.score,
      ts: new Date().toISOString(),
    };
    void county;
  }

  // Re-rank by score desc.
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.rank = i + 1));

  log(
    `  → enriched ${counts.enriched}  refrigerated=${counts.refrigerated}  tiers A/B/C ${counts.tierA}/${counts.tierB}/${counts.tierC}  dropped=${counts.dropped}`,
  );
  if (hunter) {
    const left = hunter.budgetLeft();
    log(`  → Hunter usage: searches ${budget.searches.used}/${budget.searches.cap}  verifications ${budget.verifications.used}/${budget.verifications.cap}`);
    if (left.searches === 0 || left.verifications === 0) {
      warn(
        `  ! Hunter quota hit. Upgrade: Hunter Starter $49/mo → 500 searches + 1k verifications.`,
      );
    }
  }

  /* ─── Persist cache + outputs ─── */

  if (!args.noCache && hunter) {
    cache.hunterUsage = {
      month: currentMonth(),
      searches: budget.searches.used,
      verifications: budget.verifications.used,
    };
  }
  if (!args.noCache) saveCache(cache);

  log(`\n[3/3] Writing outputs…`);
  await writeXlsx(rows, args.output);
  const csvPath = args.output.replace(/\.xlsx$/i, ".csv");
  writeCsv(rows, csvPath);
  log(`  → ${args.output}`);
  log(`  → ${csvPath}`);

  /* ─── DB upsert (default) ─── */

  let dbStats = { inserted: 0, updated: 0, conflicts: 0 };
  if (!args.noDb && !args.dryRun) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      warn(
        "  ! DATABASE_URL not set; skipping DB upsert. Set it to your Vercel/Neon production URL for instant /leads visibility.",
      );
    } else {
      const client = postgres(dbUrl, { prepare: false, max: 5 });
      const db: Db = drizzle(client, { schema });
      log(`\n[3.5/3] Upserting ${rows.length} leads into Postgres…`);
      for (const row of rows) {
        try {
          const r = await upsertLead(db, rowToLeadInsert(row, "research"), {
            audit: { actionPrefix: "research" },
          });
          if (r === "inserted") dbStats.inserted++;
          else if (r === "updated") dbStats.updated++;
          else dbStats.conflicts++;
        } catch (err) {
          warn(`  ! upsert failed for "${row.companyName}": ${(err as Error).message}`);
        }
      }
      await client.end();
    }
  }

  /* ─── Summary ─── */

  log("\n=== Lead-research run summary ===");
  log(`Discovered:    ${counts.discovered} (${counts.fromCache} skipped from cache)`);
  log(`Enriched:      ${counts.enriched}`);
  log(`Tier A/B/C:    ${counts.tierA} / ${counts.tierB} / ${counts.tierC}    Dropped: ${counts.dropped}`);
  log(`Refrigerated:  ${counts.refrigerated}`);
  log(
    `Email status:  needs-manual ${counts.needsManualEmail}  unverified ${counts.emailUnverified}  catch-all ${counts.catchAll}  chain-store ${counts.bigboxChain}`,
  );
  if (!args.noDb && !args.dryRun) {
    log(
      `DB upserts:    inserted ${dbStats.inserted}  updated ${dbStats.updated}  conflicts ${dbStats.conflicts}`,
    );
  } else {
    log(`DB upserts:    skipped (${args.dryRun ? "--dry-run" : "--no-db"})`);
  }
  if (hunter) {
    log(`Hunter quota:  ${budget.searches.used}/${budget.searches.cap} searches, ${budget.verifications.used}/${budget.verifications.cap} verifications used this month`);
  }
  log(`Output:        ${args.output} + ${csvPath}`);
  log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
