"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { db } from "@/lib/db/client";
import { auditLog, leads as leadsTable, suppressionList } from "@/lib/db/schema";
import { CURATED_DENVER } from "@/lib/research/curated-denver";
import {
  defaultProviderFor,
  tickSequences,
} from "@/lib/sequences/tick";
import {
  defaultPollProviderFor,
  pollInbox,
} from "@/lib/sequences/poll-inbox";
import { syncDrive } from "@/lib/sequences/sync-drive";
import { runResearch, type RunMode } from "@/lib/research/run";
import {
  COUNTIES,
  fetchOsmBusinesses,
  rootDomain,
  type Business,
  type County,
} from "@/lib/research/osm";
import type { Industry } from "@/lib/research/score";
import { verifyWebsiteEmail } from "@/lib/research/verify-website-email";
import {
  HunterClient,
  pickBestContact,
  type Budget as HunterBudget,
} from "@/lib/research/hunter";
import { loadCache, saveCache, currentMonth } from "@/lib/research/cache";

/**
 * Manually trigger the sequence tick. Authed UI users only — this is a
 * convenience for local development and on-call ops, not a Cron entry point.
 * (The Cron entry point lives at /api/cron/tick-sequences with Bearer auth.)
 */
export async function manualTickAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Touch env so misconfigured deployments fail loudly here, not silently in tick.
  env();

  const report = await tickSequences({ providerFor: defaultProviderFor });

  revalidatePath("/admin");
  const params = new URLSearchParams({
    drafted: String(report.drafted),
    sent: String(report.sent),
    completed: String(report.completed),
    paused: String(report.paused),
    suppressed: String(report.skippedSuppressed),
    no_email: String(report.skippedNoEmail),
    capped: String(report.skippedCapped),
    failed: String(report.failed),
    due: String(report.due),
    dur: String(report.durationMs),
    notes: report.notes.length
      ? encodeURIComponent(report.notes.join("|"))
      : "",
  });
  // Keep the operator on the Engine tab after a manual tick so the
  // result panel they just triggered remains visible.
  redirect(`/admin?tab=tick&${params.toString()}`);
}

export async function manualPollAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  env();

  const report = await pollInbox({ providerFor: defaultPollProviderFor });

  revalidatePath("/admin");
  const params = new URLSearchParams({
    poll: "1",
    threads: String(report.threadsChecked),
    replies: String(report.repliesFound),
    bounces: String(report.bouncesFound),
    handled: String(report.alreadyHandled),
    poll_errors: String(report.errors),
    poll_dur: String(report.durationMs),
    poll_notes: report.notes.length
      ? encodeURIComponent(report.notes.join("|"))
      : "",
  });
  redirect(`/admin?tab=tick&${params.toString()}`);
}

export async function addSuppressionAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const email = z.string().email().parse(formData.get("email"));
  const reason = z.enum(["manual", "unsubscribed", "bounced", "invalid", "replied"]).parse(
    formData.get("reason") ?? "manual",
  );
  const notes = z.string().max(500).optional().parse(formData.get("notes") ?? undefined);

  await db
    .insert(suppressionList)
    .values({ email: email.toLowerCase(), reason, notes: notes ?? null })
    .onConflictDoNothing();

  revalidatePath("/admin");
}

export async function removeSuppressionAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const email = z.string().email().parse(formData.get("email"));

  await db.delete(suppressionList).where(eq(suppressionList.email, email.toLowerCase()));

  revalidatePath("/admin");
}

/* ── Lead research (free + paid) ─────────────────────────────────── */

const ALL_INDUSTRIES: readonly Industry[] = [
  "restaurants",
  "bigbox",
  "brokers",
  "smallbiz",
  "construction",
  "cannabis",
] as const;

const researchSchema = z.object({
  mode: z.enum(["free", "paid"]),
  // Vercel Hobby has a 10s function timeout; Pro is 60s. Cap UI button
  // at 10 leads so it fits comfortably; larger runs go through the CLI.
  limit: z.coerce.number().int().min(1).max(20).default(5),
  industries: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? (s.split(",").filter((i) => ALL_INDUSTRIES.includes(i as Industry)) as Industry[])
        : [...ALL_INDUSTRIES],
    ),
  counties: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? (s.split(",").filter((c) => (COUNTIES as readonly string[]).includes(c)) as County[])
        : [...COUNTIES],
    ),
});

async function runResearchAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  env();

  const parsed = researchSchema.parse({
    mode: formData.get("mode"),
    limit: formData.get("limit") ?? 5,
    industries: formData.get("industries") ?? undefined,
    counties: formData.get("counties") ?? undefined,
  });

  // Paid mode requires both API keys; bail with a clear error param.
  if (parsed.mode === "paid") {
    if (!process.env.GOOGLE_MAPS_API_KEY || !process.env.HUNTER_API_KEY) {
      revalidatePath("/admin");
      const params = new URLSearchParams({
        research: "1",
        research_mode: "paid",
        research_error: "missing_api_keys",
      });
      redirect(`/admin?tab=imports&${params.toString()}`);
    }
  }

  const start = Date.now();
  // Fast mode for server-action invocation: takes only `limit` curated
  // entries, skips OSM Overpass (Vercel's outbound to Overpass is
  // unreliable), skips per-domain web scraping (too slow), goes
  // straight to MX-validating info@<domain>. Total time per click is
  // limit × ~200ms which fits inside Vercel Hobby's 10s timeout.
  // noCache=true because Vercel serverless filesystem is read-only;
  // dedup is handled by the unique indexes on the leads table.
  const report = await runResearch({
    mode: parsed.mode as RunMode,
    limit: parsed.limit,
    industries: parsed.industries,
    counties: parsed.counties,
    fast: parsed.mode === "free",
    noCache: true,
    db,
    sourceLabel: `research-${parsed.mode}-admin`,
    log: (m) => console.log(m),
  });
  const dur = Date.now() - start;

  revalidatePath("/admin");
  revalidatePath("/leads");

  const params = new URLSearchParams({
    research: "1",
    research_mode: parsed.mode,
    r_discovered: String(report.discovered),
    r_enriched: String(report.enriched),
    r_a: String(report.tierA),
    r_b: String(report.tierB),
    r_c: String(report.tierC),
    r_dropped: String(report.dropped),
    r_refrig: String(report.refrigerated),
    r_inserted: String(report.inserted),
    r_updated: String(report.updated),
    r_conflicts: String(report.conflicts),
    r_no_email: String(report.needsManualEmail),
    r_freemail: String(report.freemail),
    r_role: String(report.roleAccount),
    r_dur: String(dur),
  });
  redirect(`/admin?tab=imports&${params.toString()}`);
}

export async function runFreeResearchAction(formData: FormData): Promise<void> {
  formData.set("mode", "free");
  return runResearchAction(formData);
}

export async function runPaidResearchAction(formData: FormData): Promise<void> {
  formData.set("mode", "paid");
  return runResearchAction(formData);
}

/* ── Quick-add Denver Metro starter pack ─────────────────────────── */

/**
 * Dead-simple action that bypasses the entire research pipeline. Just
 * upserts a fixed set of curated Denver Metro businesses with email +
 * tier + tags pre-baked. Used as a guaranteed-working fallback when the
 * full research action seems to fail silently — and as a fast way to
 * populate the CRM with real leads in <1s.
 *
 * Redirects DIRECTLY to /leads (not /admin) so the operator immediately
 * sees the inserted rows.
 */
export async function quickAddStarterPackAction(): Promise<void> {
  // Capture every possible failure mode and surface it in the redirect
  // URL so the operator sees something visible instead of a silent no-op.
  //
  // Performance note: 150 entries × 3 serial DB roundtrips = ~450 queries,
  // which blows Vercel Hobby's 10s function limit on Neon cold starts.
  // This implementation does ONE bulk SELECT + ONE bulk INSERT + parallel
  // UPDATE batches → typically <2s total.
  let errorMsg: string | null = null;
  let inserted = 0;
  let updated = 0;
  let enriched = 0; // existing email-null rows whose email we filled in
  let unarchived = 0; // matches that were archived; brought back to life
  let skipped = 0;
  let attempted = 0;
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      errorMsg = "unauthorized";
    } else {
      env();

      const sample = CURATED_DENVER;
      attempted = sample.length;

      const verticalLabel: Record<string, string> = {
        restaurants: "Restaurant",
        bigbox: "Big-box retail",
        brokers: "Freight broker / 3PL",
        smallbiz: "Small business",
        construction: "Construction / contractor",
        cannabis: "Cannabis (dispensary / cultivation)",
      };

      // Build a normalized work item per curated entry.
      type Work = {
        c: (typeof sample)[number];
        email: string;
        website: string;
        vertical: string;
        tags: string[];
      };
      const work: Work[] = sample.map((c) => {
        const tags: string[] = [
          "tier-A",
          verticalLabel[c.industry],
          "email-guessed",
        ];
        if (c.refrigerated || c.industry === "restaurants") tags.push("refrigerated");
        if (c.chain) tags.push("chain-store");
        return {
          c,
          email: `${c.emailLocal ?? "info"}@${c.domain}`,
          website: `https://${c.domain}`,
          vertical: verticalLabel[c.industry],
          tags,
        };
      });

      const allEmails = work.map((w) => w.email);
      const allNames = work.map((w) => w.c.name);

      // ── ONE bulk SELECT for every possible match ────────────────────
      // Fetches: (a) rows whose email matches any expected email,
      //          (b) rows whose companyName matches any expected name
      //              AND email IS NULL (legacy spreadsheet rows).
      const existing = await db
        .select({
          id: leadsTable.id,
          email: leadsTable.email,
          companyName: leadsTable.companyName,
          archivedAt: leadsTable.archivedAt,
        })
        .from(leadsTable)
        .where(
          or(
            inArray(leadsTable.email, allEmails),
            and(
              inArray(leadsTable.companyName, allNames),
              isNull(leadsTable.email),
            ),
          ),
        );

      const byEmailMap = new Map<
        string,
        { id: string; archivedAt: Date | null }
      >();
      const byNameNullEmailMap = new Map<
        string,
        { id: string; archivedAt: Date | null }
      >();
      for (const row of existing) {
        if (row.email) {
          byEmailMap.set(row.email, { id: row.id, archivedAt: row.archivedAt });
        } else if (row.companyName) {
          byNameNullEmailMap.set(row.companyName, {
            id: row.id,
            archivedAt: row.archivedAt,
          });
        }
      }

      // ── Categorize each work item in memory ─────────────────────────
      type UpdatePayload = {
        id: string;
        email: string | null; // null when path 1 (email already matches)
        companyName: string;
        vertical: string;
        website: string;
        tags: string[];
        wasArchived: boolean;
        path: "update" | "enrich";
      };
      const toUpdate: UpdatePayload[] = [];
      const toInsert: Array<{
        email: string;
        companyName: string;
        website: string;
        vertical: string;
        tags: string[];
      }> = [];

      for (const w of work) {
        const matchByEmail = byEmailMap.get(w.email);
        if (matchByEmail) {
          toUpdate.push({
            id: matchByEmail.id,
            email: null,
            companyName: w.c.name,
            vertical: w.vertical,
            website: w.website,
            tags: w.tags,
            wasArchived: matchByEmail.archivedAt !== null,
            path: "update",
          });
          continue;
        }
        const matchByName = byNameNullEmailMap.get(w.c.name);
        if (matchByName) {
          toUpdate.push({
            id: matchByName.id,
            email: w.email,
            companyName: w.c.name,
            vertical: w.vertical,
            website: w.website,
            tags: w.tags,
            wasArchived: matchByName.archivedAt !== null,
            path: "enrich",
          });
          continue;
        }
        toInsert.push({
          email: w.email,
          companyName: w.c.name,
          website: w.website,
          vertical: w.vertical,
          tags: w.tags,
        });
      }

      // ── ONE bulk INSERT for all new rows ────────────────────────────
      if (toInsert.length > 0) {
        try {
          await db.insert(leadsTable).values(
            toInsert.map((i) => ({
              email: i.email,
              phone: null,
              companyName: i.companyName,
              website: i.website,
              vertical: i.vertical,
              address: null,
              city: "Denver Metro",
              state: "CO",
              source: "starter-pack",
              tier: "A" as const,
              score: 75,
              tags: i.tags,
              notes:
                "Denver Metro starter pack — backfill specific store address as needed.",
            })),
          );
          inserted = toInsert.length;
        } catch (err) {
          skipped += toInsert.length;
          console.error(
            "[quickAdd] bulk insert failed:",
            (err as Error).message,
          );
        }
      }

      // ── Parallel UPDATEs in batches of 20 ───────────────────────────
      const BATCH = 20;
      for (let i = 0; i < toUpdate.length; i += BATCH) {
        const slice = toUpdate.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          slice.map((u) => {
            const set: Record<string, unknown> = {
              companyName: u.companyName,
              vertical: u.vertical,
              website: u.website,
              tier: "A",
              score: 75,
              tags: u.tags,
              archivedAt: null,
              updatedAt: new Date(),
            };
            if (u.email !== null) {
              set.email = u.email;
              set.source = "starter-pack";
            }
            return db
              .update(leadsTable)
              .set(set)
              .where(eq(leadsTable.id, u.id));
          }),
        );
        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          const u = slice[j];
          if (r.status === "fulfilled") {
            if (u.path === "update") updated++;
            else enriched++;
            if (u.wasArchived) unarchived++;
          } else {
            skipped++;
            console.error(
              "[quickAdd] update failed for",
              u.companyName,
              (r.reason as Error)?.message,
            );
          }
        }
      }

      try {
        await db.insert(auditLog).values({
          actorUserId: session.user.id,
          entity: "leads",
          entityId: null,
          action: "starter_pack_run",
          beforeJson: null,
          afterJson: {
            inserted,
            updated,
            enriched,
            unarchived,
            skipped,
            total: attempted,
            durationMs: Date.now() - start,
          },
          occurredAt: sql`now()`,
        });
      } catch (err) {
        console.error("[quickAdd] audit failed:", (err as Error).message);
      }
    }
  } catch (err) {
    errorMsg =
      (err as Error).name + ": " + (err as Error).message.slice(0, 120);
    console.error("[quickAdd] FATAL:", err);
  }

  revalidatePath("/leads");
  revalidatePath("/admin");

  const params = new URLSearchParams({
    just_added: String(inserted),
    just_updated: String(updated),
    just_enriched: String(enriched),
    just_unarchived: String(unarchived),
    just_skipped: String(skipped),
    starter: "1",
    stage: "all",
  });
  if (errorMsg) params.set("starter_error", errorMsg);
  // redirect() throws NEXT_REDIRECT — it MUST be outside the try/catch above.
  redirect(`/leads?${params.toString()}`);
}

/* ── Purge leads without an email (archive, not hard-delete) ─────── */

/**
 * Archives every lead where `email IS NULL` by setting archivedAt to
 * now. The /leads list already filters `WHERE archivedAt IS NULL`,
 * so archived rows disappear from the worklist immediately. Reversible:
 * `UPDATE leads SET archived_at = NULL WHERE source = 'spreadsheet'`
 * brings them back if needed.
 */
export async function purgeNoEmailLeadsAction(): Promise<void> {
  let errorMsg: string | null = null;
  let archivedCount = 0;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      errorMsg = "unauthorized";
    } else {
      env();

      const result = await db
        .update(leadsTable)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(isNull(leadsTable.email), isNull(leadsTable.archivedAt)))
        .returning({ id: leadsTable.id });
      archivedCount = result.length;

      try {
        await db.insert(auditLog).values({
          actorUserId: session.user.id,
          entity: "leads",
          entityId: null,
          action: "purge_no_email",
          beforeJson: null,
          afterJson: { archived: archivedCount },
          occurredAt: sql`now()`,
        });
      } catch (err) {
        console.error("[purge] audit failed:", (err as Error).message);
      }
    }
  } catch (err) {
    errorMsg = (err as Error).name + ": " + (err as Error).message.slice(0, 120);
    console.error("[purge] FATAL:", err);
  }

  revalidatePath("/leads");
  revalidatePath("/admin");

  const params = new URLSearchParams({
    purged: "1",
    archived: String(archivedCount),
    stage: "all",
  });
  if (errorMsg) params.set("purge_error", errorMsg);
  redirect(`/leads?${params.toString()}`);
}

export async function manualSyncAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  env();

  const report = await syncDrive();

  revalidatePath("/admin");
  revalidatePath("/leads");
  const params = new URLSearchParams({
    sync: "1",
    sync_file: report.sourceFile ?? "",
    sync_rows: String(report.sheetRows),
    sync_inserted: String(report.inserted),
    sync_confirmed: String(report.confirmed),
    sync_orphans: String(report.orphansFlagged),
    sync_orphans_cleared: String(report.orphansCleared),
    sync_pushed: String(report.pushedExported),
    sync_pushed_file: report.pushedFileName ?? "",
    sync_dur: String(report.durationMs),
    sync_notes: report.notes.length
      ? encodeURIComponent(report.notes.join("|"))
      : "",
  });
  redirect(`/admin?tab=tick&${params.toString()}`);
}

/* ── Verified Quick-add (website-extracted emails, never guessed) ── */

/**
 * Replacement for quickAddStarterPackAction that NEVER guesses emails.
 *
 * For each curated entry:
 *   1. Skip if a non-archived lead with this domain or company name already exists.
 *   2. Scrape the company website (cheerio, multiple paths, in parallel).
 *   3. Pick the highest-seniority extractable email.
 *   4. MX-validate (DNS resolveMx). Reject freemail / disposable / no_mx.
 *   5. Insert the lead with tag `email-verified` + a `source: "website-scrape"`.
 *   6. If any step fails, skip — never insert with a guessed address.
 *
 * Runs all 150 curated entries in parallel with a 4s per-company hard cap.
 * Expected wall time: 5-8s on a warm Vercel lambda. Many curated companies
 * (big-box chains, freight brokers) won't publish a contact email, so the
 * insert count will typically be far lower than the curated total — but
 * every inserted row is a real, deliverable address.
 */
/**
 * Quick-add — fast path.
 *
 * Operator-perceived behaviour: click → ≤1 second to ≤20 fresh
 * verified-email leads inserted, page redirects with a toast.
 *
 * Implementation: a separate `quick_add_backlog` table is filled
 * asynchronously with pre-verified candidates (see
 * `src/lib/leads/quick-add-backlog.ts`). The Quick-add click just
 * drains that backlog into `leads` and triggers a refill via
 * Next.js `after()` so the next click also lands instantly. The
 * slow website-scrape + Hunter pipeline NEVER runs on the click's
 * critical path — only in the deferred refill.
 *
 * If the backlog is empty (first click after deploy, or a refill
 * still pending), the action still returns immediately but with
 * `v_inserted=0` + `v_backlog_warming=1`; the toast tells the
 * operator to click again in ~30 seconds.
 */
const QUICKADD_DRAIN = 20;
const BACKLOG_REFILL_TARGET = 40;

export async function verifiedQuickAddAction(): Promise<void> {
  let errorMsg: string | null = null;
  let inserted = 0;
  let viaWebsite = 0;
  let viaHunter = 0;
  let backlogBefore = 0;
  let backlogAfterDrain = 0;
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      errorMsg = "unauthorized";
    } else {
      env();

      const { drainBacklog, deleteConsumedBacklog, backlogSize, refillBacklog } =
        await import("@/lib/leads/quick-add-backlog");

      backlogBefore = await backlogSize();

      // 1. Drain up to N rows from the backlog.
      const drained = await drainBacklog(QUICKADD_DRAIN);

      // 2. Bulk insert into leads. `onConflictDoNothing` guards
      //    against a race with another tab clicking Quick-add
      //    simultaneously (the partial unique indexes on
      //    `leads_email_unique` / `leads_company_no_email_unique`
      //    will reject duplicates). Drained rows that fail the
      //    insert are still removed from the backlog so they
      //    don't pin the queue.
      if (drained.length > 0) {
        const values = drained.map((r) => {
          const tags: string[] = [
            "tier-A",
            r.vertical ?? "Small business",
            "email-verified",
            r.source === "hunter-search"
              ? "email-api-verified"
              : "email-website-confirmed",
          ];
          if (r.refrigerated) tags.push("refrigerated");
          if (r.chain) tags.push("chain-store");
          if (r.source === "hunter-search") viaHunter += 1;
          else viaWebsite += 1;
          return {
            email: r.email,
            phone: null,
            companyName: r.companyName,
            website: r.website,
            vertical: r.vertical,
            address: null,
            city: "Denver Metro",
            state: "CO",
            source: r.source,
            tier: "A" as const,
            score: 80,
            tags,
            emailTrust: "verified",
            emailValidatedAt: sql`now()` as unknown as Date,
            notes: r.sourceNote,
          };
        });
        try {
          const ret = await db
            .insert(leadsTable)
            .values(values)
            .onConflictDoNothing()
            .returning({ id: leadsTable.id });
          inserted = ret.length;
        } catch (err) {
          console.error(
            "[verifiedQuickAdd] bulk insert failed:",
            (err as Error).message,
          );
        }

        // Delete consumed backlog rows regardless of insert success —
        // a duplicate-email failure means the entry is already in
        // `leads` (or another tab beat us), so the backlog row is
        // stale either way.
        await deleteConsumedBacklog(drained.map((r) => r.id));
      }

      backlogAfterDrain = await backlogSize();

      // 3. Defer a refill until AFTER the redirect is sent. Uses
      //    Next.js's `after()` so the operator pays zero latency
      //    for the slow verify pipeline — it runs in the function's
      //    remaining time budget (up to ~50s, deadline-protected).
      const { after } = await import("next/server");
      after(async () => {
        try {
          const report = await refillBacklog({
            target: BACKLOG_REFILL_TARGET,
            log: (m) => console.log("[backlog/refill]", m),
          });
          console.log(
            "[backlog/refill] complete:",
            JSON.stringify(report),
          );
        } catch (err) {
          console.error(
            "[backlog/refill] threw:",
            (err as Error).message,
          );
        }
      });

      // 4. Audit.
      try {
        await db.insert(auditLog).values({
          actorUserId: session.user.id,
          entity: "leads",
          entityId: null,
          action: "verified_quick_add",
          beforeJson: null,
          afterJson: {
            target: QUICKADD_DRAIN,
            backlogBefore,
            drained: drained.length,
            inserted,
            viaWebsite,
            viaHunter,
            backlogAfterDrain,
            durationMs: Date.now() - start,
          },
          occurredAt: sql`now()`,
        });
      } catch (err) {
        console.error(
          "[verifiedQuickAdd] audit failed:",
          (err as Error).message,
        );
      }
    }
  } catch (err) {
    errorMsg =
      (err as Error).name + ": " + (err as Error).message.slice(0, 120);
    console.error("[verifiedQuickAdd] FATAL:", err);
  }

  revalidatePath("/leads");
  revalidatePath("/admin");

  const params = new URLSearchParams({
    verified: "1",
    v_target: String(QUICKADD_DRAIN),
    v_inserted: String(inserted),
    v_website: String(viaWebsite),
    v_hunter: String(viaHunter),
    v_backlog_before: String(backlogBefore),
    v_backlog_after: String(backlogAfterDrain),
    v_backlog_warming: inserted === 0 && backlogBefore === 0 ? "1" : "0",
    stage: "all",
  });
  if (errorMsg) params.set("verified_error", errorMsg);
  redirect(`/leads?${params.toString()}`);
}

/* ── Wipe email-guessed leads (one-click cleanup) ───────────────── */

/**
 * Archives every non-archived lead whose `tags` array contains
 * "email-guessed". Used to clean up the 162 leads that the old
 * quickAddStarterPackAction inserted with role-prefixed guesses
 * (procurement@, dispatch@, orders@, info@) so the operator can
 * repopulate via the new verified-only pipeline.
 *
 * Reversible:
 *   UPDATE leads SET archived_at = NULL
 *   WHERE 'email-guessed' = ANY(tags) AND archived_at IS NOT NULL;
 */
export async function wipeGuessedLeadsAction(): Promise<void> {
  let errorMsg: string | null = null;
  let archived = 0;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      errorMsg = "unauthorized";
    } else {
      env();

      const result = await db
        .update(leadsTable)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            sql`'email-guessed' = ANY(${leadsTable.tags})`,
            isNull(leadsTable.archivedAt),
          ),
        )
        .returning({ id: leadsTable.id });
      archived = result.length;

      try {
        await db.insert(auditLog).values({
          actorUserId: session.user.id,
          entity: "leads",
          entityId: null,
          action: "wipe_guessed",
          beforeJson: null,
          afterJson: { archived },
          occurredAt: sql`now()`,
        });
      } catch (err) {
        console.error("[wipeGuessed] audit failed:", (err as Error).message);
      }
    }
  } catch (err) {
    errorMsg =
      (err as Error).name + ": " + (err as Error).message.slice(0, 120);
    console.error("[wipeGuessed] FATAL:", err);
  }

  revalidatePath("/leads");
  revalidatePath("/admin");

  const params = new URLSearchParams({
    wiped_guessed: "1",
    archived: String(archived),
    stage: "all",
  });
  if (errorMsg) params.set("wipe_error", errorMsg);
  redirect(`/leads?${params.toString()}`);
}

/* ── Unarchive all leads (reverse of every archive action) ─────── */

/**
 * Sets archivedAt back to NULL for every currently-archived lead — the
 * inverse of purgeNoEmailLeadsAction + wipeGuessedLeadsAction + the bulk
 * archive on /leads. Use this to recover after an over-aggressive archive
 * click.
 *
 * Equivalent SQL (for direct Neon recovery):
 *   UPDATE leads SET archived_at = NULL, updated_at = now()
 *   WHERE archived_at IS NOT NULL;
 *
 * Pass formData with `since=15m` (or `1h` / `24h` / `all`) to narrow the
 * recovery window. Default = `all`.
 */
export async function unarchiveAllLeadsAction(
  formData?: FormData,
): Promise<void> {
  let errorMsg: string | null = null;
  let unarchived = 0;
  const since = String(formData?.get("since") ?? "all");

  try {
    const session = await auth();
    if (!session?.user?.id) {
      errorMsg = "unauthorized";
    } else {
      env();

      // Optional time-window filter so the operator can recover JUST the
      // most-recent batch instead of every historical archive.
      const intervalMap: Record<string, string | null> = {
        "15m": "15 minutes",
        "1h": "1 hour",
        "24h": "24 hours",
        all: null,
      };
      const interval = intervalMap[since] ?? null;

      const whereClause = interval
        ? sql`${leadsTable.archivedAt} IS NOT NULL AND ${leadsTable.archivedAt} > now() - interval ${sql.raw(`'${interval}'`)}`
        : sql`${leadsTable.archivedAt} IS NOT NULL`;

      const result = await db
        .update(leadsTable)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(whereClause)
        .returning({ id: leadsTable.id });
      unarchived = result.length;

      try {
        await db.insert(auditLog).values({
          actorUserId: session.user.id,
          entity: "leads",
          entityId: null,
          action: "unarchive_all",
          beforeJson: null,
          afterJson: { unarchived, since },
          occurredAt: sql`now()`,
        });
      } catch (err) {
        console.error("[unarchive] audit failed:", (err as Error).message);
      }
    }
  } catch (err) {
    errorMsg =
      (err as Error).name + ": " + (err as Error).message.slice(0, 120);
    console.error("[unarchive] FATAL:", err);
  }

  revalidatePath("/leads");
  revalidatePath("/admin");

  const params = new URLSearchParams({
    unarchived: "1",
    unarchived_count: String(unarchived),
    unarchived_since: since,
    stage: "all",
  });
  if (errorMsg) params.set("unarchive_error", errorMsg);
  redirect(`/leads?${params.toString()}`);
}

/* ── Unified lead generator (OSM + curated fallback + scrape + MX) ── */

/**
 * The single coherent lead-generation pipeline. Replaces the old
 * Free/Paid research buttons and the curated quick-add variants. Every
 * inserted lead has a real, MX-validated email — companies without a
 * deliverable address are SKIPPED, never guessed.
 *
 * Pipeline:
 *   1. Auth + parse form (industries, counties, limit, source)
 *   2. Build dedupe set from existing leads (one bulk SELECT)
 *   3. Discovery — try OSM with 4s hard cap, supplement from curated
 *      list if OSM yielded < limit/2 new candidates (the "OSM with
 *      curated fallback" mode the operator picked)
 *   4. Verify each candidate's website with the PR #25 scraper + MX
 *      validator. Skip on no-email. Per-company hard cap 1.5s.
 *   5. Bulk insert survivors with `source: "lead-gen"`,
 *      `tags: ["email-verified", "discovered-via-{osm|curated}", vertical, ...]`
 *   6. Audit log + redirect with full skip breakdown
 *
 * Vercel Hobby 10s budget:
 *   100ms auth + 200ms dedupe SELECT + 4000ms OSM + 2500ms verify (parallel)
 *   + 500ms bulk INSERT + 200ms audit/redirect = ~7500ms worst case.
 */
const ALL_INDUSTRIES_LIST: readonly Industry[] = [
  "restaurants",
  "bigbox",
  "brokers",
  "smallbiz",
  "construction",
  "cannabis",
] as const;

const generateLeadsSchema = z.object({
  industries: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? (s
            .split(",")
            .filter((i) => ALL_INDUSTRIES_LIST.includes(i as Industry)) as Industry[])
        : [...ALL_INDUSTRIES_LIST],
    ),
  counties: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? (s.split(",").filter((c) =>
            (COUNTIES as readonly string[]).includes(c),
          ) as County[])
        : [...COUNTIES],
    ),
  limit: z.coerce.number().int().min(1).max(20).default(8),
  source: z
    .enum(["osm+curated", "osm", "curated"])
    .default("osm+curated"),
});

export async function generateLeadsAction(formData: FormData): Promise<void> {
  let errorMsg: string | null = null;
  let discoveredOsm = 0;
  let discoveredCurated = 0;
  let attempted = 0;
  let inserted = 0;
  let skippedAlreadyExists = 0;
  let skippedNoWebsite = 0;
  let skippedNoEmail = 0;
  let skippedMxFailed = 0;
  let skippedTimeout = 0;
  let skippedOther = 0;
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      errorMsg = "unauthorized";
    } else {
      env();

      const parsed = generateLeadsSchema.parse({
        industries: formData.get("industries") ?? undefined,
        counties: formData.get("counties") ?? undefined,
        limit: formData.get("limit") ?? 8,
        source: formData.get("source") ?? "osm+curated",
      });

      // ── Dedupe index: pull every non-archived domain we already have.
      // OSM and curated will produce a `domain`; we skip any candidate
      // whose domain matches an existing lead's email or website.
      const existingRows = await db
        .select({ email: leadsTable.email, website: leadsTable.website })
        .from(leadsTable)
        .where(isNull(leadsTable.archivedAt));
      const existingDomains = new Set<string>();
      for (const r of existingRows) {
        if (r.email) {
          const d = r.email.split("@")[1];
          if (d) existingDomains.add(d.toLowerCase());
        }
        if (r.website) {
          const d = rootDomain(r.website);
          if (d) existingDomains.add(d.toLowerCase());
        }
      }

      // ── Discovery: OSM (with 4s hard cap) → curated fallback.
      type Candidate = {
        name: string;
        domain: string;
        industry: Industry;
        source: "osm" | "curated";
        lat?: number;
        lon?: number;
        phone?: string | null;
        city?: string | null;
        state?: string | null;
      };
      const candidates: Candidate[] = [];

      const useOsm = parsed.source !== "curated";
      const useCurated = parsed.source !== "osm";

      if (useOsm) {
        // Sample one (industry, county) cell per discovery call. For Hobby
        // budget we only do ONE OSM call per click — the operator can re-
        // click for different cells.
        const industry = parsed.industries[0];
        const county = parsed.counties[0];
        try {
          const osmRes = await Promise.race([
            fetchOsmBusinesses({ industry, county }),
            new Promise<Business[]>((resolve) =>
              setTimeout(() => resolve([]), 4_000),
            ),
          ]);
          for (const b of osmRes) {
            const dom = rootDomain(b.website);
            if (!dom) {
              skippedNoWebsite++;
              continue;
            }
            if (existingDomains.has(dom.toLowerCase())) {
              skippedAlreadyExists++;
              continue;
            }
            if (candidates.some((c) => c.domain === dom)) continue;
            candidates.push({
              name: b.name,
              domain: dom,
              industry,
              source: "osm",
              lat: b.lat,
              lon: b.lon,
              phone: b.phone,
              city: b.city,
              state: b.state,
            });
            existingDomains.add(dom.toLowerCase());
            if (candidates.length >= parsed.limit * 2) break;
          }
          discoveredOsm = osmRes.length;
        } catch (err) {
          console.error("[generateLeads] OSM failed:", (err as Error).message);
        }
      }

      // Supplement from curated if (a) source is curated-only, or (b)
      // OSM + curated and discovery yielded fewer than `limit` candidates.
      if (useCurated && candidates.length < parsed.limit) {
        const curated = CURATED_DENVER.filter((c) =>
          parsed.industries.includes(c.industry),
        );
        for (const c of curated) {
          if (existingDomains.has(c.domain.toLowerCase())) {
            skippedAlreadyExists++;
            continue;
          }
          if (candidates.some((cand) => cand.domain === c.domain)) continue;
          candidates.push({
            name: c.name,
            domain: c.domain,
            industry: c.industry,
            source: "curated",
          });
          existingDomains.add(c.domain.toLowerCase());
          discoveredCurated++;
          if (candidates.length >= parsed.limit) break;
        }
      }

      attempted = candidates.length;

      // ── Verify each candidate in parallel with a tight per-company cap.
      type VerifiedHit = { c: Candidate; email: string; sourcePath: string };
      const verifyResults = await Promise.allSettled(
        candidates
          .slice(0, parsed.limit)
          .map(async (c) => {
            const r = await verifyWebsiteEmail(c.domain, 2_000);
            return { c, r };
          }),
      );

      const verified: VerifiedHit[] = [];
      for (const s of verifyResults) {
        if (s.status === "rejected") {
          skippedOther++;
          continue;
        }
        const { c, r } = s.value;
        if (r.kind === "verified") {
          verified.push({ c, email: r.email, sourcePath: r.sourcePath });
          continue;
        }
        switch (r.reason) {
          case "no_html":
          case "no_domain":
            skippedNoWebsite++;
            break;
          case "no_emails_on_website":
          case "no_usable_email":
            skippedNoEmail++;
            break;
          case "mx_failed":
            skippedMxFailed++;
            break;
          case "timeout":
            skippedTimeout++;
            break;
          default:
            skippedOther++;
        }
      }

      // ── Bulk insert survivors.
      const verticalLabel: Record<Industry, string> = {
        restaurants: "Restaurant",
        bigbox: "Big-box retail",
        brokers: "Freight broker / 3PL",
        smallbiz: "Small business",
        construction: "Construction / contractor",
        cannabis: "Cannabis (dispensary / cultivation)",
      };

      if (verified.length > 0) {
        const values = verified.map(({ c, email, sourcePath }) => {
          const vertical = verticalLabel[c.industry];
          const tags: string[] = [
            "tier-A",
            vertical,
            "email-verified",
            `discovered-via-${c.source}`,
          ];
          if (c.industry === "restaurants") tags.push("refrigerated");
          return {
            email,
            phone: c.phone ?? null,
            companyName: c.name,
            website: `https://${c.domain}`,
            vertical,
            address: null,
            city: c.city ?? "Denver Metro",
            state: c.state ?? "CO",
            source: "lead-gen" as const,
            tier: "A" as const,
            score: 80,
            tags,
            notes: `Discovered via ${c.source}; email from https://${c.domain}${sourcePath}; MX-validated.`,
          };
        });
        try {
          await db.insert(leadsTable).values(values);
          inserted = verified.length;
        } catch (err) {
          console.error(
            "[generateLeads] bulk insert failed; falling back:",
            (err as Error).message,
          );
          for (const v of values) {
            try {
              await db.insert(leadsTable).values(v);
              inserted++;
            } catch {
              skippedOther++;
            }
          }
        }
      }

      try {
        await db.insert(auditLog).values({
          actorUserId: session.user.id,
          entity: "leads",
          entityId: null,
          action: "lead_gen",
          beforeJson: null,
          afterJson: {
            industries: parsed.industries,
            counties: parsed.counties,
            limit: parsed.limit,
            source: parsed.source,
            discoveredOsm,
            discoveredCurated,
            attempted,
            inserted,
            skippedAlreadyExists,
            skippedNoWebsite,
            skippedNoEmail,
            skippedMxFailed,
            skippedTimeout,
            skippedOther,
            durationMs: Date.now() - start,
          },
          occurredAt: sql`now()`,
        });
      } catch (err) {
        console.error(
          "[generateLeads] audit failed:",
          (err as Error).message,
        );
      }
    }
  } catch (err) {
    errorMsg =
      (err as Error).name + ": " + (err as Error).message.slice(0, 120);
    console.error("[generateLeads] FATAL:", err);
  }

  revalidatePath("/leads");
  revalidatePath("/admin");

  const params = new URLSearchParams({
    gen: "1",
    g_inserted: String(inserted),
    g_attempted: String(attempted),
    g_osm: String(discoveredOsm),
    g_curated: String(discoveredCurated),
    g_already: String(skippedAlreadyExists),
    g_no_website: String(skippedNoWebsite),
    g_no_email: String(skippedNoEmail),
    g_mx_failed: String(skippedMxFailed),
    g_timeout: String(skippedTimeout),
    g_other: String(skippedOther),
    stage: "all",
  });
  if (errorMsg) params.set("gen_error", errorMsg);
  redirect(`/leads?${params.toString()}`);
}

/* ── Validate all lead emails (MX + hard-delete invalid) ────────── */

/**
 * One-shot bulk validator. Iterates every non-archived lead with a
 * non-null email, MX-validates each, and hard-deletes the failures.
 * Operator's decisions (locked in via clarifying questions):
 *
 *   - Method: MX-only (free, offline)
 *   - On fail: hard DELETE (cascades safely; FK audit confirmed)
 *   - Cadence: this manual button + weekly cron + per-send check
 *   - Forensic: full deleted-row payload captured in auditLog.beforeJson
 *     so an over-aggressive delete can be SQL-restored from the audit.
 */
export async function validateAllEmailsAction(): Promise<void> {
  let errorMsg: string | null = null;
  let checked = 0;
  let valid = 0;
  let invalid = 0;
  let hardDeleted = 0;
  let durationMs = 0;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      errorMsg = "unauthorized";
    } else {
      env();
      const { validateAllLeadEmails } = await import(
        "@/lib/email/validate-bulk"
      );
      const report = await validateAllLeadEmails({
        actorUserId: session.user.id,
      });
      checked = report.checked;
      valid = report.valid;
      invalid = report.invalid;
      hardDeleted = report.hardDeleted;
      durationMs = report.durationMs;
      if (report.errors.length > 0) {
        errorMsg = report.errors.slice(0, 3).join("; ").slice(0, 200);
      }
    }
  } catch (err) {
    errorMsg =
      (err as Error).name + ": " + (err as Error).message.slice(0, 120);
    console.error("[validateAllEmails] FATAL:", err);
  }

  revalidatePath("/leads");
  revalidatePath("/admin");

  const params = new URLSearchParams({
    validated: "1",
    v_checked: String(checked),
    v_valid: String(valid),
    v_invalid: String(invalid),
    v_deleted: String(hardDeleted),
    v_dur: String(durationMs),
  });
  if (errorMsg) params.set("validate_error", errorMsg);
  params.set("tab", "operations");
  redirect(`/admin?${params.toString()}`);
}

/* ── Email-trust pipeline backfill ──────────────────────────────── */

/**
 * Runs the full email-trust classifier (see
 * src/lib/leads/email-trust.ts — "10 approaches" research doc) over
 * every non-archived lead with an email. Populates the new
 * `email_trust` + `email_validated_at` columns, archives leads
 * that fail validation (instead of hard-deleting them like
 * validateAllEmailsAction does), and tags archived rows
 * `email-invalid` for reversibility.
 *
 * Distinct from validateAllEmailsAction:
 *   • Classifies into 4 trust levels (not just pass/fail), so the
 *     UI can show a per-row trust chip.
 *   • Archives + tags instead of hard-deleting → operator can
 *     restore a false-positive by clearing archivedAt + removing
 *     the tag from /admin Operations.
 *   • Walks every lead, regardless of prior validation state, so
 *     the UI surfaces a chip for every row.
 */
export async function revalidateAllLeadEmailsAction(): Promise<void> {
  let errorMsg: string | null = null;
  let checked = 0;
  let verified = 0;
  let guessed = 0;
  let unverified = 0;
  let invalid = 0;
  let archivedAsInvalid = 0;
  let hunterCalls = 0;
  let partial = false;
  let durationMs = 0;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      errorMsg = "unauthorized";
    } else {
      env();
      const { revalidateAllLeadEmails } = await import(
        "@/lib/leads/email-trust"
      );
      const report = await revalidateAllLeadEmails({
        actorUserId: session.user.id,
      });
      checked = report.checked;
      verified = report.byTrust.verified;
      guessed = report.byTrust.guessed;
      unverified = report.byTrust.unverified;
      invalid = report.byTrust.invalid;
      archivedAsInvalid = report.archivedAsInvalid;
      hunterCalls = report.hunterCalls;
      partial = report.partial;
      durationMs = report.durationMs;
      if (report.errors.length > 0) {
        errorMsg = report.errors.slice(0, 3).join("; ").slice(0, 200);
      }
    }
  } catch (err) {
    errorMsg =
      (err as Error).name + ": " + (err as Error).message.slice(0, 120);
    console.error("[revalidateAllLeadEmails] FATAL:", err);
  }

  revalidatePath("/leads");
  revalidatePath("/admin");

  const params = new URLSearchParams({
    trust_revalidated: "1",
    t_checked: String(checked),
    t_verified: String(verified),
    t_guessed: String(guessed),
    t_unverified: String(unverified),
    t_invalid: String(invalid),
    t_archived: String(archivedAsInvalid),
    t_hunter: String(hunterCalls),
    t_partial: partial ? "1" : "0",
    t_dur: String(durationMs),
  });
  if (errorMsg) params.set("trust_error", errorMsg);
  params.set("tab", "operations");
  redirect(`/admin?${params.toString()}`);
}

/* ── Pending-migrations apply (operator-triggered) ───────────────── */

/**
 * Idempotent ALTER TABLE pass for column-additions that the deployed
 * code has started reading but the production database doesn't have
 * yet. Lets the operator unstick the app from the browser instead of
 * needing shell access with prod credentials to run `npm run db:push`.
 *
 * Each statement uses `ADD COLUMN IF NOT EXISTS` so re-clicking after
 * the columns land is a no-op (and the audit log captures that).
 *
 * Currently applies:
 *   • leads.email_trust          — text, set by email-trust pipeline
 *   • leads.email_validated_at   — timestamptz, last-classified time
 *
 * Add new entries to PENDING_DDL whenever a future PR introduces a
 * column the runtime expects. Drop entries once they've definitely
 * landed everywhere (production + every dev DB).
 */
const PENDING_DDL: ReadonlyArray<{ sql: string; describe: string }> = [
  {
    sql: `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "email_trust" text;`,
    describe: "leads.email_trust",
  },
  {
    sql: `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "email_validated_at" timestamp with time zone;`,
    describe: "leads.email_validated_at",
  },
];

export async function applyPendingMigrationsAction(): Promise<void> {
  let errorMsg: string | null = null;
  const applied: string[] = [];

  try {
    const session = await auth();
    if (!session?.user?.id) {
      errorMsg = "unauthorized";
    } else {
      // Run each ALTER independently so a failure on one doesn't
      // prevent the rest. With IF NOT EXISTS, repeats are no-ops.
      for (const stmt of PENDING_DDL) {
        try {
          await db.execute(sql.raw(stmt.sql));
          applied.push(stmt.describe);
        } catch (err) {
          errorMsg = `${stmt.describe}: ${(err as Error).message.slice(0, 120)}`;
          break;
        }
      }

      try {
        await db.insert(auditLog).values({
          actorUserId: session.user.id,
          entity: "settings",
          entityId: null,
          action: "apply_pending_migrations",
          beforeJson: null,
          afterJson: { applied, errorMsg },
          occurredAt: sql`now()`,
        });
      } catch {
        // Audit log failure is non-fatal — the migration itself is
        // what matters here.
      }
    }
  } catch (err) {
    errorMsg = (err as Error).name + ": " + (err as Error).message.slice(0, 120);
    console.error("[applyPendingMigrations] FATAL:", err);
  }

  revalidatePath("/leads");
  revalidatePath("/admin");

  const params = new URLSearchParams({
    migrated: "1",
    m_applied: applied.join(",") || "0",
  });
  if (errorMsg) params.set("migrate_error", errorMsg);
  params.set("tab", "health");
  redirect(`/admin?${params.toString()}`);
}

/* ── One-shot business-name fix ─────────────────────────────────── */

/**
 * Updates every row in the `settings` table where business_name is the
 * old typo "MF Superior Solutions" to the correct "MF Superior Products".
 * Idempotent — re-clicking after the fix lands does nothing (0 rows
 * updated). This exists because the schema default change in PR #31
 * only applies to NEW rows; existing production rows kept the old value.
 *
 * Safe: bounded WHERE clause, no destructive ops, audit-logged.
 */
export async function fixBusinessNameAction(): Promise<void> {
  let errorMsg: string | null = null;
  let updated = 0;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      errorMsg = "unauthorized";
    } else {
      env();
      const { settings: settingsTable } = await import("@/lib/db/schema");
      const result = await db
        .update(settingsTable)
        .set({
          businessName: "MF Superior Products",
          updatedAt: new Date(),
        })
        .where(eq(settingsTable.businessName, "MF Superior Solutions"))
        .returning({ id: settingsTable.id });
      updated = result.length;

      try {
        await db.insert(auditLog).values({
          actorUserId: session.user.id,
          entity: "settings",
          entityId: null,
          action: "fix_business_name",
          beforeJson: { businessName: "MF Superior Solutions" },
          afterJson: { businessName: "MF Superior Products", updated },
          occurredAt: sql`now()`,
        });
      } catch (err) {
        console.error(
          "[fixBusinessName] audit failed:",
          (err as Error).message,
        );
      }
    }
  } catch (err) {
    errorMsg =
      (err as Error).name + ": " + (err as Error).message.slice(0, 120);
    console.error("[fixBusinessName] FATAL:", err);
  }

  revalidatePath("/admin");
  revalidatePath("/settings");

  const params = new URLSearchParams({
    bizfix: "1",
    bizfix_updated: String(updated),
  });
  if (errorMsg) params.set("bizfix_error", errorMsg);
  params.set("tab", "operations");
  redirect(`/admin?${params.toString()}`);
}

/* ── Denver batch-1: bulk import + auto-enroll ──────────────────── */

/**
 * One-click: validates every domain in DENVER_BATCH_1 via MX, generates
 * vertical-aware role-account emails (orders@/procurement@/dispatch@/
 * info@), inserts up to 50 verified leads into /leads with tag
 * `denver-batch-1`, and auto-enrolls each into the default active
 * sequence (the one with the lowest createdAt). All inside a single
 * server action.
 *
 * Operator confirmed:
 *   - All 4 verticals (restaurants, bigbox, brokers, construction)
 *   - Full Front Range corridor
 *   - All tiers
 *   - 50/50 refrigerated/dry
 *   - Role accounts on MX-validated domains OK
 *   - Insert into /leads + auto-enroll
 *   - CSV format
 *
 * Each lead is inserted with:
 *   - source: "denver-batch-1"
 *   - tier: hinted from the candidate ("A"|"B"|"C")
 *   - tags: ["tier-X","refrigerated"?,"denver-batch-1","email-role-account"]
 *   - notes: operator-facing description of the angle
 *
 * Idempotent: lookups skip rows already present by (email).
 */
export async function importDenverBatch1Action(): Promise<void> {
  let errorMsg: string | null = null;
  let validated = 0;
  let inserted = 0;
  let skippedDuplicate = 0;
  let skippedInvalid = 0;
  let enrolled = 0;
  let alreadyEnrolled = 0;
  let durationMs = 0;
  let sequenceName: string | null = null;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      errorMsg = "unauthorized";
    } else {
      env();
      const start = Date.now();

      const { DENVER_BATCH_1 } = await import(
        "@/lib/research/denver-batch-1"
      );
      const { validateEmail } = await import("@/lib/research/mx-validate");
      const { emailSequences, leadSequenceEnrollments } = await import(
        "@/lib/db/schema"
      );

      const [defaultSequence] = await db
        .select({ id: emailSequences.id, name: emailSequences.name })
        .from(emailSequences)
        .where(eq(emailSequences.status, "active"))
        .orderBy(emailSequences.createdAt)
        .limit(1);

      if (!defaultSequence) {
        errorMsg = "no_active_sequence";
      } else {
        sequenceName = defaultSequence.name;

        const ROLE_BY_VERTICAL: Record<string, string> = {
          restaurants: "orders",
          bigbox: "procurement",
          brokers: "dispatch",
          construction: "orders",
          smallbiz: "info",
        };

        type Candidate = (typeof DENVER_BATCH_1)[number];
        const validations = await Promise.all(
          DENVER_BATCH_1.map(async (c: Candidate) => {
            const email = `${ROLE_BY_VERTICAL[c.industry] ?? "info"}@${c.domain}`;
            const v = await validateEmail(email);
            return { c, email, v };
          }),
        );

        const verified = validations.filter(
          (r) => r.v.confidence !== "rejected",
        );
        skippedInvalid = validations.length - verified.length;
        validated = verified.length;

        const sorted = verified.slice().sort((a, b) => {
          const t = a.c.tierHint.localeCompare(b.c.tierHint);
          if (t !== 0) return t;
          return Number(b.c.refrigerated) - Number(a.c.refrigerated);
        });
        const top = sorted.slice(0, 50);

        for (const { c, email } of top) {
          const [existing] = await db
            .select({ id: leadsTable.id })
            .from(leadsTable)
            .where(eq(leadsTable.email, email))
            .limit(1);

          let leadId: string;
          if (existing) {
            leadId = existing.id;
            skippedDuplicate++;
          } else {
            const tags = [
              `tier-${c.tierHint}`,
              c.refrigerated ? "refrigerated" : null,
              "denver-batch-1",
              "email-role-account",
            ].filter(Boolean) as string[];

            const [created] = await db
              .insert(leadsTable)
              .values({
                companyName: c.companyName,
                website: `https://${c.domain}`,
                email,
                vertical: c.industry,
                city: c.city,
                state: c.state,
                source: "denver-batch-1",
                tier: c.tierHint,
                tags,
                notes: c.notes,
                stage: "new",
              })
              .returning({ id: leadsTable.id });
            leadId = created.id;
            inserted++;
          }

          const enrollResult = await db
            .insert(leadSequenceEnrollments)
            .values({
              leadId,
              sequenceId: defaultSequence.id,
              status: "active",
              currentStep: 0,
              nextSendAt: new Date(
                Date.now() + Math.random() * 30 * 60 * 1000,
              ),
            })
            .onConflictDoNothing()
            .returning({ id: leadSequenceEnrollments.id });

          if (enrollResult.length > 0) enrolled++;
          else alreadyEnrolled++;
        }

        await db.insert(auditLog).values({
          actorUserId: session.user.id,
          entity: "leads",
          entityId: null,
          action: "import_denver_batch_1",
          beforeJson: null,
          afterJson: {
            validated,
            inserted,
            skippedDuplicate,
            skippedInvalid,
            enrolled,
            alreadyEnrolled,
            sequenceId: defaultSequence.id,
            sequenceName: defaultSequence.name,
          },
          occurredAt: sql`now()`,
        });

        durationMs = Date.now() - start;
      }
    }
  } catch (err) {
    errorMsg =
      (err as Error).name + ": " + (err as Error).message.slice(0, 200);
    console.error("[importDenverBatch1] FATAL:", err);
  }

  revalidatePath("/leads");
  revalidatePath("/admin");

  const params = new URLSearchParams({
    batch1: "1",
    b1_validated: String(validated),
    b1_inserted: String(inserted),
    b1_dup: String(skippedDuplicate),
    b1_invalid: String(skippedInvalid),
    b1_enrolled: String(enrolled),
    b1_already: String(alreadyEnrolled),
    b1_dur: String(durationMs),
  });
  if (sequenceName) params.set("b1_sequence", sequenceName);
  if (errorMsg) params.set("b1_error", errorMsg);
  params.set("tab", "imports");
  redirect(`/admin?${params.toString()}`);
}
