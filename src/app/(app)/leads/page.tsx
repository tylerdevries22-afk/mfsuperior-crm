import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { Plus, Upload, Search, CheckCircle2, AlertTriangle, Zap, X as XIcon } from "lucide-react";
import { db } from "@/lib/db/client";
import { emailSequences, leadSequenceEnrollments, leads } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { LeadsTable } from "@/components/leads/leads-table";
import { FilterBar } from "@/components/leads/filter-bar";
import { ResultToastBridge } from "@/components/leads/result-toast-bridge";
import { verifiedQuickAddAction } from "@/app/(app)/admin/actions";

export const metadata = { title: "Leads" };
// Quick-add curated pack server action runs from this page; give it
// breathing room beyond the 10s Hobby default in case the bulk SELECT +
// INSERT + parallel UPDATEs hit a Neon cold start.
export const maxDuration = 60;

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 50;

const STAGES = ["new", "contacted", "replied", "quoted", "won", "lost"] as const;
const TIERS = ["A", "B", "C"] as const;

// Source filter values. The labels are intentionally collapsed into a few
// high-signal groupings so the operator sees clear provenance — not the
// long history of how each path evolved. Less-used legacy values still
// match if the operator types ?source=... in the URL.
const SOURCES = [
  { value: "lead-gen", label: "Generated (OSM + scrape + MX)" },
  { value: "website-scrape", label: "Generated (curated + scrape + MX)" },
  { value: "spreadsheet", label: "Imported (spreadsheet)" },
  { value: "website_contact", label: "Inbound (website contact form)" },
  { value: "manual", label: "Manually added" },
] as const;

// Filter URL params. Multi-value filters are comma-separated strings on
// the wire (`?stage=new,contacted&tier=A,B`); they're parsed into string
// arrays inside this page and pushed into the WHERE clause via
// drizzle's `inArray` / Postgres array overlap.
type Search = {
  q?: string;
  stage?: string;
  tier?: string;
  source?: string;
  tags?: string;
  lastContacted?: string; // "7d" | "30d" | "90d" | "never" | "any"
  enrollment?: string; // "any" | "none" | "active" | "paused" | "completed"
  hasEmail?: string; // "yes" | "no" | "any"
  perPage?: string;
  page?: string;
  // Quick-add starter pack redirect params
  just_added?: string;
  just_updated?: string;
  just_enriched?: string;
  just_unarchived?: string;
  just_skipped?: string;
  starter?: string;
  starter_error?: string;
  // Purge redirect params
  purged?: string;
  archived?: string;
  purge_error?: string;
  // Bulk-archive redirect params (from bulkArchiveAction)
  archived_bulk?: string;
  archive_error?: string;
  // Verified-quick-add redirect params (from verifiedQuickAddAction)
  verified?: string;
  v_inserted?: string;
  v_attempted?: string;
  v_already?: string;
  v_no_email?: string;
  v_no_html?: string;
  v_mx_failed?: string;
  v_timeout?: string;
  v_other?: string;
  verified_error?: string;
  // Wipe-guessed redirect params (from wipeGuessedLeadsAction)
  wiped_guessed?: string;
  wipe_error?: string;
  // Unarchive redirect params (from unarchiveAllLeadsAction)
  unarchived?: string;
  unarchived_count?: string;
  unarchived_since?: string;
  unarchive_error?: string;
  // Generate-leads redirect params (from generateLeadsAction)
  gen?: string;
  g_inserted?: string;
  g_attempted?: string;
  g_osm?: string;
  g_curated?: string;
  g_already?: string;
  g_no_website?: string;
  g_no_email?: string;
  g_mx_failed?: string;
  g_timeout?: string;
  g_other?: string;
  gen_error?: string;
  // Bulk-send result banner params (from bulkSendAction redirect).
  sent?: string;
  requested?: string;
  enrolled?: string;
  already?: string;
  suppressed?: string;
  no_step?: string;
  no_lead?: string;
  tick_sent?: string;
  tick_drafted?: string;
  tick_failed?: string;
  tick_capped?: string;
  tick_no_email?: string;
  tick_notes?: string;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  // ── Parse multi-value filters from comma-separated URL params ─────
  // Empty / missing / "all" all degrade to an empty array (no filter).
  function parseCsv<T extends string>(raw: string | undefined, valid: readonly T[]): T[] {
    if (!raw || raw === "all") return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is T => valid.includes(s as T));
  }

  const stages = parseCsv(sp.stage, STAGES);
  const tiers = parseCsv(sp.tier, TIERS);
  const sources = parseCsv(
    sp.source,
    SOURCES.map((s) => s.value) as readonly string[],
  );
  // Tags can be ANY string (operator-defined). No allowlist — but cap
  // count + length to avoid runaway URLs.
  const tags = (sp.tags ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 60)
    .slice(0, 20);

  const lastContacted = (["7d", "30d", "90d", "never", "any"] as const).includes(
    (sp.lastContacted ?? "any") as "7d" | "30d" | "90d" | "never" | "any",
  )
    ? (sp.lastContacted ?? "any")
    : "any";
  const enrollment = (
    ["any", "none", "active", "paused", "completed"] as const
  ).includes(
    (sp.enrollment ?? "any") as
      | "any"
      | "none"
      | "active"
      | "paused"
      | "completed",
  )
    ? (sp.enrollment ?? "any")
    : "any";
  const hasEmail = (["any", "yes", "no"] as const).includes(
    (sp.hasEmail ?? "any") as "any" | "yes" | "no",
  )
    ? (sp.hasEmail ?? "any")
    : "any";

  const perPage = PAGE_SIZE_OPTIONS.includes(
    Number(sp.perPage) as (typeof PAGE_SIZE_OPTIONS)[number],
  )
    ? Number(sp.perPage)
    : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(sp.page ?? 1));

  // ── Build WHERE clause ────────────────────────────────────────────
  const filters: SQL[] = [isNull(leads.archivedAt)];
  if (q) {
    const qEsc = q.replace(/[%_\\]/g, "\\$&");
    filters.push(
      or(
        ilike(leads.companyName, `%${qEsc}%`),
        ilike(leads.email, `%${qEsc}%`),
        ilike(leads.city, `%${qEsc}%`),
        ilike(leads.vertical, `%${qEsc}%`),
      ) as SQL,
    );
  }
  if (stages.length > 0)
    filters.push(inArray(leads.stage, stages as (typeof STAGES)[number][]));
  if (tiers.length > 0)
    filters.push(inArray(leads.tier, tiers as (typeof TIERS)[number][]));
  if (sources.length > 0) filters.push(inArray(leads.source, sources));

  // Tag filter: array-overlap (Postgres `&&` operator). Matches if the
  // lead's tags array contains at least one of the requested tags.
  if (tags.length > 0) {
    filters.push(
      sql`${leads.tags} && ARRAY[${sql.join(
        tags.map((t) => sql`${t}`),
        sql`, `,
      )}]::text[]`,
    );
  }

  if (lastContacted === "never") {
    filters.push(isNull(leads.lastContactedAt));
  } else if (lastContacted === "7d") {
    filters.push(sql`${leads.lastContactedAt} >= now() - interval '7 days'`);
  } else if (lastContacted === "30d") {
    filters.push(sql`${leads.lastContactedAt} >= now() - interval '30 days'`);
  } else if (lastContacted === "90d") {
    filters.push(sql`${leads.lastContactedAt} >= now() - interval '90 days'`);
  }

  // Enrollment filter — semi-join against leadSequenceEnrollments.
  if (enrollment === "none") {
    filters.push(
      sql`NOT EXISTS (SELECT 1 FROM ${leadSequenceEnrollments} e WHERE e.lead_id = ${leads.id})`,
    );
  } else if (enrollment === "active") {
    filters.push(
      sql`EXISTS (SELECT 1 FROM ${leadSequenceEnrollments} e WHERE e.lead_id = ${leads.id} AND e.status = 'active')`,
    );
  } else if (enrollment === "paused") {
    filters.push(
      sql`EXISTS (SELECT 1 FROM ${leadSequenceEnrollments} e WHERE e.lead_id = ${leads.id} AND e.status = 'paused')`,
    );
  } else if (enrollment === "completed") {
    filters.push(
      sql`EXISTS (SELECT 1 FROM ${leadSequenceEnrollments} e WHERE e.lead_id = ${leads.id} AND e.status = 'completed')`,
    );
  }

  if (hasEmail === "yes") filters.push(isNotNull(leads.email));
  else if (hasEmail === "no") filters.push(isNull(leads.email));

  const where = filters.length === 1 ? filters[0] : and(...filters);

  const [[{ count }], rows, sequenceRows, distinctTagRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(where),
    db
      .select()
      .from(leads)
      .where(where)
      .orderBy(
        desc(isNotNull(leads.score)),
        desc(leads.score),
        asc(leads.companyName),
      )
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .select({ id: emailSequences.id, name: emailSequences.name })
      .from(emailSequences)
      .where(eq(emailSequences.status, "active"))
      .orderBy(asc(emailSequences.name)),
    // Live tag set: distinct tags from every non-archived lead. Replaces
    // the stale hardcoded `KNOWN_TAGS` allowlist in FilterBar so the
    // dropdown always matches what's actually in the DB. Operators were
    // hitting "my tag doesn't show up" because new tags from imports
    // weren't being added to the allowlist.
    db.execute<{ tag: string }>(
      sql`SELECT DISTINCT unnest(tags) AS tag FROM leads WHERE archived_at IS NULL ORDER BY tag`,
    ),
  ]);
  const availableTags = (distinctTagRows as unknown as { tag: string }[])
    .map((r) => r.tag)
    .filter((t): t is string => Boolean(t));

  const totalPages = Math.max(1, Math.ceil(count / perPage));

  // If filters are hiding leads but the operator has leads in other
  // stages/sources, surface that so they don't think the page is broken.
  let hiddenInOtherStagesCount = 0;
  if (
    rows.length === 0 &&
    !q &&
    tiers.length === 0 &&
    sources.length === 0 &&
    tags.length === 0
  ) {
    const [{ otherCount }] = await db
      .select({ otherCount: sql<number>`count(*)::int` })
      .from(leads)
      .where(isNull(leads.archivedAt));
    hiddenInOtherStagesCount = otherCount;
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Leads
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{count}</span>
            {stages.length > 0 ? ` · stage ${stages.join(", ")}` : " total"}
            {sources.length > 0 ? ` · source ${sources.join(", ")}` : ""}
            {" · "}ranked by score
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={verifiedQuickAddAction}>
            <Button
              type="submit"
              variant="secondary"
              title="Scrapes each curated company's website (/, /contact, /about, /team, /leadership) for real mailto: emails, MX-validates each one, and inserts ONLY companies with verified deliverable addresses. NEVER guesses. Expect 20-60 inserts from ~150 attempts since many chains don't publish a public email."
            >
              <Zap /> Quick-add (verified)
            </Button>
          </form>
          <Link href="/leads/import">
            <Button variant="secondary">
              <Upload /> Import
            </Button>
          </Link>
          <Link href="/leads/new">
            <Button>
              <Plus /> New lead
            </Button>
          </Link>
        </div>
      </header>

      <FilterBar
        q={q}
        stages={stages}
        tiers={tiers}
        sources={sources}
        tags={tags}
        availableTags={availableTags}
        lastContacted={lastContacted}
        enrollment={enrollment}
        hasEmail={hasEmail}
        perPage={perPage}
      />

      {/* Single toast bridge replaces ~300 lines of inline banner JSX.
          Reads server-action redirect params from the URL once on
          mount and fires a sonner toast for the relevant outcome:
          archive / purge / bulk-archive / unarchive / quick-add /
          bulk-send / import. Each fires exactly once per redirect
          (URL params clear on next navigation). */}
      <ResultToastBridge sp={sp} />

      {rows.length === 0 ? (
        <EmptyState
          hasFilters={
            !!(
              q ||
              stages.length ||
              tiers.length ||
              sources.length ||
              tags.length ||
              lastContacted !== "any" ||
              enrollment !== "any" ||
              hasEmail !== "any"
            )
          }
          hiddenInOtherStagesCount={hiddenInOtherStagesCount}
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-mono tabular-nums text-foreground">
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, count)}
            </span>{" "}
            of <span className="font-mono tabular-nums text-foreground">{count}</span>
          </p>
          {/* pb-24 leaves room for the sticky bulk-action bar. */}
          <div className="pb-24">
            <LeadsTable rows={rows} sequences={sequenceRows} />
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            params={{
              q,
              stage: stages.join(",") || undefined,
              tier: tiers.join(",") || undefined,
              source: sources.join(",") || undefined,
              tags: tags.join(",") || undefined,
              lastContacted: lastContacted !== "any" ? lastContacted : undefined,
              enrollment: enrollment !== "any" ? enrollment : undefined,
              hasEmail: hasEmail !== "any" ? hasEmail : undefined,
              perPage:
                perPage === DEFAULT_PAGE_SIZE ? undefined : String(perPage),
            }}
          />
        </>
      )}
    </div>
  );
}


/* ───── Empty state ─────────────────────────────────────────── */

function EmptyState({
  hasFilters,
  hiddenInOtherStagesCount,
}: {
  hasFilters: boolean;
  hiddenInOtherStagesCount: number;
}) {
  // Default filter (stage=new) is on, but the user has leads in OTHER stages.
  // Most common cause: they've already cold-pitched everyone in `new`, so the
  // worklist is empty — but they came here looking for their full list.
  if (hiddenInOtherStagesCount > 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 px-6 py-10 text-sm">
          <p className="font-medium text-foreground">
            No <span className="font-mono">unworked</span> leads right now.
          </p>
          <p className="text-muted-foreground">
            You have{" "}
            <span className="font-mono tabular-nums">
              {hiddenInOtherStagesCount}
            </span>{" "}
            lead{hiddenInOtherStagesCount === 1 ? "" : "s"} in other stages
            (contacted, replied, etc). The default filter only shows leads
            still to pitch.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/leads?stage=all">
              <Button variant="secondary" size="sm">
                Show all stages
              </Button>
            </Link>
            <Link href="/inbox">
              <Button variant="ghost" size="sm">
                Go to inbox
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 px-6 py-10 text-sm">
        {hasFilters ? (
          <>
            <p className="font-medium text-foreground">No leads match your filters.</p>
            <p className="text-muted-foreground">
              Try removing a filter or clearing the search query.
            </p>
            <Link href="/leads">
              <Button variant="secondary" size="sm">
                Reset filters
              </Button>
            </Link>
          </>
        ) : (
          <>
            <p className="font-medium text-foreground">No leads yet.</p>
            <p className="text-muted-foreground">
              Import your existing spreadsheet to seed the pipeline. The kit&apos;s{" "}
              <span className="font-mono">01_Lead_List.xlsx</span> with 50
              ranked Denver leads is the right starting point.
            </p>
            <Link href="/leads/import">
              <Button>
                <Upload /> Import spreadsheet
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ───── Pagination ──────────────────────────────────────────── */

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: {
    q?: string;
    stage?: string;
    tier?: string;
    source?: string;
    tags?: string;
    lastContacted?: string;
    enrollment?: string;
    hasEmail?: string;
    perPage?: string;
  };
}) {
  if (totalPages <= 1) return null;
  const linkFor = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    if (n > 1) sp.set("page", String(n));
    const qs = sp.toString();
    return `/leads${qs ? `?${qs}` : ""}`;
  };
  return (
    <nav className="mt-4 flex items-center justify-end gap-1 text-sm">
      <Link
        href={linkFor(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={
          page <= 1
            ? "pointer-events-none rounded-md border border-border px-3 py-1.5 text-muted-foreground opacity-50"
            : "rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        }
      >
        Prev
      </Link>
      <span className="px-3 text-muted-foreground">
        Page <span className="font-mono tabular-nums text-foreground">{page}</span>
        {" "}of{" "}
        <span className="font-mono tabular-nums text-foreground">{totalPages}</span>
      </span>
      <Link
        href={linkFor(Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
        className={
          page >= totalPages
            ? "pointer-events-none rounded-md border border-border px-3 py-1.5 text-muted-foreground opacity-50"
            : "rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        }
      >
        Next
      </Link>
    </nav>
  );
}
