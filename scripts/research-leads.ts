/**
 * scripts/research-leads.ts
 *
 * COMPLETELY FREE Denver Metro freight-lead research. Zero paid APIs,
 * zero credit cards, zero registration tokens.
 *
 * Pipeline:
 *   1. OpenStreetMap Overpass — business discovery by industry tags,
 *      bounded to each of 7 Denver Metro counties.
 *   2. cheerio — scrape /, /about, /contact, /team for `mailto:` and
 *      role hints (owner/manager/etc).
 *   3. node:dns — MX-record check on each candidate email; reject any
 *      domain without a real mail server.
 *   4. libphonenumber-js — phone E.164 normalization (offline).
 *   5. Deterministic scoring → tier A/B/C, refrigeration tagging.
 *   6. Output xlsx + csv + Postgres upsert (instant /leads visibility).
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/research-leads.ts
 *   npm run leads:research -- --limit 20 --industries restaurants
 *
 * Flags:
 *   --limit N          (default 50)
 *   --industries CSV   restaurants,bigbox,brokers,smallbiz
 *   --counties CSV     Adams,Arapahoe,...
 *   --output PATH      default ./01_Lead_List.xlsx
 *   --no-db            xlsx only, skip Postgres upsert
 *   --dry-run          discovery + scoring only (no scrape, no DB)
 *   --smoke            --limit 5 --counties Arapahoe --industries restaurants
 *   --no-cache         ignore .cache/lead-research.json
 *   --max-per-county N (default 80) cap per (industry,county) pair
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
  type Business,
  fetchOsmBusinesses,
  rootDomain,
  milesFromHq,
} from "../src/lib/research/osm";
import {
  scrapeDomainForContacts,
  pickBestScrapedContact,
} from "../src/lib/research/scrape";
import { validateEmail, type MxValidation } from "../src/lib/research/mx-validate";
import {
  scoreLead,
  whyThisLead,
  isBigBoxChain,
  VERTICAL_FOR,
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
  maxPerCounty: number;
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
    maxPerCounty: Number(get("--max-per-county") ?? 80),
  };

  if (has("--smoke")) {
    args = {
      ...args,
      limit: 5,
      counties: ["Arapahoe"],
      industries: ["restaurants"],
    };
  }

  return args;
}

/* ── Phone helper ────────────────────────────────────────────────── */

function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, "US");
  if (!parsed?.isValid()) return null;
  return parsed.format("E.164");
}

/* ── Build a LeadInsert from an enriched row ─────────────────────── */

function rowToLeadInsert(row: EnrichedRow, source: string) {
  const tags: string[] = [`tier-${row.tier}`, row.category];
  if (/refrigerated/.test(row.whyThisLead)) tags.push("refrigerated");
  if (/needs manual/.test(row.whyThisLead)) tags.push("needs-manual-email");
  if (/free-webmail/.test(row.whyThisLead)) tags.push("freemail");
  if (/role account/.test(row.whyThisLead)) tags.push("role-account");

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

  log("=== research-leads (free, OSM + scrape + MX) ===");
  log(
    `industries: ${args.industries.join(",")}  counties: ${args.counties.join(",")}  limit: ${args.limit}  ` +
      `dry-run: ${args.dryRun}  no-db: ${args.noDb}`,
  );

  const cache = args.noCache
    ? {
        seenPlaceIds: [] as string[],
        hunterUsage: { month: currentMonth(), searches: 0, verifications: 0 },
        results: {} as Record<string, { placeId: string; companyName: string; tier: "A" | "B" | "C" | null; score: number; ts: string }>,
      }
    : loadCache();
  const seenIds = new Set<string>(cache.seenPlaceIds);

  /* ─── 1. Discovery ─── */

  log("\n[1/3] Discovery (OpenStreetMap Overpass)…");
  const candidates: Array<{ business: Business; industry: Industry; county: County }> = [];

  for (const county of args.counties) {
    for (const industry of args.industries) {
      const bizList = await fetchOsmBusinesses({ industry, county, log });
      let added = 0;
      for (const b of bizList) {
        if (seenIds.has(b.id)) continue;
        if (added >= args.maxPerCounty) break;
        seenIds.add(b.id);
        candidates.push({ business: b, industry, county });
        added++;
      }
      log(`  + ${industry}/${county}: ${bizList.length} found, ${added} new (running total ${candidates.length})`);
      // be polite to overpass
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  log(`  → ${candidates.length} candidates after dedupe (cache had ${cache.seenPlaceIds.length} prior).`);

  /* ─── 2. Enrichment ─── */

  log("\n[2/3] Enrichment (scrape + MX validation) + scoring…");

  const rows: EnrichedRow[] = [];
  const counts = {
    discovered: candidates.length,
    fromCache: cache.seenPlaceIds.length,
    enriched: 0,
    bigboxChain: 0,
    needsManualEmail: 0,
    freemail: 0,
    roleAccount: 0,
    refrigerated: 0,
    tierA: 0,
    tierB: 0,
    tierC: 0,
    dropped: 0,
  };

  // Sort candidates: prefer those with website + address present so we
  // spend our scraping budget on the highest-yield rows first.
  candidates.sort((a, b) => {
    const av = (a.business.website ? 2 : 0) + (a.business.email ? 4 : 0) + a.business.tagCount;
    const bv = (b.business.website ? 2 : 0) + (b.business.email ? 4 : 0) + b.business.tagCount;
    return bv - av;
  });

  for (const { business, industry } of candidates) {
    if (rows.length >= args.limit) {
      log(`  → reached --limit ${args.limit}; stopping enrichment`);
      break;
    }

    let email: string | null = business.email; // OSM may already carry one
    let confidence: EmailConfidence = "none";
    let mxResult: MxValidation | null = null;

    if (isBigBoxChain(business.name)) {
      counts.bigboxChain++;
      // chain — skip scrape, no email captured (route via corporate)
    } else if (!args.dryRun) {
      const domain = email
        ? email.split("@")[1] ?? null
        : rootDomain(business.website);

      // 1. If OSM already gave us an email, validate it directly.
      if (email) {
        mxResult = await validateEmail(email);
        if (mxResult.confidence === "rejected") email = null;
      }

      // 2. Otherwise scrape the website for mailto: links.
      if (!email && domain) {
        try {
          const scraped = await scrapeDomainForContacts(domain, log);
          const pick = pickBestScrapedContact(scraped);
          if (pick) {
            const v = await validateEmail(pick.email);
            if (v.confidence !== "rejected") {
              email = v.email;
              mxResult = v;
            }
          }
        } catch (err) {
          warn(`    ! scrape threw on ${domain}: ${(err as Error).message}`);
        }
      }

      if (mxResult) {
        if (mxResult.confidence === "high") confidence = "high";
        else if (mxResult.confidence === "medium") {
          confidence = "medium";
          counts.freemail++;
        } else if (mxResult.confidence === "low") {
          confidence = "low";
          counts.roleAccount++;
        }
      }
      if (!email) counts.needsManualEmail++;
    }

    const result = scoreLead({ business, industry, emailConfidence: confidence });
    if (result.refrigerated) counts.refrigerated++;
    if (!result.tier) {
      counts.dropped++;
      continue;
    }
    if (result.tier === "A") counts.tierA++;
    if (result.tier === "B") counts.tierB++;
    if (result.tier === "C") counts.tierC++;

    const phone = normalizePhone(business.phone);
    const miles = milesFromHq(business.lat, business.lon);

    const why = whyThisLead({
      industry,
      city: business.city,
      refrigerated: result.refrigerated,
      miles,
      emailStatus: confidence,
      hasOpeningHours: business.hasOpeningHours,
    });

    rows.push({
      rank: rows.length + 1,
      tier: result.tier,
      score: result.score,
      companyName: business.name,
      category: VERTICAL_FOR[industry],
      address: business.street,
      city: business.city,
      state: business.state ?? "CO",
      phone,
      website: business.website,
      email,
      breakdown: result.breakdown,
      whyThisLead: isBigBoxChain(business.name)
        ? `${why} chain-store — route via corporate procurement.`
        : why,
    });

    counts.enriched++;
    cache.seenPlaceIds.push(business.id);
    cache.results[business.id] = {
      placeId: business.id,
      companyName: business.name,
      tier: result.tier,
      score: result.score,
      ts: new Date().toISOString(),
    };
  }

  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.rank = i + 1));

  log(
    `  → enriched ${counts.enriched}  refrigerated=${counts.refrigerated}  tiers A/B/C ${counts.tierA}/${counts.tierB}/${counts.tierC}  dropped=${counts.dropped}`,
  );

  /* ─── 3. Outputs + DB ─── */

  if (!args.noCache) saveCache(cache);

  log("\n[3/3] Writing outputs…");
  await writeXlsx(rows, args.output);
  const csvPath = args.output.replace(/\.xlsx$/i, ".csv");
  writeCsv(rows, csvPath);
  log(`  → ${args.output}`);
  log(`  → ${csvPath}`);

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
    `Email status:  needs-manual ${counts.needsManualEmail}  freemail ${counts.freemail}  role-account ${counts.roleAccount}  chain-store ${counts.bigboxChain}`,
  );
  if (!args.noDb && !args.dryRun) {
    log(`DB upserts:    inserted ${dbStats.inserted}  updated ${dbStats.updated}  conflicts ${dbStats.conflicts}`);
  } else {
    log(`DB upserts:    skipped (${args.dryRun ? "--dry-run" : "--no-db"})`);
  }
  log(`Output:        ${args.output} + ${csvPath}`);
  log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
