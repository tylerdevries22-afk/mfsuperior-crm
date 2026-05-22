import Link from "next/link";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { Inbox } from "lucide-react";
import { db } from "@/lib/db/client";
import { emailSequences, leadSequenceEnrollments, leads } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LeadsTable } from "@/components/leads/leads-table";

export const metadata = { title: "Contacts" };
export const maxDuration = 30;

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 50;

const NON_NEW_STAGES = [
  "contacted",
  "replied",
  "quoted",
  "won",
  "lost",
] as const;
const TIERS = ["A", "B", "C"] as const;

/**
 * Contacts list — every lead that has been touched (a draft was
 * created, an email was sent, a reply landed, a quote went out, or
 * the deal closed). Mirror of /leads, but with the stage filter
 * inverted: /leads is `stage = new`, /contacts is `stage != new`.
 *
 * Tick advances stage `new → contacted` on the FIRST outbound — auto
 * send OR Gmail draft creation — so the lead automatically moves
 * here without any operator action.
 */
type Search = {
  q?: string;
  stage?: string;
  tier?: string;
  source?: string;
  tags?: string;
  lastContacted?: string;
  enrollment?: string;
  hasEmail?: string;
  perPage?: string;
  page?: string;
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  function parseCsv<T extends string>(
    raw: string | undefined,
    valid: readonly T[],
  ): T[] {
    if (!raw || raw === "all") return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is T => valid.includes(s as T));
  }

  // On /contacts the stage facet only lets you NARROW the non-new
  // set (e.g. "show only replied + won"). Any value that's not in
  // NON_NEW_STAGES is dropped.
  const stages = parseCsv(sp.stage, NON_NEW_STAGES);
  const tiers = parseCsv(sp.tier, TIERS);
  const perPage = PAGE_SIZE_OPTIONS.includes(
    Number(sp.perPage) as (typeof PAGE_SIZE_OPTIONS)[number],
  )
    ? Number(sp.perPage)
    : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(sp.page ?? 1));

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

  // ── WHERE ─────────────────────────────────────────────────────────
  // Locked to stage != 'new'. Anything still in 'new' belongs on
  // /leads, not here.
  const filters: SQL[] = [
    isNull(leads.archivedAt),
    sql`${leads.stage} != 'new'` as SQL,
  ];

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
  if (stages.length > 0) {
    filters.push(
      inArray(
        leads.stage,
        stages as unknown as (typeof NON_NEW_STAGES)[number][],
      ),
    );
  }
  if (tiers.length > 0)
    filters.push(inArray(leads.tier, tiers as (typeof TIERS)[number][]));

  if (lastContacted === "never") {
    filters.push(isNull(leads.lastContactedAt));
  } else if (lastContacted === "7d") {
    filters.push(sql`${leads.lastContactedAt} >= now() - interval '7 days'`);
  } else if (lastContacted === "30d") {
    filters.push(sql`${leads.lastContactedAt} >= now() - interval '30 days'`);
  } else if (lastContacted === "90d") {
    filters.push(sql`${leads.lastContactedAt} >= now() - interval '90 days'`);
  }

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

  const [[{ count }], rows, sequenceRows, [{ leadsCount }]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(where),
    db
      .select()
      .from(leads)
      .where(where)
      .orderBy(
        desc(leads.lastContactedAt),
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
    db
      .select({ leadsCount: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(isNull(leads.archivedAt), eq(leads.stage, "new")) as SQL,
      ),
  ]);

  const totalPages = Math.max(1, Math.ceil(count / perPage));

  // Per-stage breakdown for the header chips. Cheap aggregate so
  // operators see the funnel without leaving the page.
  const stageCounts = await db
    .select({
      stage: leads.stage,
      n: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(
      and(isNull(leads.archivedAt), sql`${leads.stage} != 'new'`) as SQL,
    )
    .groupBy(leads.stage);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Contacts
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            <span className="font-mono tabular-nums">{count}</span>{" "}
            with outbound activity · ranked by most recent contact
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {NON_NEW_STAGES.map((s) => {
              const n = stageCounts.find((r) => r.stage === s)?.n ?? 0;
              const active = stages.length === 1 && stages[0] === s;
              return (
                <Link
                  key={s}
                  href={
                    active ? "/contacts" : `/contacts?stage=${s}`
                  }
                  className={
                    active
                      ? "inline-flex h-7 items-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground"
                      : "inline-flex h-7 items-center rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  }
                >
                  {s}{" "}
                  <span className="ml-1.5 font-mono tabular-nums">{n}</span>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/leads"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to fresh leads ({leadsCount})
          </Link>
        </div>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 px-6 py-10 text-sm">
            <Inbox className="size-6 text-muted-foreground" />
            <p className="font-medium text-foreground">
              No contacts yet.
            </p>
            <p className="text-muted-foreground">
              Leads land here automatically once an email is sent or a
              Gmail draft is created. Right now you have{" "}
              <span className="font-mono tabular-nums">{leadsCount}</span>{" "}
              fresh prospect{leadsCount === 1 ? "" : "s"} on /leads.
            </p>
            <Link href="/leads">
              <Button size="sm">Go to /leads</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-mono tabular-nums text-foreground">
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, count)}
            </span>{" "}
            of <span className="font-mono tabular-nums text-foreground">{count}</span>
          </p>
          <div className="pb-24">
            <LeadsTable rows={rows} sequences={sequenceRows} />
          </div>
          {totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              params={{
                q,
                stage: stages.join(",") || undefined,
                tier: tiers.join(",") || undefined,
                lastContacted:
                  lastContacted !== "any" ? lastContacted : undefined,
                enrollment: enrollment !== "any" ? enrollment : undefined,
                hasEmail: hasEmail !== "any" ? hasEmail : undefined,
                perPage:
                  perPage === DEFAULT_PAGE_SIZE ? undefined : String(perPage),
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  const linkFor = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    if (n > 1) sp.set("page", String(n));
    const qs = sp.toString();
    return `/contacts${qs ? `?${qs}` : ""}`;
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
        Page <span className="font-mono tabular-nums text-foreground">{page}</span>{" "}
        of{" "}
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
