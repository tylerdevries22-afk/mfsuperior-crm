import { desc, eq, sql } from "drizzle-orm";
import { Play, AlertTriangle, Inbox, FolderSync, X, Plus, Search as SearchIcon } from "lucide-react";
import { db } from "@/lib/db/client";
import { auditLog, leads, suppressionList, users } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  addSuppressionAction,
  manualPollAction,
  manualSyncAction,
  manualTickAction,
  quickAddStarterPackAction,
  removeSuppressionAction,
  runFreeResearchAction,
  runPaidResearchAction,
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
              Detects replies and bounces on every active enrollment's Gmail
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

          {/* Quick-add (no script, no API, just direct DB inserts) */}
          <form
            action={quickAddStarterPackAction}
            className="flex flex-wrap items-start gap-3 rounded-md border border-primary/40 bg-primary/5 p-4"
          >
            <div className="flex-1 min-w-[260px]">
              <p className="font-medium text-foreground">
                Quick-add: Denver Metro starter pack
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bypasses the discovery pipeline entirely. Inserts 25 confirmed
                Denver Metro businesses (Cracker Barrel, Snooze, King Soopers,
                Home Depot, C.H. Robinson, etc.) directly into{" "}
                <span className="font-mono">leads</span> with{" "}
                <span className="font-mono">info@&lt;domain&gt;.com</span>{" "}
                emails, tier, and tags pre-baked. Redirects you to{" "}
                <span className="font-mono">/leads</span> right after so you
                see the result immediately. Safe to re-click — duplicates are
                no-ops.
              </p>
            </div>
            <Button type="submit" size="sm">
              <Plus /> Add 25 starter leads now
            </Button>
          </form>

          {/* Result banner */}
          {sp.research === "1" && <ResearchResultBanner sp={sp} />}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Free mode */}
            <form action={runFreeResearchAction} className="space-y-3 rounded-md border border-border bg-secondary/20 p-4">
              <div className="flex items-center gap-2">
                <SearchIcon className="size-4 text-foreground" />
                <span className="font-medium text-foreground">Free mode</span>
                <span className="text-xs text-muted-foreground">OSM + scrape + MX</span>
              </div>
              <p className="text-xs text-muted-foreground">
                No API keys. Best for restaurants, retail, and small biz.
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="free-limit" className="text-xs">Leads per run</Label>
                <Input
                  id="free-limit"
                  name="limit"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={5}
                  className="w-24"
                />
              </div>
              <Button type="submit" size="sm">
                <SearchIcon /> Run free research
              </Button>
            </form>

            {/* Paid mode */}
            <form action={runPaidResearchAction} className="space-y-3 rounded-md border border-border bg-secondary/20 p-4">
              <div className="flex items-center gap-2">
                <SearchIcon className="size-4 text-foreground" />
                <span className="font-medium text-foreground">Paid mode</span>
                <span className="text-xs text-muted-foreground">Places + Hunter</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Higher signal-to-noise. Requires{" "}
                <span className="font-mono">GOOGLE_MAPS_API_KEY</span> and{" "}
                <span className="font-mono">HUNTER_API_KEY</span> env vars.
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="paid-limit" className="text-xs">Leads per run</Label>
                <Input
                  id="paid-limit"
                  name="limit"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={5}
                  className="w-24"
                />
              </div>
              <Button type="submit" size="sm" variant="secondary">
                <SearchIcon /> Run paid research
              </Button>
            </form>
          </div>
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

function ResearchResultBanner({ sp }: { sp: Search }) {
  if (sp.research_error === "missing_api_keys") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="text-foreground">
          Paid mode requires both{" "}
          <span className="font-mono">GOOGLE_MAPS_API_KEY</span> and{" "}
          <span className="font-mono">HUNTER_API_KEY</span>. Add them in
          Vercel → Settings → Environment Variables, redeploy, then try
          again. (Or use Free mode, which needs no keys.)
        </p>
      </div>
    );
  }
  const discovered = Number(sp.r_discovered ?? 0);
  const enriched = Number(sp.r_enriched ?? 0);
  const a = Number(sp.r_a ?? 0);
  const b = Number(sp.r_b ?? 0);
  const c = Number(sp.r_c ?? 0);
  const inserted = Number(sp.r_inserted ?? 0);
  const updated = Number(sp.r_updated ?? 0);
  const noEmail = Number(sp.r_no_email ?? 0);
  const dur = Number(sp.r_dur ?? 0);

  // Loud failure mode when discovery returns 0. Most likely cause is
  // outbound Overpass blocked from Vercel's IPs, or the function timed
  // out before a single county query completed.
  if (discovered === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="space-y-1 text-foreground">
            <p className="font-medium">Discovery returned 0 candidates ({sp.research_mode}).</p>
            {sp.research_mode === "free" ? (
              <p className="text-muted-foreground">
                The OSM Overpass servers may be blocking Vercel&apos;s outbound IPs, or the
                function hit its 10s/60s timeout before a single county query finished.
                Try paid mode (set{" "}
                <span className="font-mono">GOOGLE_MAPS_API_KEY</span>) or run from your
                machine: <span className="font-mono">npm run leads:research</span>.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Google Places returned no results. Double-check{" "}
                <span className="font-mono">GOOGLE_MAPS_API_KEY</span> is valid in Vercel
                env, and that the Places API (New) is enabled on the GCP project.
              </p>
            )}
            <p className="font-mono text-[11px] text-muted-foreground">
              {dur}ms · mode={sp.research_mode ?? "—"}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-secondary/30 px-4 py-3 sm:grid-cols-3">
      <Stat label={`${sp.research_mode ?? ""} discovered`} value={discovered} />
      <Stat label="Enriched" value={enriched} accent />
      <Stat label="Tier A" value={a} accent />
      <Stat label="Tier B" value={b} muted />
      <Stat label="Tier C" value={c} muted />
      <Stat label="Refrigerated" value={Number(sp.r_refrig ?? 0)} muted />
      <Stat label="Inserted" value={inserted} accent />
      <Stat label="Updated" value={updated} muted />
      <Stat label="No-email" value={noEmail} muted />
      <p className="col-span-full mt-1 font-mono text-xs tabular-nums text-muted-foreground">
        {dur}ms · mode={sp.research_mode ?? "—"}
      </p>
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
