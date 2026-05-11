import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Play, AlertTriangle, Inbox, FolderSync, X, Plus, Search as SearchIcon, Zap, ArrowDownToLine } from "lucide-react";
import { db } from "@/lib/db/client";
import { auditLog, leads, suppressionList, users } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  addSuppressionAction,
  fixBusinessNameAction,
  generateLeadsAction,
  importDenverBatch1Action,
  manualPollAction,
  manualSyncAction,
  manualTickAction,
  purgeNoEmailLeadsAction,
  removeSuppressionAction,
  unarchiveAllLeadsAction,
  validateAllEmailsAction,
  wipeGuessedLeadsAction,
} from "./actions";
import { userHasGoogleConnection } from "@/lib/gmail/oauth";

export const metadata = { title: "Admin" };

// Server actions invoked from /admin (manual tick, manual poll, sync,
// Run free/paid research) run inside the Vercel serverless function for
// this route. Default Hobby cap is 10s, Pro is 60s — bump explicitly so
// the longer-running research action gets the full Pro budget.
export const maxDuration = 60;

type Search = {
  drafted?: string;
  sent?: string;
  completed?: string;
  paused?: string;
  suppressed?: string;
  no_email?: string;
  capped?: string;
  failed?: string;
  due?: string;
  dur?: string;
  notes?: string;
  poll?: string;
  threads?: string;
  replies?: string;
  bounces?: string;
  handled?: string;
  poll_errors?: string;
  poll_dur?: string;
  poll_notes?: string;
  sync?: string;
  sync_file?: string;
  sync_rows?: string;
  sync_inserted?: string;
  sync_confirmed?: string;
  sync_orphans?: string;
  sync_orphans_cleared?: string;
  sync_dur?: string;
  sync_notes?: string;
  // Lead research result banner
  research?: string;
  research_mode?: string;
  research_error?: string;
  r_discovered?: string;
  r_enriched?: string;
  r_a?: string;
  r_b?: string;
  r_c?: string;
  r_dropped?: string;
  r_refrig?: string;
  r_inserted?: string;
  r_updated?: string;
  r_conflicts?: string;
  r_no_email?: string;
  r_freemail?: string;
  r_role?: string;
  r_dur?: string;
  // validateAllEmailsAction redirect params
  validated?: string;
  v_checked?: string;
  v_valid?: string;
  v_invalid?: string;
  v_deleted?: string;
  v_dur?: string;
  validate_error?: string;
  // fixBusinessNameAction redirect params
  bizfix?: string;
  bizfix_updated?: string;
  bizfix_error?: string;
  // importDenverBatch1Action redirect params
  batch1?: string;
  b1_validated?: string;
  b1_inserted?: string;
  b1_dup?: string;
  b1_invalid?: string;
  b1_enrolled?: string;
  b1_already?: string;
  b1_dur?: string;
  b1_sequence?: string;
  b1_error?: string;
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const ranTick = sp.due !== undefined;
  const ranPoll = sp.poll === "1";
  const ranSync = sp.sync === "1";

  const [
    recentAudit,
    suppressionRows,
    [{ userCount }],
    [{ orphanCount }],
  ] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.occurredAt))
      .limit(20),
    db
      .select()
      .from(suppressionList)
      .orderBy(desc(suppressionList.createdAt))
      .limit(100),
    db
      .select({ userCount: sql<number>`count(*)::int` })
      .from(users),
    db
      .select({ orphanCount: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.driveSyncOrphan, true)),
  ]);

  // Quick health check: does any user have a Google connection?
  const userRows = await db.select({ id: users.id }).from(users);
  let connectedCount = 0;
  for (const u of userRows) {
    if (await userHasGoogleConnection(u.id)) connectedCount++;
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Admin
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manual tick, audit log, suppression list, health.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Manual tick */}
        <Card>
          <CardHeader>
            <CardTitle>Sequence engine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cron runs every 15 minutes in production via{" "}
              <span className="font-mono">/api/cron/tick-sequences</span>.
              You can run it manually here for local testing.
            </p>
            <form action={manualTickAction} className="flex flex-wrap items-center gap-2">
              <Button type="submit">
                <Play /> Run tick now
              </Button>
              <InfoTooltip label="What does Run tick do?">
                <p className="font-medium text-foreground">Run tick now</p>
                <p className="mt-1 text-muted-foreground">
                  Fires the cold-pitch send pipeline. Scans every active
                  enrollment whose <span className="font-mono">nextSendAt</span>{" "}
                  is due, picks the right template step, personalizes it with
                  the lead&apos;s fields, then injects:
                </p>
                <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-muted-foreground">
                  <li>compliance footer + unsubscribe link</li>
                  <li>open-tracking pixel</li>
                  <li>click-tracking on every link</li>
                </ul>
                <p className="mt-2 text-muted-foreground">
                  On a successful auto-send: lead stage advances{" "}
                  <span className="font-mono">new → contacted</span>,{" "}
                  <span className="font-mono">lastContactedAt</span> is stamped,
                  and the enrollment moves to the next step. Templates set to{" "}
                  <span className="font-mono">draft</span> mode stage a Gmail
                  draft instead of sending.
                </p>
                <p className="mt-2 text-muted-foreground">
                  Production: cron every 15 min via{" "}
                  <span className="font-mono">/api/cron/tick-sequences</span>.
                </p>
              </InfoTooltip>
            </form>

            {ranTick && (
              <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-secondary/30 px-4 py-3 sm:grid-cols-3">
                <Stat label="Due" value={Number(sp.due ?? 0)} />
                <Stat label="Drafted" value={Number(sp.drafted ?? 0)} accent />
                <Stat label="Sent" value={Number(sp.sent ?? 0)} accent />
                <Stat label="Completed" value={Number(sp.completed ?? 0)} muted />
                <Stat label="Paused" value={Number(sp.paused ?? 0)} muted />
                <Stat label="Failed" value={Number(sp.failed ?? 0)} muted />
                <Stat label="Suppressed" value={Number(sp.suppressed ?? 0)} muted />
                <Stat label="No email" value={Number(sp.no_email ?? 0)} muted />
                <Stat label="Capped" value={Number(sp.capped ?? 0)} muted />
                <p className="col-span-full mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                  {Number(sp.dur ?? 0)}ms
                </p>
                {sp.notes && (
                  <ul className="col-span-full mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {decodeURIComponent(sp.notes)
                      .split("|")
                      .filter(Boolean)
                      .map((n) => (
                        <li key={n}>· {n}</li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual poll */}
        <Card>
          <CardHeader>
            <CardTitle>Inbox poller</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cron runs every 5 minutes in production via{" "}
              <span className="font-mono">/api/cron/poll-replies</span>.
              Detects replies and bounces on every active enrollment&apos;s Gmail
              thread, idempotently.
            </p>
            <form action={manualPollAction} className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="secondary">
                <Inbox /> Run poll now
              </Button>
              <InfoTooltip label="What does Run poll do?">
                <p className="font-medium text-foreground">Run poll now</p>
                <p className="mt-1 text-muted-foreground">
                  Sweeps the Gmail thread of every active enrollment for new{" "}
                  <span className="font-medium text-foreground">replies</span>{" "}
                  and{" "}
                  <span className="font-medium text-foreground">bounces</span>.
                </p>
                <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-muted-foreground">
                  <li>
                    Reply → enrollment paused, lead stage{" "}
                    <span className="font-mono">→ replied</span>, surfaces in{" "}
                    <span className="font-mono">/inbox</span>.
                  </li>
                  <li>
                    Bounce → enrollment paused, address added to suppression
                    list, <span className="font-mono">bounced</span> event
                    emitted.
                  </li>
                </ul>
                <p className="mt-2 text-muted-foreground">
                  Idempotent — re-running won&apos;t double-handle a thread.
                  Only works for users who&apos;ve connected Gmail (uses their
                  OAuth token).
                </p>
                <p className="mt-2 text-muted-foreground">
                  Production: cron every 5 min via{" "}
                  <span className="font-mono">/api/cron/poll-replies</span>.
                </p>
              </InfoTooltip>
            </form>

            {ranPoll && (
              <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-secondary/30 px-4 py-3 sm:grid-cols-3">
                <Stat label="Threads" value={Number(sp.threads ?? 0)} />
                <Stat label="Replies" value={Number(sp.replies ?? 0)} accent />
                <Stat label="Bounces" value={Number(sp.bounces ?? 0)} accent />
                <Stat label="Already handled" value={Number(sp.handled ?? 0)} muted />
                <Stat label="Errors" value={Number(sp.poll_errors ?? 0)} muted />
                <p className="col-span-full mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                  {Number(sp.poll_dur ?? 0)}ms
                </p>
                {sp.poll_notes && (
                  <ul className="col-span-full mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {decodeURIComponent(sp.poll_notes)
                      .split("|")
                      .filter(Boolean)
                      .map((n) => (
                        <li key={n}>· {n}</li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Drive sync */}
        <Card>
          <CardHeader>
            <CardTitle>Drive sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cron runs hourly via{" "}
              <span className="font-mono">/api/cron/sync-drive</span>.
              Pull-only for v1: new sheet rows are inserted, existing matches
              are confirmed, and DB rows missing from the sheet are flagged
              as orphans (never deleted).
            </p>
            <form action={manualSyncAction} className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="secondary">
                <FolderSync /> Run sync now
              </Button>
              <InfoTooltip label="What does Run sync do?">
                <p className="font-medium text-foreground">Run sync now</p>
                <p className="mt-1 text-muted-foreground">
                  Pulls the canonical lead workbook from your configured Drive
                  folder and reconciles it with the{" "}
                  <span className="font-mono">leads</span> table:
                </p>
                <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-muted-foreground">
                  <li>New rows → inserted as fresh leads.</li>
                  <li>
                    Existing matches (by email) → confirmed,{" "}
                    <span className="font-mono">driveSyncedAt</span> stamped.
                  </li>
                  <li>
                    DB rows missing from the sheet → flagged as orphans
                    (visible in Health, never auto-deleted).
                  </li>
                </ul>
                <p className="mt-2 text-muted-foreground">
                  Pull-only for v1 — no writes back to Drive. Requires a Drive
                  folder ID in <span className="font-mono">/settings</span>.
                </p>
                <p className="mt-2 text-muted-foreground">
                  Production: cron hourly via{" "}
                  <span className="font-mono">/api/cron/sync-drive</span>.
                </p>
              </InfoTooltip>
            </form>

            {ranSync && (
              <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-secondary/30 px-4 py-3 sm:grid-cols-3">
                {sp.sync_file && (
                  <p className="col-span-full truncate font-mono text-xs text-muted-foreground">
                    {sp.sync_file}
                  </p>
                )}
                <Stat label="Sheet rows" value={Number(sp.sync_rows ?? 0)} />
                <Stat label="Inserted" value={Number(sp.sync_inserted ?? 0)} accent />
                <Stat label="Confirmed" value={Number(sp.sync_confirmed ?? 0)} muted />
                <Stat label="Orphans new" value={Number(sp.sync_orphans ?? 0)} muted />
                <Stat label="Orphans cleared" value={Number(sp.sync_orphans_cleared ?? 0)} muted />
                <p className="col-span-1 mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                  {Number(sp.sync_dur ?? 0)}ms
                </p>
                {sp.sync_notes && (
                  <ul className="col-span-full mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {decodeURIComponent(sp.sync_notes)
                      .split("|")
                      .filter(Boolean)
                      .map((n) => (
                        <li key={n}>· {n}</li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Health */}
        <Card>
          <CardHeader>
            <CardTitle>Health</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row label="Users" value={String(userCount)} />
              <Row
                label="Google-connected users"
                value={String(connectedCount)}
                warn={connectedCount === 0}
              />
              <Row label="Suppressed addresses" value={String(suppressionRows.length)} />
              <Row
                label="Drive sync orphans"
                value={String(orphanCount)}
                warn={orphanCount > 0}
              />
            </dl>
            {connectedCount === 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <p className="text-foreground">
                  No user has connected Google yet. Sign in via the{" "}
                  <span className="font-mono">Continue with Google</span>{" "}
                  button (not the dev panel) so the tick engine can call the
                  Gmail API.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lead research */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Lead research
            <InfoTooltip label="What does Lead research do?">
              <p className="font-medium text-foreground">Lead research</p>
              <p className="mt-1 text-muted-foreground">
                Discovers Denver-Metro freight-friendly companies, scores them
                Tier A/B/C, finds the right contact email, and upserts directly
                into the <span className="font-mono">leads</span> table — new
                rows show up on <span className="font-mono">/leads</span>{" "}
                immediately.
              </p>
              <p className="mt-2 font-medium text-foreground">Free mode</p>
              <p className="mt-1 text-muted-foreground">
                OpenStreetMap discovery + cheerio scrape of /about /contact +
                node:dns MX-record check. No API keys, no credit card. Quality
                is solid for restaurants and small biz; broker/3PL coverage is
                thinner than paid mode.
              </p>
              <p className="mt-2 font-medium text-foreground">Paid mode</p>
              <p className="mt-1 text-muted-foreground">
                Google Places API + Hunter.io domain-search + email-verifier.
                Requires{" "}
                <span className="font-mono">GOOGLE_MAPS_API_KEY</span> and{" "}
                <span className="font-mono">HUNTER_API_KEY</span> env vars
                (Hunter free tier 25/25/mo, Starter $49/mo unlocks 500/1000).
                Best for B2B coverage and verified emails.
              </p>
              <p className="mt-2 text-muted-foreground">
                <strong>Vercel timeout caveat:</strong> the button runs
                synchronously inside a serverless function (Hobby = 10s, Pro =
                60s). Cap is 20 leads from the UI — for larger batches run{" "}
                <span className="font-mono">npm run leads:research</span> from
                your machine.
              </p>
            </InfoTooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pick a mode, set a small batch size, and the script will run
            server-side and upsert into the live database. Refresh{" "}
            <span className="font-mono">/leads</span> after to see the new
            rows.
          </p>

          {/* Unarchive: reverse every archive (full table or last N) */}
          <form
            action={unarchiveAllLeadsAction}
            className="flex flex-wrap items-start gap-3 rounded-md border border-success/40 bg-success/10 p-4"
          >
            <div className="flex-1 min-w-[260px]">
              <p className="font-medium text-foreground">
                Unarchive leads
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reverses any archive — sets <span className="font-mono">archivedAt = NULL</span>{" "}
                for the matched rows so they reappear on{" "}
                <span className="font-mono">/leads</span>. Default scope is{" "}
                <strong className="text-foreground">all</strong> archived rows;
                pick a tighter window if you only want to recover a recent
                batch.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">
                Window
                <select
                  name="since"
                  defaultValue="all"
                  className="ml-2 h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                >
                  <option value="15m">Last 15 min</option>
                  <option value="1h">Last 1 hour</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="all">All archived</option>
                </select>
              </label>
              <Button type="submit" size="sm" variant="outline">
                Unarchive
              </Button>
            </div>
          </form>

          {/* Purge: archive every lead without an email */}
          <form
            action={purgeNoEmailLeadsAction}
            className="flex flex-wrap items-start gap-3 rounded-md border border-warning/50 bg-warning/10 p-4"
          >
            <div className="flex-1 min-w-[260px]">
              <p className="font-medium text-foreground">
                Purge leads without an email
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Archives every lead where <span className="font-mono">email IS NULL</span>{" "}
                (sets <span className="font-mono">archivedAt = now()</span>) so they
                disappear from <span className="font-mono">/leads</span> immediately.
                <strong className="text-foreground"> Reversible:</strong> the rows
                aren&apos;t deleted — clearing <span className="font-mono">archivedAt</span>{" "}
                in SQL brings them back. Use this to wipe the legacy spreadsheet
                seed before populating with high-quality emailed leads via the
                button below.
              </p>
            </div>
            <Button type="submit" size="sm" variant="destructive">
              <X /> Archive all email-less leads
            </Button>
          </form>

          {/* One-shot: fix legacy "Solutions" → "Products" in the settings table */}
          <form
            action={fixBusinessNameAction}
            className="flex flex-wrap items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-4"
          >
            <div className="flex-1 min-w-[260px]">
              <p className="font-medium text-foreground">
                Fix legacy business name in settings
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Runs{" "}
                <span className="font-mono">
                  UPDATE settings SET business_name = &apos;MF Superior Products&apos;
                  WHERE business_name = &apos;MF Superior Solutions&apos;
                </span>
                . The schema default was corrected in PR #31, but existing
                rows still hold the old typo, which means the compliance
                footer on outbound emails signs as &quot;Solutions&quot;.
                Idempotent — clicking after the fix lands updates 0 rows.
              </p>
              {sp.bizfix === "1" && sp.bizfix_error ? (
                <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
                  {decodeURIComponent(sp.bizfix_error)}
                </p>
              ) : sp.bizfix === "1" ? (
                <p className="mt-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-foreground">
                  Updated{" "}
                  <span className="font-mono tabular-nums">
                    {Number(sp.bizfix_updated ?? 0)}
                  </span>{" "}
                  settings row
                  {Number(sp.bizfix_updated ?? 0) === 1 ? "" : "s"}.
                  Outbound emails will now sign as &quot;MF Superior Products&quot;.
                </p>
              ) : null}
            </div>
            <Button type="submit" size="sm">
              Fix business name
            </Button>
          </form>

          {/* Validate all emails: MX-check every lead, hard-delete failures */}
          <form
            action={validateAllEmailsAction}
            className="flex flex-wrap items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4"
          >
            <div className="flex-1 min-w-[260px]">
              <p className="font-medium text-foreground">
                Validate all lead emails
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                MX-checks every non-archived lead with an email. Rejects
                no-MX, freemail (gmail/yahoo/etc.), disposable mailbox
                services, and role-only addresses on no-MX domains.{" "}
                <strong className="text-foreground">
                  Hard-deletes the failures.
                </strong>{" "}
                Forensic recovery: every deleted row&apos;s full payload is
                captured in the audit log&apos;s <span className="font-mono">beforeJson</span>{" "}
                so a false positive can be SQL-restored. Also runs Mondays
                at 09:00 UTC via cron + as a per-send safety net inside
                the tick engine.
              </p>
              {sp.validated === "1" && sp.validate_error ? (
                <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
                  {decodeURIComponent(sp.validate_error)}
                </p>
              ) : sp.validated === "1" ? (
                <p className="mt-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-foreground">
                  Last run: checked{" "}
                  <span className="font-mono tabular-nums">{Number(sp.v_checked ?? 0)}</span>,
                  valid{" "}
                  <span className="font-mono tabular-nums">{Number(sp.v_valid ?? 0)}</span>,
                  invalid{" "}
                  <span className="font-mono tabular-nums">{Number(sp.v_invalid ?? 0)}</span>,
                  deleted{" "}
                  <span className="font-mono tabular-nums">{Number(sp.v_deleted ?? 0)}</span>
                  {" "}in{" "}
                  <span className="font-mono tabular-nums">{Number(sp.v_dur ?? 0)}</span>ms.
                </p>
              ) : null}
            </div>
            <Button type="submit" size="sm" variant="destructive">
              <X /> Validate &amp; delete invalid
            </Button>
          </form>

          {/* Wipe email-guessed: archive every lead with the email-guessed tag */}
          <form
            action={wipeGuessedLeadsAction}
            className="flex flex-wrap items-start gap-3 rounded-md border border-warning/50 bg-warning/10 p-4"
          >
            <div className="flex-1 min-w-[260px]">
              <p className="font-medium text-foreground">
                Wipe email-guessed leads
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Archives every lead tagged <span className="font-mono">email-guessed</span>{" "}
                — the role-targeted addresses (<span className="font-mono">procurement@</span>,{" "}
                <span className="font-mono">dispatch@</span>,{" "}
                <span className="font-mono">orders@</span>) that the old Quick-add
                inserted without scraping the actual website. Use this once before
                re-running the new verified Quick-add so the CRM only ever holds
                real, deliverable addresses. Reversible via SQL.
              </p>
            </div>
            <Button type="submit" size="sm" variant="destructive">
              <X /> Archive all email-guessed
            </Button>
          </form>

          {/* Denver Batch 1 — pre-curated 76-candidate Front Range pool */}
          <form
            action={importDenverBatch1Action}
            className="flex flex-col gap-3 rounded-md border border-success/40 bg-success/5 p-4"
          >
            <div>
              <p className="font-medium text-foreground">
                Denver Batch 1 — import + auto-enroll 50 Front Range leads
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pre-curated pool of ~76 Front Range businesses across
                restaurants, big-box / grocery, freight brokers + 3PLs,
                and construction supply. MX-validates each domain at
                click time, generates vertical-aware role-account
                emails (<span className="font-mono">orders@</span>,{" "}
                <span className="font-mono">procurement@</span>,{" "}
                <span className="font-mono">dispatch@</span>), and
                inserts up to 50 verified leads into <code>/leads</code>{" "}
                tagged <span className="font-mono">denver-batch-1</span>.
                Each lead is auto-enrolled into the default active
                sequence with a 0-30min send jitter so all 50 don&apos;t
                fire in the same tick.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Idempotent: dupes by email are detected and skipped.
                Audit-logged. CSV download below.
              </p>

              {sp.batch1 === "1" && sp.b1_error ? (
                <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
                  {decodeURIComponent(sp.b1_error)}
                </p>
              ) : sp.batch1 === "1" ? (
                <div className="mt-3 space-y-1 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-foreground">
                  <p>
                    Validated{" "}
                    <span className="font-mono tabular-nums">
                      {Number(sp.b1_validated ?? 0)}
                    </span>{" "}
                    · inserted{" "}
                    <span className="font-mono tabular-nums">
                      {Number(sp.b1_inserted ?? 0)}
                    </span>{" "}
                    · dupes{" "}
                    <span className="font-mono tabular-nums">
                      {Number(sp.b1_dup ?? 0)}
                    </span>{" "}
                    · invalid{" "}
                    <span className="font-mono tabular-nums">
                      {Number(sp.b1_invalid ?? 0)}
                    </span>
                  </p>
                  <p>
                    Enrolled{" "}
                    <span className="font-mono tabular-nums">
                      {Number(sp.b1_enrolled ?? 0)}
                    </span>{" "}
                    · already enrolled{" "}
                    <span className="font-mono tabular-nums">
                      {Number(sp.b1_already ?? 0)}
                    </span>
                    {sp.b1_sequence
                      ? ` into "${decodeURIComponent(sp.b1_sequence)}"`
                      : ""}{" "}
                    · {Number(sp.b1_dur ?? 0)}ms
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm">
                <Zap /> Import + auto-enroll batch 1
              </Button>
              <a
                href="/api/export/denver-batch-1"
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/40"
                download
              >
                <ArrowDownToLine className="size-3" /> Download CSV
              </a>
              <Link
                href="/leads?tags=denver-batch-1"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View batch in /leads →
              </Link>
            </div>
          </form>

          {/* Unified lead generator (replaces Free/Paid/Quick-add buttons below) */}
          <form
            action={generateLeadsAction}
            className="flex flex-col gap-4 rounded-md border border-primary/40 bg-primary/5 p-4"
          >
            <div>
              <p className="font-medium text-foreground">
                Generate leads — OSM discovery + website scrape + MX validation
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Single coherent pipeline. Discovers businesses via OSM
                Overpass (with curated-list fallback), scrapes each candidate
                site for real <span className="font-mono">mailto:</span> +
                visible emails, MX-validates the address, and inserts ONLY
                companies whose websites yield a deliverable address —{" "}
                <strong className="text-foreground">
                  no guessing, ever.
                </strong>{" "}
                Companies without a public email are <em>skipped</em>, not
                inserted. Already-in-CRM domains are skipped automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-foreground">
                  Industries (comma-separated)
                </span>
                <input
                  name="industries"
                  defaultValue="restaurants,bigbox,brokers,smallbiz,construction,cannabis"
                  className="h-9 rounded-md border border-input bg-background px-2 font-mono text-xs text-foreground"
                  placeholder="restaurants,bigbox,brokers,smallbiz,construction,cannabis"
                />
                <span className="text-[11px] text-muted-foreground">
                  Allowed: restaurants, bigbox, brokers, smallbiz,
                  construction, cannabis
                </span>
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-foreground">
                  Counties (comma-separated)
                </span>
                <input
                  name="counties"
                  defaultValue="Arapahoe,Denver,Jefferson"
                  className="h-9 rounded-md border border-input bg-background px-2 font-mono text-xs text-foreground"
                  placeholder="Adams,Arapahoe,Boulder,Broomfield,Denver,Douglas,Jefferson"
                />
                <span className="text-[11px] text-muted-foreground">
                  Allowed: Adams, Arapahoe, Boulder, Broomfield, Denver,
                  Douglas, Jefferson
                </span>
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-foreground">
                  Discovery source
                </span>
                <select
                  name="source"
                  defaultValue="osm+curated"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                >
                  <option value="osm+curated">
                    OSM with curated fallback (recommended)
                  </option>
                  <option value="osm">OSM only (skip if Overpass fails)</option>
                  <option value="curated">Curated list only (fast)</option>
                </select>
                <span className="text-[11px] text-muted-foreground">
                  OSM is unreliable from Vercel; fallback ensures progress.
                </span>
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-foreground">
                  Limit (max candidates to verify)
                </span>
                <input
                  type="number"
                  name="limit"
                  defaultValue={8}
                  min={1}
                  max={20}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                />
                <span className="text-[11px] text-muted-foreground">
                  1-20. Each verified candidate runs ~1.5s of scrape + MX.
                </span>
              </label>
            </div>

            <Button type="submit" size="sm" className="self-start">
              <Plus /> Generate leads
            </Button>
          </form>

        </CardContent>
      </Card>

      {/* Suppression list management */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Suppression list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add form */}
          <form action={addSuppressionAction} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1 min-w-[220px]">
              <Label htmlFor="supp-email" className="text-xs">Email</Label>
              <Input id="supp-email" name="email" type="email" placeholder="contact@example.com" required />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="supp-reason" className="text-xs">Reason</Label>
              <select
                id="supp-reason"
                name="reason"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="manual"
              >
                <option value="manual">Manual</option>
                <option value="unsubscribed">Unsubscribed</option>
                <option value="bounced">Bounced</option>
                <option value="replied">Replied</option>
                <option value="invalid">Invalid</option>
              </select>
            </div>
            <Button type="submit" size="sm" variant="secondary">
              <Plus className="size-4" /> Add
            </Button>
          </form>

          {/* Existing entries */}
          {suppressionRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suppressed addresses.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Reason</th>
                  <th className="pb-2 pr-4 font-medium">Added</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {suppressionRows.map((row) => (
                  <tr key={row.email}>
                    <td className="py-2 pr-4 font-mono text-xs">{row.email}</td>
                    <td className="py-2 pr-4 capitalize text-muted-foreground">{row.reason}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                      {new Date(row.createdAt).toISOString().slice(0, 10)}
                    </td>
                    <td className="py-2">
                      <form action={removeSuppressionAction}>
                        <input type="hidden" name="email" value={row.email} />
                        <Button type="submit" size="sm" variant="ghost" className="h-6 px-2 text-destructive hover:text-destructive">
                          <X className="size-3" />
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent audit log</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {recentAudit.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No audit entries yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-b border-border bg-card text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">Entity</th>
                  <th className="px-3 py-2.5 font-medium">Action</th>
                  <th className="px-6 py-2.5 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentAudit.map((a) => (
                  <tr key={a.id}>
                    <td className="px-6 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {new Date(a.occurredAt).toISOString().slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="px-3 py-2.5 text-foreground">{a.entity}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-foreground">
                      {a.action}
                    </td>
                    <td className="px-6 py-2.5 truncate font-mono text-xs text-muted-foreground">
                      {a.afterJson
                        ? JSON.stringify(a.afterJson).slice(0, 80)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function Stat({
  label,
  value,
  accent = false,
  muted = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={
          accent
            ? "font-mono text-base font-semibold tabular-nums text-primary"
            : muted
              ? "font-mono text-base font-semibold tabular-nums text-muted-foreground"
              : "font-mono text-base font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-1.5 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          warn
            ? "font-mono tabular-nums text-warning"
            : "font-mono tabular-nums text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}
