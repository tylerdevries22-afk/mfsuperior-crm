/**
 * scripts/build-50-draft-csv.ts
 *
 * Produces leads-50-draft-batch.csv — the 50 leads that
 * generate50DraftsAction will insert when clicked on /admin → Imports.
 * Exists so the operator can sanity-check the batch BEFORE clicking
 * the action (no DB access required to preview).
 *
 * Mirrors the diversity / role-account logic in
 * src/app/(app)/admin/actions.ts:generate50DraftsAction. Round-robins
 * across industries so the batch isn't 50 restaurants.
 *
 * Usage:
 *   npx tsx scripts/build-50-draft-csv.ts
 *   # writes leads-50-draft-batch.csv to the repo root
 */
import fs from "node:fs";
import path from "node:path";
import { CURATED_DENVER } from "../src/lib/research/curated-denver";

const ROLE_BY_INDUSTRY: Record<string, string> = {
  restaurants: "orders",
  bigbox: "procurement",
  brokers: "dispatch",
  smallbiz: "info",
  construction: "procurement",
  cannabis: "purchasing",
};

const VERTICAL_LABEL: Record<string, string> = {
  restaurants: "Restaurant",
  bigbox: "Big-box retail",
  brokers: "Freight broker / 3PL",
  smallbiz: "Small business",
  construction: "Construction / contractor",
  cannabis: "Cannabis (dispensary / cultivation)",
};

const LIMIT = 50;

const byIndustry = new Map<string, typeof CURATED_DENVER>();
for (const c of CURATED_DENVER) {
  const list = byIndustry.get(c.industry) ?? [];
  list.push(c);
  byIndustry.set(c.industry, list);
}

const interleaved: typeof CURATED_DENVER = [];
const industries = [...byIndustry.keys()];
let progress = true;
for (let i = 0; progress && interleaved.length < LIMIT; i++) {
  progress = false;
  for (const ind of industries) {
    const list = byIndustry.get(ind);
    if (list && i < list.length && interleaved.length < LIMIT) {
      interleaved.push(list[i]);
      progress = true;
    }
  }
}

const rows = interleaved.slice(0, LIMIT).map((c) => {
  const email = `${c.emailLocal ?? ROLE_BY_INDUSTRY[c.industry] ?? "info"}@${c.domain}`;
  const tags = [
    "tier-A",
    VERTICAL_LABEL[c.industry] ?? c.industry,
    "lead-gen-50",
    "email-role-account",
    c.refrigerated ? "refrigerated" : null,
    c.chain ? "chain-store" : null,
  ].filter(Boolean) as string[];
  return {
    companyName: c.name,
    website: `https://${c.domain}`,
    email,
    phone: "",
    address: "",
    city: "Denver Metro",
    state: "CO",
    vertical: VERTICAL_LABEL[c.industry] ?? c.industry,
    tier: "A",
    tags: tags.join("|"),
    notes: `Generated batch of 50 — role-account ${email}. Refrigerated=${c.refrigerated ?? false}. Chain=${c.chain ?? false}.`,
    source: "lead-gen-50",
  };
});

const header = [
  "companyName",
  "website",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "vertical",
  "tier",
  "tags",
  "notes",
  "source",
];

function esc(v: string): string {
  if (/[",\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

const csv = [
  header.join(","),
  ...rows.map((r) =>
    header.map((h) => esc(String((r as Record<string, string>)[h] ?? ""))).join(","),
  ),
].join("\n");

const out = path.resolve(__dirname, "../leads-50-draft-batch.csv");
fs.writeFileSync(out, csv + "\n", "utf8");
console.log(`wrote ${rows.length} rows → ${out}`);
