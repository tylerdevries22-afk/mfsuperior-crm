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

  const [
    [{ activeEnrollments }],
    [{ draftsPending }],
    [{ replies7d }],
    [{ opens7d }],
    [{ totalLeads }],
    [{ newThisWeek }],
  ] = await Promise.all([
    db
      .select({ activeEnrollments: sql<number>`count(*)::int` })
      .from(leadSequenceEnrollments)
      .where(eq(leadSequenceEnrollments.status, "active")),

    db
      .select({ draftsPending: sql<number>`count(*)::int` })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.eventType, "draft_created"),
          gte(emailEvents.occurredAt, since),
        ),
      ),

    db
      .select({ replies7d: sql<number>`count(*)::int` })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.eventType, "replied"),
          gte(emailEvents.occurredAt, since),
        ),
      ),

    db
      .select({ opens7d: sql<number>`count(*)::int` })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.eventType, "opened"),
          gte(emailEvents.occurredAt, since),
        ),
      ),

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

  const KPI = [
    { label: "Active enrollments", value: String(activeEnrollments), primary: true },
    { label: "Drafts pending (7d)", value: String(draftsPending), primary: false },
    { label: "Replies (7d)", value: String(replies7d), primary: false },
    { label: "Opens (7d)", value: String(opens7d), primary: false },
    { label: "Total active leads", value: String(totalLeads), primary: false },
    { label: "New this week", value: String(newThisWeek), primary: false },
  ] as const;

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
