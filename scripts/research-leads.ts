/**
 * scripts/research-leads.ts
 *
 * CLI wrapper around the shared `runResearch()` orchestrator. Same code
 * the /admin "Run free / paid research" buttons call, just driven from
 * argv with xlsx + csv outputs written next to the user's CWD.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/research-leads.ts [flags]
 *
 * Flags:
 *   --mode free|paid     default "free"
 *   --limit N            default 50
 *   --industries CSV     restaurants,bigbox,brokers,smallbiz
 *   --counties CSV       Adams,Arapahoe,...
 *   --output PATH        default ./01_Lead_List.xlsx
 *   --no-db              xlsx only, skip Postgres upsert
 *   --dry-run            discovery + scoring only (no email enrichment, no DB)
 *   --smoke              --limit 5 --counties Arapahoe --industries restaurants
 *   --no-cache           ignore .cache/lead-research.json
 *   --max-per-county N   default 80
 *   --hunter-budget N    paid mode only, default 25
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";
import type { Db } from "../src/lib/leads/upsert";
import { COUNTIES, type County } from "../src/lib/research/osm";
import type { Industry } from "../src/lib/research/score";
import { writeXlsx, writeCsv } from "../src/lib/research/output";
import { runResearch, type RunMode } from "../src/lib/research/run";

/* ── Manually load .env.local ────────────────────────────────────── */

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
  mode: RunMode;
  limit: number;
  industries: Industry[];
  counties: County[];
  output: string;
  noDb: boolean;
  dryRun: boolean;
  noCache: boolean;
  fast: boolean;
  maxPerCounty: number;
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

  const rawMode = get("--mode") ?? "free";
  const mode: RunMode = rawMode === "paid" ? "paid" : "free";

  let args: Args = {
    mode,
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
    fast: has("--fast"),
    maxPerCounty: Number(get("--max-per-county") ?? 80),
    hunterBudget: Number(get("--hunter-budget") ?? 25),
  };

  if (has("--smoke")) {
    args = { ...args, limit: 5, counties: ["Arapahoe"], industries: ["restaurants"] };
  }

  return args;
}

/* ── Main ────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const args = parseArgs();
  const log = (msg: string) => console.log(msg);

  let db: Db | undefined;
  let pgClient: ReturnType<typeof postgres> | undefined;
  if (!args.noDb && !args.dryRun) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn(
        "  ! DATABASE_URL not set; skipping DB upsert. Set it to your Vercel/Neon production URL for instant /leads visibility.",
      );
    } else {
      pgClient = postgres(dbUrl, { prepare: false, max: 5 });
      db = drizzle(pgClient, { schema });
    }
  }

  const report = await runResearch({
    mode: args.mode,
    limit: args.limit,
    industries: args.industries,
    counties: args.counties,
    maxPerCounty: args.maxPerCounty,
    hunterBudget: args.hunterBudget,
    noCache: args.noCache,
    fast: args.fast,
    db: args.dryRun ? undefined : db,
    sourceLabel: `research-${args.mode}`,
    log,
  });

  if (pgClient) await pgClient.end();

  // Write outputs.
  log("\nWriting outputs…");
  await writeXlsx(report.rows, args.output);
  const csvPath = args.output.replace(/\.xlsx$/i, ".csv");
  writeCsv(report.rows, csvPath);
  log(`  → ${args.output}`);
  log(`  → ${csvPath}`);

  // Summary.
  log("\n=== Lead-research run summary ===");
  log(`Mode:          ${report.mode}`);
  log(`Discovered:    ${report.discovered} (${report.fromCache} skipped from cache)`);
  log(`Enriched:      ${report.enriched}`);
  log(`Tier A/B/C:    ${report.tierA} / ${report.tierB} / ${report.tierC}    Dropped: ${report.dropped}`);
  log(`Refrigerated:  ${report.refrigerated}`);
  log(
    `Email status:  needs-manual ${report.needsManualEmail}  freemail ${report.freemail}  role-account ${report.roleAccount}  catch-all ${report.catchAll}  unverified ${report.emailUnverified}  chain-store ${report.bigboxChain}`,
  );
  log(`DB upserts:    inserted ${report.inserted}  updated ${report.updated}  conflicts ${report.conflicts}`);
  if (args.mode === "paid") {
    log(`Hunter usage:  ${report.hunterSearches}/${args.hunterBudget} searches, ${report.hunterVerifications}/${args.hunterBudget} verifications`);
  }
  log(`Output:        ${args.output} + ${csvPath}`);
  log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
