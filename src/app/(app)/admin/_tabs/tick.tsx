import { Play, Inbox, FolderSync } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  manualPollAction,
  manualSyncAction,
  manualTickAction,
} from "../actions";
import { Stat } from "./_shared";
import type { AdminSearch } from "./types";

/**
 * Engine controls — the three cron-equivalent triggers an operator
 * fires manually for local testing or to force a cycle in production:
 *
 *   • Run tick now   → cold-pitch send pipeline (every 15min in prod)
 *   • Run poll now   → Gmail reply/bounce sweep (every 5min in prod)
 *   • Run sync now   → Drive workbook reconciliation (hourly in prod)
 *
 * Each result panel reads its dedicated subset of search params so
 * stats from the last action remain visible until the operator
 * navigates away.
 */
export function TickTab({ sp }: { sp: AdminSearch }) {
  const ranTick = sp.due !== undefined;
  const ranPoll = sp.poll === "1";
  const ranSync = sp.sync === "1";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Manual tick */}
      <Card>
        <CardHeader>
          <CardTitle>Sequence engine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cron runs every 15 minutes in production via{" "}
            <span className="font-mono">/api/cron/tick-sequences</span>. You
            can run it manually here for local testing.
          </p>
          <form
            action={manualTickAction}
            className="flex flex-wrap items-center gap-2"
          >
            <Button type="submit">
              <Play /> Run tick now
            </Button>
            <InfoTooltip label="What does Run tick do?">
              <p className="font-medium text-foreground">Run tick now</p>
              <p className="mt-1 text-muted-foreground">
                Fires the cold-pitch send pipeline. Scans every active
                enrollment whose <span className="font-mono">nextSendAt</span>{" "}
                is due, picks the right template step, personalizes it
                with the lead&apos;s fields, then injects:
              </p>
              <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-muted-foreground">
                <li>compliance footer + unsubscribe link</li>
                <li>open-tracking pixel</li>
                <li>click-tracking on every link</li>
              </ul>
              <p className="mt-2 text-muted-foreground">
                On a successful auto-send: lead stage advances{" "}
                <span className="font-mono">new → contacted</span>,{" "}
                <span className="font-mono">lastContactedAt</span> is
                stamped, and the enrollment moves to the next step.
                Templates set to <span className="font-mono">draft</span>{" "}
                mode stage a Gmail draft instead of sending.
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
            Detects replies and bounces on every active enrollment&apos;s
            Gmail thread, idempotently.
          </p>
          <form
            action={manualPollAction}
            className="flex flex-wrap items-center gap-2"
          >
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

      {/* Manual Drive sync — full-width on its own row */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Drive sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cron runs hourly via{" "}
            <span className="font-mono">/api/cron/sync-drive</span>. Pull-only
            for v1: new sheet rows are inserted, existing matches are
            confirmed, and DB rows missing from the sheet are flagged as
            orphans (never deleted).
          </p>
          <form
            action={manualSyncAction}
            className="flex flex-wrap items-center gap-2"
          >
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
                  DB rows missing from the sheet → flagged as orphans (visible
                  in Health, never auto-deleted).
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
    </div>
  );
}
