import { and, eq, gte, isNull, sql } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db/client";
import {
  emailEvents,
  leadSequenceEnrollments,
  leads,
} from "@/lib/db/schema";
import { Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard" };

function sevenDaysAgo(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export default async function DashboardPage() {
  const since = sevenDaysAgo();

  // ── Email-engagement funnel ──────────────────────────────────────
  // One aggregated query over `emailEvents` returns counts of EVERY
  // tracked event-type in the last 7 days. Previously we issued 5+
  // separate `count(*)` queries and the dashboard only surfaced
  // 2 of them (opens, replies) — sends, clicks and bounces were
  // completely invisible to the operator even though the pipeline
  // was writing them. Single-query approach also lets unique
  // (distinct-lead) counts come back without N round-trips.
  type EventTypeRow = {
    eventType: string;
    eventCount: number;
    uniqueLeads: number;
  };
  const eventCountsRows = (await db
    .select({
      eventType: emailEvents.eventType,
      eventCount: sql<number>`count(*)::int`,
      uniqueLeads: sql<number>`count(distinct ${emailEvents.leadId})::int`,
    })
    .from(emailEvents)
    .where(gte(emailEvents.occurredAt, since))
    .groupBy(emailEvents.eventType)) as EventTypeRow[];

  const eventCount = (type: string): number =>
    eventCountsRows.find((r) => r.eventType === type)?.eventCount ?? 0;
  const uniqueLeads = (type: string): number =>
    eventCountsRows.find((r) => r.eventType === type)?.uniqueLeads ?? 0;

  const sent7d = eventCount("sent");
  const draftsPending = eventCount("draft_created");
  const opens7d = eventCount("opened");
  const clicks7d = eventCount("clicked");
  const replies7d = eventCount("replied");
  const bounced7d = eventCount("bounced");
  const failed7d = eventCount("failed");
  // Unique-leads counts let us compute "open rate" as a percentage of
  // sends-to-distinct-recipients instead of inflating with multi-opens.
  const uniqueOpens7d = uniqueLeads("opened");

  const [
    [{ activeEnrollments }],
    [{ totalLeads }],
    [{ newThisWeek }],
  ] = await Promise.all([
    db
      .select({ activeEnrollments: sql<number>`count(*)::int` })
      .from(leadSequenceEnrollments)
      .where(eq(leadSequenceEnrollments.status, "active")),

    db
      .select({ totalLeads: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          isNull(leads.archivedAt),
          eq(leads.status, "active"),
        ),
      ),

    db
      .select({ newThisWeek: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          isNull(leads.archivedAt),
          gte(leads.createdAt, since),
        ),
      ),
  ]);

  // Engagement rate (open rate) — unique opens / sends. Sends ==0
  // case avoided so the dashboard doesn't render NaN%.
  const openRate =
    sent7d > 0 ? Math.round((uniqueOpens7d / sent7d) * 100) : null;

  // KPI grid order: funnel left-to-right (Sent → Opened → Clicked →
  // Replied), bounces + drafts on a second row, lead counts on the
  // third. Primary card highlights the headline send volume so the
  // operator sees at a glance whether the cron-driven tick is
  // actually firing.
  const KPI = [
    { label: "Sent (7d)", value: String(sent7d), primary: true },
    {
      label: "Opens (7d)",
      value:
        openRate != null
          ? `${opens7d} · ${openRate}%`
          : String(opens7d),
      primary: false,
    },
    { label: "Clicks (7d)", value: String(clicks7d), primary: false },
    { label: "Replies (7d)", value: String(replies7d), primary: false },
    { label: "Bounced (7d)", value: String(bounced7d), primary: false },
    {
      label: "Drafts pending (7d)",
      value: String(draftsPending),
      primary: false,
    },
    { label: "Active enrollments", value: String(activeEnrollments), primary: false },
    { label: "Total active leads", value: String(totalLeads), primary: false },
    { label: "New leads this week", value: String(newThisWeek), primary: false },
  ] as const;

  // Surface tick failures as a separate warning banner if any.
  const showFailureWarning = failed7d > 0;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of pipeline activity and outbound email engagement.
        </p>
      </header>

      {showFailureWarning && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <span aria-hidden className="font-semibold">
            ⚠
          </span>
          <span>
            <span className="font-mono tabular-nums">{failed7d}</span> email
            send{failed7d === 1 ? "" : "s"} failed in the last 7 days —
            check <Link href="/admin?tab=tick" className="underline">Admin → Engine</Link>{" "}
            for the most recent tick report.
          </span>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KPI.map(({ label, value, primary }) => (
          <Card
            key={label}
            className={
              primary
                ? "relative overflow-hidden ring-1 ring-primary/40 bg-gradient-to-br from-primary/5 via-card to-card"
                : undefined
            }
          >
            {primary && (
              <span
                aria-hidden
                className="absolute left-0 top-0 h-full w-[3px] bg-primary"
              />
            )}
            <CardContent className="px-5 py-5">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {primary && (
                  <span
                    aria-hidden
                    className="inline-block size-1.5 rounded-full bg-primary"
                  />
                )}
                {label}
              </p>
              <p
                className={
                  primary
                    ? "mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground"
                    : "mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground"
                }
              >
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-10">
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Configure your sender identity and Drive folder in Settings, then
              import leads.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ol className="list-inside list-decimal space-y-1.5">
              <li>Open Settings and complete the business identity form.</li>
              <li>Connect Google (Gmail + Drive) on first sign-in.</li>
              <li>
                Import the existing 50-lead spreadsheet from{" "}
                <span className="font-mono text-xs">01_Lead_List.xlsx</span>.
              </li>
              <li>Seed the Day 0 / Day 4 / Day 10 sequence templates.</li>
              <li>Enroll your first lead and review the draft in Gmail.</li>
            </ol>
            {totalLeads === 0 && (
              <div className="mt-5">
                <Link href="/leads/import">
                  <Button>
                    <Upload /> Import spreadsheet
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
