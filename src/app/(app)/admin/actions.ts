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
