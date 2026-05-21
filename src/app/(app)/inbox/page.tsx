import Link from "next/link";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  Send,
  Eye,
  MousePointer,
  MessageSquare,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Ban,
  Inbox,
} from "lucide-react";
import { db } from "@/lib/db/client";
import { emailEvents, emailTemplates, leads } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InboxAutoRefresh } from "./inbox-auto-refresh";

export const metadata = { title: "Inbox" };

// Force every navigation/refresh to re-fetch from Postgres. The
// inbox auto-refresh client component depends on `router.refresh()`
// pulling fresh rows on each tick; without this, Next.js may serve
// the cached RSC payload and the visible feed stays stale even
// though the spin animation plays.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sent: Send,
  draft_created: FileText,
  opened: Eye,
  clicked: MousePointer,
  replied: MessageSquare,
  bounced: AlertTriangle,
  failed: AlertTriangle,
  unsubscribed: Ban,
  queued: CheckCircle2,
};

const EVENT_VARIANT: Record<
  string,
  "brand" | "success" | "warning" | "muted" | "neutral"
> = {
  sent: "muted",
  draft_created: "muted",
  opened: "success",
  clicked: "brand",
  replied: "warning",
  bounced: "neutral",
  failed: "neutral",
  unsubscribed: "muted",
  queued: "muted",
};

const EVENT_LABELS: Record<string, string> = {
  sent: "Sent",
  draft_created: "Draft created",
  opened: "Opened",
  clicked: "Clicked",
  replied: "Replied",
  bounced: "Bounced",
  failed: "Failed",
  unsubscribed: "Unsubscribed",
  queued: "Queued",
};

/** Friendlier label for `failed` events that were actually skips —
 *  the tick writes these for suppressed / no-email / capped /
 *  invalid_email cases so they show up in /inbox instead of vanishing
 *  silently. We read `metadataJson.kind` to pretty-print. */
const SKIP_LABELS: Record<string, string> = {
  skipped_suppressed: "Skipped: on suppression list",
  skipped_no_email: "Skipped: no email on lead",
  skipped_capped: "Skipped: daily send cap hit",
  skipped_invalid_email: "Skipped: invalid email (MX fail)",
  invalid_email: "Skipped: invalid email (MX fail)",
  auth: "Failed: provider auth error",
  other: "Failed: provider error",
};

function eventLabel(
  eventType: string,
  metadata: unknown,
): string {
  if (eventType === "failed") {
    const kind = (metadata as { kind?: string } | null)?.kind;
    if (kind && SKIP_LABELS[kind]) return SKIP_LABELS[kind];
  }
  return EVENT_LABELS[eventType] ?? eventType;
}

type Filter = "all" | "sent" | "opened" | "clicked" | "replied" | "bounced";

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "opened", label: "Opened" },
  { value: "clicked", label: "Clicked" },
  { value: "replied", label: "Replied" },
  { value: "bounced", label: "Bounced" },
];

const FILTER_EVENT_TYPES: Record<Filter, string[]> = {
  all: [],
  sent: ["sent", "draft_created"],
  opened: ["opened"],
  clicked: ["clicked"],
  replied: ["replied"],
  bounced: ["bounced", "failed"],
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = (FILTER_OPTIONS.map((o) => o.value).includes(sp.filter as Filter)
    ? sp.filter
    : "all") as Filter;
  const page = Math.max(1, Number(sp.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const eventTypes = FILTER_EVENT_TYPES[filter];

  const where: SQL[] = [];
  if (eventTypes.length > 0) {
    where.push(sql`${emailEvents.eventType} IN (${sql.join(eventTypes.map(t => sql`${t}`), sql`, `)})`);
  }
  // Exclude internal-only queued events from the default view
  if (filter === "all") {
    where.push(sql`${emailEvents.eventType} != 'queued'`);
  }

  const whereClause = where.length > 0
    ? (where.length === 1 ? where[0] : and(...where)) as SQL
    : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: emailEvents.id,
        eventType: emailEvents.eventType,
        occurredAt: emailEvents.occurredAt,
        leadId: emailEvents.leadId,
        enrollmentId: emailEvents.enrollmentId,
        sequenceStep: emailEvents.sequenceStep,
        metadataJson: emailEvents.metadataJson,
        companyName: leads.companyName,
        leadEmail: leads.email,
        leadFirstName: leads.firstName,
        templateName: emailTemplates.name,
        templateSubject: emailTemplates.subject,
      })
      .from(emailEvents)
      .leftJoin(leads, eq(emailEvents.leadId, leads.id))
      .leftJoin(emailTemplates, eq(emailEvents.templateId, emailTemplates.id))
      .where(whereClause)
      .orderBy(desc(emailEvents.occurredAt))
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ total: sql<number>`count(*)::int` })
      .from(emailEvents)
      .where(whereClause),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Inbox
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Email activity feed — every send, open, click, and reply.
          </p>
        </div>
        <InboxAutoRefresh />
      </header>

      {/* Filter tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/inbox?filter=${opt.value}`}
            className={
              filter === opt.value
                ? "inline-flex h-8 items-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
                : "inline-flex h-8 items-center rounded-full border border-border bg-card px-4 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            }
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="font-medium text-foreground">No activity yet.</p>
            <p className="text-sm text-muted-foreground">
              Email events appear here as sequences run. Enroll a lead and
              trigger a tick from the Admin page to see the first entry.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-1">
            {rows.map((row) => {
              const Icon = EVENT_ICONS[row.eventType] ?? CheckCircle2;
              const variant = EVENT_VARIANT[row.eventType] ?? "muted";
              const label = eventLabel(row.eventType, row.metadataJson);
              const displayName =
                row.companyName ||
                [row.leadFirstName].filter(Boolean).join(" ") ||
                row.leadEmail ||
                "Unknown";

              return (
                <div
                  key={row.id}
                  className="flex items-start gap-4 rounded-md border border-border bg-card px-5 py-3.5 transition-colors hover:border-border/80"
                >
                  <div className="mt-0.5 shrink-0">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={variant} className="text-[10px]">
                        {label}
                      </Badge>
                      {row.sequenceStep != null && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          step {row.sequenceStep}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {displayName}
                      {row.leadEmail && row.companyName && (
                        <span className="ml-2 font-normal text-muted-foreground">
                          {row.leadEmail}
                        </span>
                      )}
                    </p>
                    {row.templateSubject && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {row.templateName
                          ? `${row.templateName} — `
                          : ""}
                        {row.templateSubject}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {new Date(row.occurredAt).toLocaleDateString()}{" "}
                      {new Date(row.occurredAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {row.leadId && (
                      <Link
                        href={`/leads/${row.leadId}`}
                        className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        View lead →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {(hasPrev || hasNext) && (
            <div className="mt-6 flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} &middot;{" "}
                <span className="font-mono tabular-nums">{total}</span> events
              </span>
              <div className="flex gap-2">
                {hasPrev && (
                  <Link
                    href={`/inbox?filter=${filter}&page=${page - 1}`}
                    className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    ← Prev
                  </Link>
                )}
                {hasNext && (
                  <Link
                    href={`/inbox?filter=${filter}&page=${page + 1}`}
                    className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
