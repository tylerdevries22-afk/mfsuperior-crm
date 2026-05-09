/**
 * Writes the research results to xlsx + csv. Column names are pinned to
 * the aliases in src/lib/xlsx.ts:34 (HEADER_ALIASES) so parseLeadWorkbook
 * picks them up without modification.
 */

import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type { ScoreBreakdown } from "./score";

export type EnrichedRow = {
  rank: number;
  tier: "A" | "B" | "C";
  score: number;
  companyName: string;
  category: string; // -> "Category" col, picked up by `vertical` alias
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  breakdown: ScoreBreakdown;
  whyThisLead: string;
};

const COLUMNS: Array<{ header: string; key: keyof EnrichedRow | string; width: number }> = [
  { header: "Rank", key: "rank", width: 6 },
  { header: "Tier", key: "tier", width: 6 },
  { header: "Score", key: "score", width: 7 },
  { header: "Company", key: "companyName", width: 40 },
  { header: "Category", key: "category", width: 18 },
  { header: "Address", key: "address", width: 32 },
  { header: "City", key: "city", width: 16 },
  { header: "State", key: "state", width: 6 },
  { header: "Phone", key: "phone", width: 18 },
  { header: "Website", key: "website", width: 30 },
  { header: "Email", key: "email", width: 32 },
  { header: "BoxFit", key: "boxFit", width: 8 },
  { header: "Liftgate", key: "liftgate", width: 9 },
  { header: "Volume", key: "volume", width: 8 },
  { header: "Window", key: "window", width: 8 },
  { header: "DM Access", key: "dmAccess", width: 11 },
  { header: "GeoFit", key: "geoFit", width: 8 },
  { header: "Why This Lead", key: "whyThisLead", width: 60 },
];

function flat(row: EnrichedRow): Record<string, unknown> {
  return {
    rank: row.rank,
    tier: row.tier,
    score: row.score,
    companyName: row.companyName,
    category: row.category,
    address: row.address,
    city: row.city,
    state: row.state,
    phone: row.phone,
    website: row.website,
    email: row.email,
    boxFit: row.breakdown.boxFit,
    liftgate: row.breakdown.liftgate,
    volume: row.breakdown.volume,
    window: row.breakdown.window,
    dmAccess: row.breakdown.dmAccess,
    geoFit: row.breakdown.geoFit,
    whyThisLead: row.whyThisLead,
  };
}

export async function writeXlsx(rows: EnrichedRow[], outputPath: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "scripts/research-leads.ts";
  wb.created = new Date();
  const sheet = wb.addWorksheet("Leads");
  sheet.columns = COLUMNS.map(({ header, key, width }) => ({ header, key, width }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of rows) sheet.addRow(flat(r));
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  await wb.xlsx.writeFile(outputPath);
}

export function writeCsv(rows: EnrichedRow[], outputPath: string): void {
  const headers = COLUMNS.map((c) => c.header);
  const lines: string[] = [headers.join(",")];
  for (const r of rows) {
    const f = flat(r);
    const line = COLUMNS.map(({ key }) => csvEscape(f[key as keyof typeof f])).join(",");
    lines.push(line);
  }
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, lines.join("\n") + "\n");
}

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
