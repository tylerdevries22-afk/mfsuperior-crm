import { desc, eq, sql } from "drizzle-orm";
import { AlertTriangle, Wrench } from "lucide-react";
import { db } from "@/lib/db/client";
import { auditLog, leads, suppressionList, users } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { userHasGoogleConnection } from "@/lib/gmail/oauth";
import { applyPendingMigrationsAction } from "../actions";
import { Row } from "./_shared";
import type { AdminSearch } from "./types";

/**
 * Health snapshot + audit log. Pulls its own data inline so the tab
 * only pays for these queries when an operator is actually looking at
 * the Health tab (instead of every /admin page hit).
 *
 * Connected-Google count walks every user row and probes the OAuth
 * connection cache. That's O(users) round-trips but the user count is
 * tiny (<10), so we accept it rather than introducing a join here.
 */
export async function HealthTab({ sp }: { sp: AdminSearch }) {
  const [
    [{ userCount }],
    suppressionRows,
    [{ orphanCount }],
    recentAudit,
    userRows,
  ] = await Promise.all([
    db.select({ userCount: sql<number>`count(*)::int` }).from(users),
    db.select({ email: suppressionList.email }).from(suppressionList),
    db
      .select({ orphanCount: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.driveSyncOrphan, true)),
    db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.occurredAt))
      .limit(20),
    db.select({ id: users.id }).from(users),
  ]);
  let connectedCount = 0;
  for (const u of userRows) {
    if (await userHasGoogleConnection(u.id)) connectedCount++;
  }

  return (
    <div className="space-y-6">
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
            <Row
              label="Suppressed addresses"
              value={String(suppressionRows.length)}
            />
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
                <span className="font-mono">Continue with Google</span> button
                (not the dev panel) so the tick engine can call the Gmail
                API.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending-migrations applier — operator-triggered. Runs the
          IF NOT EXISTS ALTER TABLE statements in actions.ts'
          PENDING_DDL list. Exists so a column-add PR (e.g. PR #46
          adding email_trust) doesn't require shell access to
          unstick the production app. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="size-4 text-primary" /> Pending schema
            migrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            If the deployed code added new columns that haven&apos;t
            been pushed to the production database yet, click below to
            apply them. The DDL is idempotent (
            <span className="font-mono">ADD COLUMN IF NOT EXISTS</span>
            ), so re-clicking after the columns land is a no-op.
          </p>
          <p className="text-xs text-muted-foreground">
            Currently pending:{" "}
            <span className="font-mono">leads.email_trust</span>,{" "}
            <span className="font-mono">leads.email_validated_at</span>{" "}
            (introduced by the email-trust pipeline in PR #46). Without
            this, <span className="font-mono">/leads</span> throws on
            every load because the SELECT references columns that
            don&apos;t exist in the DB.
          </p>
          <form action={applyPendingMigrationsAction}>
            <Button type="submit" size="sm">
              <Wrench /> Apply pending migrations
            </Button>
          </form>
          {sp.migrated === "1" && sp.migrate_error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
              {decodeURIComponent(sp.migrate_error)}
            </p>
          ) : sp.migrated === "1" ? (
            <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-foreground">
              Applied:{" "}
              <span className="font-mono">
                {sp.m_applied === "0" || !sp.m_applied
                  ? "(nothing — DB already up to date)"
                  : decodeURIComponent(sp.m_applied)}
              </span>
              .{" "}
              <a href="/leads" className="underline">
                Open /leads to confirm.
              </a>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
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
                        {new Date(a.occurredAt)
                          .toISOString()
                          .slice(0, 19)
                          .replace("T", " ")}
                      </td>
                      <td className="px-3 py-2.5 text-foreground">
                        {a.entity}
                      </td>
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
