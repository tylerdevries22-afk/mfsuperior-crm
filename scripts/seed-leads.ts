/**
 * scripts/seed-leads.ts
 *
 * Reads the ranked lead workbook at ../../01_Lead_List.xlsx,
 * parses it with the existing xlsx parser, and upserts all rows
 * into the `leads` table.  Also ensures the settings singleton
 * (id = 1) exists.
 *
 * Usage (from the crm/ directory):
 *   npx tsx --tsconfig tsconfig.json scripts/seed-leads.ts
 *
 * The script reads DATABASE_URL directly from process.env so you
 * can pre-populate it via .env.local or an inline assignment:
 *   DATABASE_URL="postgres://..." npx tsx scripts/seed-leads.ts
 */

import "dotenv/config"; // loads .env.local if dotenv is available
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { parseLeadWorkbook, toLeadInsert } from "../src/lib/xlsx";
import { upsertLead } from "../src/lib/leads/upsert";

/* ── 0.  Resolve DATABASE_URL ──────────────────────────────────── */

// Try loading .env.local manually if dotenv didn't pick it up.
const envLocalPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "ERROR: DATABASE_URL is not set.\n" +
      "Either set it in .env.local or prefix the command:\n" +
      '  DATABASE_URL="postgres://..." npx tsx scripts/seed-leads.ts',
  );
  process.exit(1);
}

/* ── 1.  DB connection ─────────────────────────────────────────── */

const client = postgres(DATABASE_URL, { prepare: false, max: 5 });
const db = drizzle(client, { schema });

/* ── 2.  Resolve xlsx path ─────────────────────────────────────── */

// Look in the repo root first (where research-leads.ts writes), then fall
// back to one level above the repo (the original location).
const XLSX_CANDIDATES = [
  path.resolve(__dirname, "../01_Lead_List.xlsx"),
  path.resolve(__dirname, "../../01_Lead_List.xlsx"),
];
const XLSX_PATH = XLSX_CANDIDATES.find((p) => fs.existsSync(p));

if (!XLSX_PATH) {
  console.error(
    `ERROR: xlsx not found. Looked in:\n  ${XLSX_CANDIDATES.join("\n  ")}`,
  );
  process.exit(1);
}
// Type-narrow for closures further down (process.exit doesn't propagate
// narrowing across function boundaries).
const RESOLVED_XLSX_PATH: string = XLSX_PATH;

/* ── 3.  Seed settings singleton ───────────────────────────────── */

async function ensureSettings(): Promise<void> {
  const existing = await db
    .select({ id: schema.settings.id })
    .from(schema.settings)
    .where(sql`id = 1`)
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.settings).values({
      id: 1,
      businessName: "MF Superior Products",
      businessAddress: "15321 E Louisiana Ave, Aurora, CO 80017, United States",
      senderName: "Tyler DeVries",
      senderEmail: "info@mfsuperiorproducts.com",
      senderTitle: "Sales",
      dailySendCap: 20,
    });
    console.log("  [settings] Created singleton row (id=1).");
  } else {
    console.log("  [settings] Row already exists — skipped.");
  }
}

/* ── 4.  Seed leads ────────────────────────────────────────────── */

async function seedLeads(): Promise<void> {
  console.log(`\nReading workbook: ${RESOLVED_XLSX_PATH}`);
  const buffer = fs.readFileSync(RESOLVED_XLSX_PATH).buffer;
  const report = await parseLeadWorkbook(buffer);

  if (report.warnings.length) {
    console.warn("\nParser warnings:");
    report.warnings.forEach((w) => console.warn("  !", w));
  }

  if (report.skippedRows.length) {
    console.warn(`\nSkipped ${report.skippedRows.length} row(s):`);
    report.skippedRows.forEach(({ rowNumber, reason }) =>
      console.warn(`  row ${rowNumber}: ${reason}`),
    );
  }

  console.log(`\nParsed ${report.leads.length} lead(s). Upserting…\n`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const parsed of report.leads) {
    const insert = toLeadInsert(parsed, "spreadsheet");

    try {
      const result = await upsertLead(db, insert, {
        audit: { actionPrefix: "spreadsheet" },
      });
      if (result === "inserted") inserted++;
      else if (result === "updated") updated++;
      else skipped++;
    } catch (err) {
      console.error(
        `  ERROR on "${insert.companyName}":`,
        (err as Error).message,
      );
    }
  }

  console.log(
    `Done. inserted=${inserted}  upserted=${updated}  skipped(already exists)=${skipped}`,
  );
}

/* ── 5.  Entry point ────────────────────────────────────────────── */

async function main(): Promise<void> {
  console.log("=== seed-leads ===");

  console.log("\n[1/2] Settings…");
  await ensureSettings();

  console.log("\n[2/2] Leads…");
  await seedLeads();

  console.log("\nAll done. Closing connection.");
  await client.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  client.end().finally(() => process.exit(1));
});
