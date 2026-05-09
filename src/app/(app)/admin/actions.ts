"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { db } from "@/lib/db/client";
import { suppressionList } from "@/lib/db/schema";
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  env();

  const { CURATED_DENVER } = await import("@/lib/research/curated-denver");
  const { leads: leadsTable } = await import("@/lib/db/schema");
  const { sql: sqlOp } = await import("drizzle-orm");

  let inserted = 0;
  let skipped = 0;
  const start = Date.now();
  // Take the first 25 across all industries — guaranteed manageable even
  // on Vercel Hobby's 10s timeout.
  const sample = CURATED_DENVER.slice(0, 25);

  for (const c of sample) {
    const tags: string[] = [];
    const verticalLabel: Record<string, string> = {
      restaurants: "Restaurant",
      bigbox: "Big-box retail",
      brokers: "Freight broker / 3PL",
      smallbiz: "Small business",
    };
    const vertical = verticalLabel[c.industry];
    tags.push("tier-A", vertical, "email-guessed");
    if (c.refrigerated || c.industry === "restaurants") tags.push("refrigerated");
    if (c.chain) tags.push("chain-store");

    const insert = {
      email: `info@${c.domain}` as string,
      phone: null as string | null,
      companyName: c.name,
      website: `https://${c.domain}`,
      vertical,
      address: null as string | null,
      city: "Denver Metro",
      state: "CO",
      source: "starter-pack",
      tier: "A" as const,
      score: 75,
      tags,
      notes: "Denver Metro starter pack — backfill specific store address as needed.",
    };

    try {
      const [row] = await db
        .insert(leadsTable)
        .values(insert)
        .onConflictDoUpdate({
          target: leadsTable.email,
          set: {
            companyName: insert.companyName,
            vertical: insert.vertical,
            website: insert.website,
            tier: insert.tier,
            score: insert.score,
            tags: insert.tags,
            notes: insert.notes,
            updatedAt: new Date(),
          },
        })
        .returning({ id: leadsTable.id, createdAt: leadsTable.createdAt, updatedAt: leadsTable.updatedAt });
      if (row && Math.abs(row.createdAt.getTime() - row.updatedAt.getTime()) < 1000) {
        inserted++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error("[quickAdd] insert failed for", c.name, (err as Error).message);
    }
  }

  // Audit log so the operator can verify even without seeing the banner.
  try {
    const { auditLog } = await import("@/lib/db/schema");
    await db.insert(auditLog).values({
      actorUserId: session.user.id,
      entity: "leads",
      entityId: null,
      action: "starter_pack_run",
      beforeJson: null,
      afterJson: { inserted, updated: skipped, total: sample.length, durationMs: Date.now() - start },
      occurredAt: sqlOp`now()`,
    });
  } catch (err) {
    console.error("[quickAdd] audit failed:", (err as Error).message);
  }

  revalidatePath("/leads");
  revalidatePath("/admin");
  // Redirect DIRECTLY to /leads with a "just-added" banner param so the
  // operator immediately sees the new rows.
  const params = new URLSearchParams({
    just_added: String(inserted),
    just_updated: String(skipped),
    starter: "1",
    stage: "all", // bypass the default stage=new filter so all rows show
  });
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
