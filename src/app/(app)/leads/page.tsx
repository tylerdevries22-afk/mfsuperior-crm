import Link from "next/link";
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { Plus, Upload, Search } from "lucide-react";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StageChip, TierChip } from "@/components/leads/stage-chip";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Leads" };

const PAGE_SIZE = 25;

const STAGES = ["new", "contacted", "replied", "quoted", "won", "lost"] as const;
const TIERS = ["A", "B", "C"] as const;

type Search = {
  q?: string;
  stage?: string;
  tier?: string;
  page?: string;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const stage = STAGES.includes((sp.stage ?? "") as (typeof STAGES)[number])
    ? (sp.stage as (typeof STAGES)[number])
    : undefined;
  const tier = TIERS.includes((sp.tier ?? "") as (typeof TIERS)[number])
    ? (sp.tier as (typeof TIERS)[number])
    : undefined;
  const page = Math.max(1, Number(sp.page ?? 1));

  const filters: SQL[] = [isNull(leads.archivedAt)];
  if (q) {
    filters.push(
      or(
        ilike(leads.companyName, `%${q}%`),
        ilike(leads.email, `%${q}%`),
        ilike(leads.city, `%${q}%`),
        ilike(leads.vertical, `%${q}%`),
      ) as SQL,
    );
  }
  if (stage) filters.push(eq(leads.stage, stage));
  if (tier) filters.push(eq(leads.tier, tier));

  const where = filters.length === 1 ? filters[0] : and(...filters);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(where);

  const rows = await db
    .select()
    .from(leads)
    .where(where)
    .orderBy(
      desc(isNotNull(leads.score)),
      desc(leads.score),
      asc(leads.companyName),
    )
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Leads
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{count}</span> active ·
            ranked by score
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        <Select name="stage" defaultValue={stage ?? ""} className="w-40">
          <option value="">All stages</option>
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
        <Button type="submit" variant="outline">Filter</Button>
        {(q || stage || tier) && (
          <Link
            href="/leads"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Reset
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState hasFilters={!!(q || stage || tier)} />
      ) : (
        <>
          <DesktopTable rows={rows} />
          <MobileCardList rows={rows} />
          <Pagination
            page={page}
            totalPages={totalPages}
            params={{ q, stage, tier }}
          />
        </>
      )}
    </div>
  );
}

/* ───── Desktop table ────────────────────────────────────────── */

function DesktopTable({
  rows,
}: {
  rows: Array<typeof leads.$inferSelect>;
}) {
  return (
    <div className="hidden md:block overflow-hidden rounded-md border border-border">
      <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2.5 text-right font-medium w-12">#</th>
              <th className="px-2 py-2.5 font-medium w-12">Tier</th>
              <th className="px-2 py-2.5 text-right font-medium w-16">Score</th>
              <th className="px-3 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Vertical</th>
              <th className="px-3 py-2.5 font-medium">City</th>
              <th className="px-3 py-2.5 font-medium">Stage</th>
              <th className="px-3 py-2.5 font-medium">Last contacted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {rows.map((lead, i) => (
              <tr
                key={lead.id}
                className="group transition-colors hover:bg-secondary/40"
              >
                <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </td>
                <td className="px-2 py-2.5">
                  <TierChip tier={lead.tier} />
                </td>
                <td className="px-2 py-2.5 text-right font-mono text-sm tabular-nums text-foreground">
                  {lead.score ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-foreground transition-colors hover:text-primary"
                  >
                    {lead.companyName ?? "—"}
                  </Link>
                  {lead.email && (
                    <p className="font-mono text-xs text-muted-foreground">
                      {lead.email}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {lead.vertical ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {lead.city ?? "—"}
                  {lead.state ? `, ${lead.state}` : ""}
                </td>
                <td className="px-3 py-2.5">
                  <StageChip stage={lead.stage} />
                </td>
                <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
                  {lead.lastContactedAt
                    ? new Date(lead.lastContactedAt).toISOString().slice(0, 10)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───── Mobile card list ─────────────────────────────────────── */

function MobileCardList({
  rows,
}: {
  rows: Array<typeof leads.$inferSelect>;
}) {
  return (
    <ul className="md:hidden space-y-2">
      {rows.map((lead) => (
        <li key={lead.id}>
          <Link
            href={`/leads/${lead.id}`}
            className="block rounded-md border border-border bg-card px-4 py-3 transition-colors active:translate-y-[1px] hover:bg-secondary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {lead.companyName ?? "—"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {lead.vertical ?? "—"}
                  {lead.city ? ` · ${lead.city}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <TierChip tier={lead.tier} />
                <span className="font-mono text-sm tabular-nums">
                  {lead.score ?? "—"}
                </span>
              </div>
            </div>
            <div className="mt-2">
              <StageChip stage={lead.stage} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ───── Empty state ─────────────────────────────────────────── */

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
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
              Import your existing spreadsheet to seed the pipeline. The kit's{" "}
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
  params: { q?: string; stage?: string; tier?: string };
}) {
  if (totalPages <= 1) return null;
  const linkFor = (n: number) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.stage) sp.set("stage", params.stage);
    if (params.tier) sp.set("tier", params.tier);
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
