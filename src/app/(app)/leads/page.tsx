import Link from "next/link";
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { Plus, Upload, Search, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { db } from "@/lib/db/client";
import { emailSequences, leads } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { LeadsTable } from "@/components/leads/leads-table";
import { quickAddStarterPackAction } from "@/app/(app)/admin/actions";

export const metadata = { title: "Leads" };
// Quick-add curated pack server action runs from this page; give it
// breathing room beyond the 10s Hobby default in case the bulk SELECT +
// INSERT + parallel UPDATEs hit a Neon cold start.
export const maxDuration = 60;

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 50;

const STAGES = ["new", "contacted", "replied", "quoted", "won", "lost"] as const;
const TIERS = ["A", "B", "C"] as const;

const SOURCES = [
  { value: "research-free-admin", label: "Research (free, admin button)" },
  { value: "research-paid-admin", label: "Research (paid, admin button)" },
  { value: "research-free", label: "Research CLI (free)" },
  { value: "research-paid", label: "Research CLI (paid)" },
  { value: "starter-pack", label: "Quick-add starter pack" },
  { value: "spreadsheet", label: "Spreadsheet import" },
  { value: "website_contact", label: "Website contact form" },
  { value: "manual", label: "Manually added" },
] as const;

type Search = {
  q?: string;
  stage?: string;
  tier?: string;
  source?: string;
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
  // Default is now "all stages" — operator wants every lead visible.
  // Pass ?stage=new to filter to just the unworked worklist.
  const stageParam = sp.stage ?? "all";
  const showAllStages = stageParam === "all";
  const stage =
    !showAllStages && STAGES.includes(stageParam as (typeof STAGES)[number])
      ? (stageParam as (typeof STAGES)[number])
      : undefined;
  const tier = TIERS.includes((sp.tier ?? "") as (typeof TIERS)[number])
    ? (sp.tier as (typeof TIERS)[number])
    : undefined;
  const sourceParam = sp.source ?? "";
  const source =
    SOURCES.some((s) => s.value === sourceParam) ? sourceParam : undefined;
  const perPage = PAGE_SIZE_OPTIONS.includes(
    Number(sp.perPage) as (typeof PAGE_SIZE_OPTIONS)[number],
  )
    ? Number(sp.perPage)
    : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(sp.page ?? 1));

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
  if (stage) filters.push(eq(leads.stage, stage));
  if (tier) filters.push(eq(leads.tier, tier));
  if (source) filters.push(eq(leads.source, source));

  const where = filters.length === 1 ? filters[0] : and(...filters);

  const [[{ count }], rows, sequenceRows] = await Promise.all([
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
  ]);

  const totalPages = Math.max(1, Math.ceil(count / perPage));
  const showSentBanner = sp.sent === "1";

  // If filters are hiding leads but the operator has leads in other
  // stages/sources, surface that so they don't think the page is broken.
  let hiddenInOtherStagesCount = 0;
  if (rows.length === 0 && !q && !tier && !source) {
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
            {stage ? ` · stage ${stage}` : " total"}
            {source ? ` · source ${source}` : ""}
            {" · "}ranked by score
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={quickAddStarterPackAction}>
            <Button
              type="submit"
              variant="secondary"
              title="Insert ~150 curated Denver Metro businesses with role-targeted emails (procurement@, orders@, dispatch@). Fills in emails for any legacy email-less rows that match by company name."
            >
              <Zap /> Quick-add curated pack
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

      <form
        action="/leads"
        method="get"
        className="mb-5 flex flex-wrap items-center gap-2"
      >
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Search company, email, city, vertical…"
            defaultValue={q}
            className="pl-9"
          />
        </div>
        <Select
          name="stage"
          defaultValue={showAllStages ? "all" : stage ?? "all"}
          className="w-40"
        >
          <option value="all">All stages (default)</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
        <Select name="tier" defaultValue={tier ?? ""} className="w-32">
          <option value="">All tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              Tier {t}
            </option>
          ))}
        </Select>
        <Select name="source" defaultValue={source ?? ""} className="w-52">
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select
          name="perPage"
          defaultValue={String(perPage)}
          className="w-28"
          aria-label="Leads per page"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
        {(q || stage || tier || source) && (
          <Link
            href="/leads"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Reset
          </Link>
        )}
      </form>

      {sp.purged === "1" && sp.purge_error ? (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-foreground">Purge failed.</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {decodeURIComponent(sp.purge_error)}
            </p>
          </div>
        </div>
      ) : sp.purged === "1" ? (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <div>
            <p className="font-medium text-foreground">
              Archived{" "}
              <span className="font-mono tabular-nums">{Number(sp.archived ?? 0)}</span>{" "}
              email-less leads.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              They&apos;re hidden from the worklist but not deleted. Click
              Quick-add on <Link href="/admin" className="underline hover:text-foreground">/admin</Link>{" "}
              to populate with high-quality emailed leads.
            </p>
          </div>
        </div>
      ) : null}

      {sp.starter === "1" && sp.starter_error ? (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-foreground">
              Starter pack action failed.
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {decodeURIComponent(sp.starter_error)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Inserted {Number(sp.just_added ?? 0)} / Updated {Number(sp.just_updated ?? 0)}{" "}
              before the error. Most common causes: not signed in
              (re-login), or a missing required env var on Vercel.
            </p>
          </div>
        </div>
      ) : sp.starter === "1" ? (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <div>
            <p className="font-medium text-foreground">
              Starter pack added —{" "}
              <span className="font-mono tabular-nums">{Number(sp.just_added ?? 0)}</span>{" "}
              new,{" "}
              <span className="font-mono tabular-nums">{Number(sp.just_enriched ?? 0)}</span>{" "}
              enriched,{" "}
              <span className="font-mono tabular-nums">{Number(sp.just_updated ?? 0)}</span>{" "}
              updated
              {Number(sp.just_unarchived ?? 0) > 0 ? (
                <>
                  {", "}
                  <span className="font-mono tabular-nums">
                    {Number(sp.just_unarchived ?? 0)}
                  </span>{" "}
                  unarchived
                </>
              ) : null}
              {Number(sp.just_skipped ?? 0) > 0 ? (
                <>
                  {", "}
                  <span className="font-mono tabular-nums">
                    {Number(sp.just_skipped ?? 0)}
                  </span>{" "}
                  skipped
                </>
              ) : null}
              .
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Role-targeted emails ({" "}
              <span className="font-mono">procurement@</span>,{" "}
              <span className="font-mono">orders@</span>,{" "}
              <span className="font-mono">dispatch@</span>,{" "}
              <span className="font-mono">info@</span>), tier A, refrigerated +
              chain-store tags where applicable. <em>Enriched</em> = legacy
              email-less rows whose email was just filled in. Filter Source to{" "}
              <span className="font-mono">starter-pack</span> to see only these.
            </p>
          </div>
        </div>
      ) : null}
      {showSentBanner && <SendResultBanner sp={sp} />}

      {rows.length === 0 ? (
        <EmptyState
          hasFilters={!!(q || stage || tier || source)}
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
              stage: showAllStages ? "all" : stage,
              tier,
              source,
              perPage: perPage === DEFAULT_PAGE_SIZE ? undefined : String(perPage),
            }}
          />
        </>
      )}
    </div>
  );
}

/* ───── Send-result banner ───────────────────────────────────── */

function SendResultBanner({ sp }: { sp: Search }) {
  const requested = Number(sp.requested ?? 0);
  const enrolled = Number(sp.enrolled ?? 0);
  const already = Number(sp.already ?? 0);
  const suppressed = Number(sp.suppressed ?? 0);
  const noStep = Number(sp.no_step ?? 0);
  const tickSent = Number(sp.tick_sent ?? 0);
  const tickDrafted = Number(sp.tick_drafted ?? 0);
  const tickFailed = Number(sp.tick_failed ?? 0);
  const tickCapped = Number(sp.tick_capped ?? 0);
  const tickNoEmail = Number(sp.tick_no_email ?? 0);

  const hasIssue =
    tickFailed > 0 || suppressed > 0 || noStep > 0 || tickCapped > 0 || tickNoEmail > 0;
  const Icon = hasIssue ? AlertTriangle : CheckCircle2;
  const color = hasIssue ? "warning" : "success";

  return (
    <div
      className={
        "mb-5 flex items-start gap-3 rounded-md border px-4 py-3 text-sm " +
        (color === "warning"
          ? "border-warning/40 bg-warning/10"
          : "border-success/40 bg-success/10")
      }
    >
      <Icon
        className={
          "mt-0.5 size-4 shrink-0 " +
          (color === "warning" ? "text-warning" : "text-success")
        }
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-foreground">
          Send fired for {requested} lead{requested === 1 ? "" : "s"}
        </p>
        <p className="text-xs text-muted-foreground">
          {[
            tickSent > 0 ? `${tickSent} sent` : null,
            tickDrafted > 0 ? `${tickDrafted} drafted` : null,
            enrolled > 0 ? `${enrolled} newly enrolled` : null,
            already > 0 ? `${already} already enrolled` : null,
            suppressed > 0 ? `${suppressed} suppressed` : null,
            noStep > 0 ? `${noStep} sequence has no active step` : null,
            tickCapped > 0 ? `${tickCapped} held by daily cap` : null,
            tickNoEmail > 0 ? `${tickNoEmail} skipped (no email)` : null,
            tickFailed > 0 ? `${tickFailed} failed` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "No work to do."}
        </p>
        {sp.tick_notes && (
          <ul className="text-xs text-muted-foreground">
            {decodeURIComponent(sp.tick_notes)
              .split("|")
              .filter(Boolean)
              .map((n) => (
                <li key={n}>· {n}</li>
              ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Successful sends advanced from{" "}
          <span className="font-mono">stage=new</span> to{" "}
          <span className="font-mono">contacted</span> and now live in{" "}
          <Link href="/inbox" className="underline hover:text-foreground">
            /inbox
          </Link>
          .
        </p>
      </div>
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
  params: { q?: string; stage?: string; tier?: string; source?: string; perPage?: string };
}) {
  if (totalPages <= 1) return null;
  const linkFor = (n: number) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.stage) sp.set("stage", params.stage);
    if (params.tier) sp.set("tier", params.tier);
    if (params.source) sp.set("source", params.source);
    if (params.perPage) sp.set("perPage", params.perPage);
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
