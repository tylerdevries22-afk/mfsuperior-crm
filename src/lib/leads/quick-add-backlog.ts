/**
 * Quick-add backlog: pre-verified lead candidates that the Quick-add
 * button drains instantly.
 *
 * Two operations:
 *
 *   drainBacklog(N)
 *     Pop ≤N rows from the backlog. Returns them in the order
 *     they were verified (oldest first so we keep churning through
 *     entries and re-verifying their freshness on the refill loop).
 *     Caller is responsible for actually inserting them into `leads`
 *     and deleting the consumed backlog rows.
 *
 *   refillBacklog({ target, log? })
 *     Run the website-scrape + Hunter pipeline against `CURATED_DENVER`
 *     until the backlog holds `target` rows. Skips candidates that
 *     are already in either `leads` or `quick_add_backlog`.
 *     Designed to run inside Next.js `after()` — fires AFTER the
 *     redirect response is sent so operators don't pay for the
 *     verify work on the click latency.
 */

import { desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  leads as leadsTable,
  quickAddBacklog,
} from "@/lib/db/schema";
import { CURATED_DENVER } from "@/lib/research/curated-denver";
import { verifyWebsiteEmail } from "@/lib/research/verify-website-email";
import {
  HunterClient,
  pickBestContact,
  type Budget as HunterBudget,
} from "@/lib/research/hunter";
import { loadCache, saveCache, currentMonth } from "@/lib/research/cache";

const HUNTER_FREE_TIER_CAP = 25;

export type BacklogRow = {
  id: string;
  email: string;
  companyName: string;
  website: string | null;
  industry: string | null;
  vertical: string | null;
  refrigerated: boolean;
  chain: boolean;
  source: string;
  sourceNote: string | null;
};

/** Pop up to `target` rows from the backlog (no DB writes — the
 *  caller deletes them after the lead insert succeeds). */
export async function drainBacklog(target: number): Promise<BacklogRow[]> {
  return await db
    .select({
      id: quickAddBacklog.id,
      email: quickAddBacklog.email,
      companyName: quickAddBacklog.companyName,
      website: quickAddBacklog.website,
      industry: quickAddBacklog.industry,
      vertical: quickAddBacklog.vertical,
      refrigerated: quickAddBacklog.refrigerated,
      chain: quickAddBacklog.chain,
      source: quickAddBacklog.source,
      sourceNote: quickAddBacklog.sourceNote,
    })
    .from(quickAddBacklog)
    .orderBy(desc(quickAddBacklog.verifiedAt))
    .limit(target);
}

/** Delete consumed backlog rows by id. Called after a successful
 *  lead insert so the same candidates can't be inserted twice. */
export async function deleteConsumedBacklog(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(quickAddBacklog).where(inArray(quickAddBacklog.id, ids));
}

/** Current backlog size. Cheap — just `COUNT(*)`. */
export async function backlogSize(): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quickAddBacklog);
  return count;
}

const VERTICAL_LABEL: Record<string, string> = {
  restaurants: "Restaurant",
  bigbox: "Big-box retail",
  brokers: "Freight broker / 3PL",
  smallbiz: "Small business",
  construction: "Construction / contractor",
  cannabis: "Cannabis (dispensary / cultivation)",
};

/**
 * Refill the backlog up to `target` rows. Designed for Next.js
 * `after()` — the function self-budgets time so a slow tail
 * candidate doesn't push past the Vercel function timeout.
 *
 * The verify pipeline is the same as the inline Quick-add path:
 *   1. website-scrape (free, ~3s per candidate)
 *   2. Hunter `domainSearch` + `verify` fallback (within free-tier cap)
 *
 * Skips candidates already in `leads` OR already in `quick_add_backlog`.
 */
export async function refillBacklog(opts: {
  target: number;
  /** Soft deadline in ms — the refill returns early if reached.
   *  Defaults to 50s, leaving headroom under Vercel's 60s ceiling. */
  deadlineMs?: number;
  log?: (msg: string) => void;
}): Promise<{ inserted: number; viaWebsite: number; viaHunter: number; partial: boolean }> {
  const start = Date.now();
  const deadline = opts.deadlineMs ?? 50_000;
  const log = opts.log ?? (() => {});

  // 1. How many do we need?
  const existing = await backlogSize();
  let toAdd = Math.max(0, opts.target - existing);
  if (toAdd === 0) {
    return { inserted: 0, viaWebsite: 0, viaHunter: 0, partial: false };
  }

  // 2. Dedupe vs both `leads` (non-archived) AND existing backlog
  //    rows so the same email isn't picked twice.
  const [leadsRows, backlogRows] = await Promise.all([
    db
      .select({ email: leadsTable.email, website: leadsTable.website, companyName: leadsTable.companyName })
      .from(leadsTable)
      .where(isNull(leadsTable.archivedAt)),
    db.select({ email: quickAddBacklog.email }).from(quickAddBacklog),
  ]);

  const takenDomains = new Set<string>();
  const takenNames = new Set<string>();
  const takenEmails = new Set<string>();
  for (const r of leadsRows) {
    if (r.companyName) takenNames.add(r.companyName);
    if (r.email) {
      takenEmails.add(r.email.toLowerCase());
      const d = r.email.split("@")[1]?.toLowerCase();
      if (d) takenDomains.add(d);
    }
    if (r.website) {
      const m = r.website.match(/^https?:\/\/(?:www\.)?([^/]+)/i);
      const d = m?.[1]?.toLowerCase();
      if (d) takenDomains.add(d);
    }
  }
  for (const r of backlogRows) {
    takenEmails.add(r.email.toLowerCase());
    const d = r.email.split("@")[1]?.toLowerCase();
    if (d) takenDomains.add(d);
  }

  // 3. Shuffle the curated list so repeat refills sample different
  //    candidates instead of pinning to the first 50.
  const work = [...CURATED_DENVER].filter(
    (c) =>
      !takenDomains.has(c.domain.toLowerCase()) &&
      !takenNames.has(c.name),
  );
  for (let i = work.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [work[i], work[j]] = [work[j], work[i]];
  }

  // 4. Hunter client (optional — backlog refill works without it).
  let hunter: HunterClient | null = null;
  let cachedSearchesUsed = 0;
  let cachedVerificationsUsed = 0;
  if (process.env.HUNTER_API_KEY) {
    try {
      const cache = loadCache();
      cachedSearchesUsed = cache.hunterUsage.searches;
      cachedVerificationsUsed = cache.hunterUsage.verifications;
      const budget: HunterBudget = {
        searches: { used: cachedSearchesUsed, cap: HUNTER_FREE_TIER_CAP },
        verifications: { used: cachedVerificationsUsed, cap: HUNTER_FREE_TIER_CAP },
      };
      hunter = new HunterClient(process.env.HUNTER_API_KEY, budget, log);
    } catch (err) {
      log(`[backlog/refill] hunter init failed: ${(err as Error).message}`);
    }
  }

  // 5. Worker pool. Each worker tries website-scrape first, then
  //    Hunter; on success inserts a backlog row (skip on conflict).
  type Result = { kind: "website" | "hunter"; entry: (typeof work)[number]; email: string; note: string };
  const accepted: Result[] = [];
  const queue = [...work];

  const tryOne = async (c: (typeof work)[number]): Promise<Result | null> => {
    try {
      const r = await verifyWebsiteEmail(c.domain, 4_000);
      if (r.kind === "verified" && !takenEmails.has(r.email.toLowerCase())) {
        return {
          kind: "website",
          entry: c,
          email: r.email,
          note: `Scraped from https://${c.domain}${r.sourcePath}; MX-validated.`,
        };
      }
      if (r.kind !== "verified" && r.reason === "mx_failed") {
        return null; // dead domain — Hunter can't help
      }
    } catch {
      return null;
    }
    if (!hunter) return null;
    const left = hunter.budgetLeft();
    if (left.searches <= 0 || left.verifications <= 0) return null;
    try {
      const search = await hunter.domainSearch(c.domain);
      if (!search || search.emails.length === 0) return null;
      const best = pickBestContact(search.emails);
      if (!best?.value) return null;
      if (takenEmails.has(best.value.toLowerCase())) return null;
      const v = await hunter.verify(best.value);
      if (v?.result !== "deliverable") return null;
      return {
        kind: "hunter",
        entry: c,
        email: best.value,
        note: `Hunter API: domain-search → ${best.value} (deliverable${
          v.score != null ? `, score ${v.score}` : ""
        }${best.position ? `, ${best.position}` : ""}).`,
      };
    } catch {
      return null;
    }
  };

  const CONCURRENCY = 6;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0 && accepted.length < toAdd && Date.now() - start < deadline) {
      const c = queue.shift();
      if (!c) break;
      const r = await tryOne(c);
      if (r && accepted.length < toAdd) {
        // Mark immediately so other workers don't double-add.
        takenEmails.add(r.email.toLowerCase());
        accepted.push(r);
      }
    }
  });
  await Promise.all(workers);

  const partial = accepted.length < toAdd && Date.now() - start >= deadline;
  toAdd; // silence unused linter

  // 6. Bulk insert with conflict skip — race-safe in case another
  //    request also refilled while we were working.
  let inserted = 0;
  let viaWebsite = 0;
  let viaHunter = 0;
  if (accepted.length > 0) {
    const values = accepted.slice(0, opts.target).map((r) => {
      const vertical = VERTICAL_LABEL[r.entry.industry] ?? null;
      const refrigerated = Boolean(
        r.entry.refrigerated || r.entry.industry === "restaurants",
      );
      const chain = Boolean(r.entry.chain);
      if (r.kind === "website") viaWebsite += 1;
      else viaHunter += 1;
      return {
        email: r.email,
        companyName: r.entry.name,
        website: `https://${r.entry.domain}`,
        industry: r.entry.industry,
        vertical,
        refrigerated,
        chain,
        source: r.kind === "website" ? "website-scrape" : "hunter-search",
        sourceNote: r.note,
      };
    });
    try {
      const ret = await db
        .insert(quickAddBacklog)
        .values(values)
        .onConflictDoNothing()
        .returning({ id: quickAddBacklog.id });
      inserted = ret.length;
    } catch (err) {
      log(`[backlog/refill] insert failed: ${(err as Error).message}`);
    }
  }

  // 7. Persist Hunter usage (no-op on Vercel's read-only FS but
  //    keeps local dev counters honest).
  if (hunter) {
    try {
      const cache = loadCache();
      const left = hunter.budgetLeft();
      cache.hunterUsage = {
        month: currentMonth(),
        searches: HUNTER_FREE_TIER_CAP - left.searches,
        verifications: HUNTER_FREE_TIER_CAP - left.verifications,
      };
      saveCache(cache);
    } catch {}
  }

  return { inserted, viaWebsite, viaHunter, partial };
}

// Suppress unused-export warnings on the eq import. It's available
// for callers who want to query the backlog by email.
void eq;
