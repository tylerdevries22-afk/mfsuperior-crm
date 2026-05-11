#!/usr/bin/env tsx
/**
 * Build leads-denver-batch-1.csv from the DENVER_BATCH_1 candidate pool.
 *
 * Pipeline:
 *   1. Parallel MX-lookup every candidate domain via Node DNS
 *   2. Drop domains with no MX, freemail, or disposable mailbox services
 *   3. Generate the best role-account email per vertical
 *   4. Sort by tier (A→C), refrigerated-first
 *   5. Cap at 50 and emit CSV ready for /leads/import
 *
 * Run: npx tsx scripts/build-denver-batch-1.ts
 */

import { promises as dns } from "node:dns";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DENVER_BATCH_1,
  type FrontRangeCandidate,
} from "../src/lib/research/denver-batch-1.js";

const FREEMAIL = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
  "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com",
  "yandex.com", "gmx.com", "mail.com", "zoho.com",
]);
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "throwaway.email", "trashmail.com", "yopmail.com", "temp-mail.org",
]);

// Vertical-aware role account preferences. First match wins.
const ROLE_BY_VERTICAL: Record<FrontRangeCandidate["industry"], string> = {
  restaurants: "orders",
  bigbox: "procurement",
  brokers: "dispatch",
  construction: "orders",
  smallbiz: "info",
};

type ValidationResult = {
  candidate: FrontRangeCandidate;
  ok: boolean;
  mxCount: number;
  reason?: string;
};

async function validate(c: FrontRangeCandidate): Promise<ValidationResult> {
  if (FREEMAIL.has(c.domain)) {
    return { candidate: c, ok: false, mxCount: 0, reason: "freemail" };
  }
  if (DISPOSABLE.has(c.domain)) {
    return { candidate: c, ok: false, mxCount: 0, reason: "disposable" };
  }
  try {
    const records = await dns.resolveMx(c.domain);
    if (records.length === 0) {
      return { candidate: c, ok: false, mxCount: 0, reason: "no_mx" };
    }
    return { candidate: c, ok: true, mxCount: records.length };
  } catch (err) {
    return {
      candidate: c,
      ok: false,
      mxCount: 0,
      reason: (err as NodeJS.ErrnoException).code ?? "dns_error",
    };
  }
}

async function main(): Promise<void> {
  console.log(`Validating ${DENVER_BATCH_1.length} candidate domains…\n`);

  const results = await Promise.all(DENVER_BATCH_1.map(validate));
  const valid = results.filter((r) => r.ok);
  const dropped = results.filter((r) => !r.ok);

  console.log(`MX OK:   ${valid.length} / ${DENVER_BATCH_1.length}`);
  console.log(`Dropped: ${dropped.length}\n`);

  if (dropped.length > 0) {
    console.log("Dropped detail:");
    for (const d of dropped) {
      console.log(
        `  – ${d.candidate.domain.padEnd(32)} ${d.reason?.padEnd(12)} (${d.candidate.companyName})`,
      );
    }
    console.log();
  }

  const rows = valid.map(({ candidate: c }) => {
    const role = ROLE_BY_VERTICAL[c.industry];
    const email = `${role}@${c.domain}`;
    const tags = [
      `tier-${c.tierHint}`,
      c.refrigerated ? "refrigerated" : null,
      "denver-batch-1",
      "email-role-account",
    ]
      .filter(Boolean)
      .join("|");
    return {
      companyName: c.companyName,
      website: `https://${c.domain}`,
      email,
      phone: "",
      address: "",
      city: c.city,
      state: c.state,
      vertical: c.industry,
      tier: c.tierHint,
      tags,
      notes: c.notes,
      source: "denver-batch-1",
    };
  });

  rows.sort((a, b) => {
    const tierOrder = a.tier.localeCompare(b.tier);
    if (tierOrder !== 0) return tierOrder;
    const aRef = a.tags.includes("refrigerated") ? 0 : 1;
    const bRef = b.tags.includes("refrigerated") ? 0 : 1;
    return aRef - bRef;
  });

  const top50 = rows.slice(0, 50);

  const header = [
    "companyName", "website", "email", "phone", "address", "city", "state",
    "vertical", "tier", "tags", "notes", "source",
  ] as const;
  const escape = (s: string): string => {
    const v = s == null ? "" : String(s);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const csv = [
    header.join(","),
    ...top50.map((r) => header.map((h) => escape(r[h])).join(",")),
  ].join("\n");

  const outPath = join(process.cwd(), "leads-denver-batch-1.csv");
  await writeFile(outPath, csv, "utf8");
  console.log(`✔ Wrote ${top50.length} leads to leads-denver-batch-1.csv\n`);

  const byKey = (key: keyof (typeof top50)[number]): Record<string, number> =>
    top50.reduce<Record<string, number>>(
      (m, r) => ((m[String(r[key])] = (m[String(r[key])] ?? 0) + 1), m),
      {},
    );
  console.log("Vertical:", byKey("vertical"));
  console.log("Tier:    ", byKey("tier"));
  const refrig = top50.filter((r) => r.tags.includes("refrigerated")).length;
  console.log(`Refrig:   ${refrig} / ${top50.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
