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
import { COUNTIES, type County } from "@/lib/research/osm";
import type { Industry } from "@/lib/research/score";
import { verifyWebsiteEmail } from "@/lib/research/verify-website-email";

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
  redirect(`/admin?${params.toString()}`);
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
  redirect(`/admin?${params.toString()}`);
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
      redirect(`/admin?${params.toString()}`);
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
  redirect(`/admin?${params.toString()}`);
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
  redirect(`/admin?${params.toString()}`);
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
export async function verifiedQuickAddAction(): Promise<void> {
  let errorMsg: string | null = null;
  let attempted = 0;
  let inserted = 0;
  let skippedAlreadyExists = 0;
  let skippedNoEmail = 0;
  let skippedNoHtml = 0;
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

      const sample = CURATED_DENVER;
      attempted = sample.length;

      // 1. Pre-fetch every existing non-archived lead matching one of our
      //    candidate domains or company names — single SELECT.
      const allDomains = sample.map((c) => c.domain);
      const allNames = sample.map((c) => c.name);
      const existing = await db
        .select({
          email: leadsTable.email,
          companyName: leadsTable.companyName,
          website: leadsTable.website,
        })
        .from(leadsTable)
        .where(
          and(
            isNull(leadsTable.archivedAt),
            or(
              inArray(leadsTable.companyName, allNames),
              // email LIKE '%@domain' for any domain
              sql`split_part(${leadsTable.email}, '@', 2) = ANY(${allDomains})`,
            ),
          ),
        );
      const existingDomains = new Set<string>();
      const existingNames = new Set<string>();
      for (const r of existing) {
        if (r.companyName) existingNames.add(r.companyName);
        if (r.email) {
          const d = r.email.split("@")[1];
          if (d) existingDomains.add(d);
        }
      }

      const verticalLabel: Record<string, string> = {
        restaurants: "Restaurant",
        bigbox: "Big-box retail",
        brokers: "Freight broker / 3PL",
        smallbiz: "Small business",
      };

      // 2. Verify-or-skip each remaining entry, in parallel with a hard
      //    per-company timeout so one stuck site can't blow our budget.
      const work = sample.filter((c) => {
        if (existingDomains.has(c.domain) || existingNames.has(c.name)) {
          skippedAlreadyExists++;
          return false;
        }
        return true;
      });

      type Verified = {
        c: (typeof sample)[number];
        email: string;
        sourcePath: string;
      };
      const verified: Verified[] = [];
      const results = await Promise.allSettled(
        work.map(async (c) => {
          const r = await verifyWebsiteEmail(c.domain);
          return { c, r };
        }),
      );
      for (const s of results) {
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
            skippedNoHtml++;
            break;
          case "no_emails_on_website":
          case "no_usable_email":
          case "no_domain":
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

      // 3. Bulk insert all verified leads in one INSERT.
      if (verified.length > 0) {
        const values = verified.map(({ c, email, sourcePath }) => {
          const vertical = verticalLabel[c.industry];
          const tags: string[] = ["tier-A", vertical, "email-verified"];
          if (c.refrigerated || c.industry === "restaurants")
            tags.push("refrigerated");
          if (c.chain) tags.push("chain-store");
          return {
            email,
            phone: null,
            companyName: c.name,
            website: `https://${c.domain}`,
            vertical,
            address: null,
            city: "Denver Metro",
            state: "CO",
            source: "website-scrape" as const,
            tier: "A" as const,
            score: 80,
            tags,
            notes: `Email extracted from https://${c.domain}${sourcePath}; MX-validated.`,
          };
        });
        try {
          await db.insert(leadsTable).values(values);
          inserted = verified.length;
        } catch (err) {
          // If the bulk insert fails (likely a uniqueness conflict for an
          // email we didn't dedupe against), fall back to one-by-one with
          // try/catch so partial success is captured.
          console.error(
            "[verifiedQuickAdd] bulk insert failed; falling back:",
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
          action: "verified_quick_add",
          beforeJson: null,
          afterJson: {
            attempted,
            inserted,
            skippedAlreadyExists,
            skippedNoEmail,
            skippedNoHtml,
            skippedMxFailed,
            skippedTimeout,
            skippedOther,
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
    v_inserted: String(inserted),
    v_attempted: String(attempted),
    v_already: String(skippedAlreadyExists),
    v_no_email: String(skippedNoEmail),
    v_no_html: String(skippedNoHtml),
    v_mx_failed: String(skippedMxFailed),
    v_timeout: String(skippedTimeout),
    v_other: String(skippedOther),
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
