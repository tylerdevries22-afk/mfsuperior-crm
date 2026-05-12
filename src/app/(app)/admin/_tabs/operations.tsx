import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fixBusinessNameAction,
  purgeNoEmailLeadsAction,
  revalidateAllLeadEmailsAction,
  unarchiveAllLeadsAction,
  validateAllEmailsAction,
  wipeGuessedLeadsAction,
} from "../actions";
import type { AdminSearch } from "./types";

/**
 * Bulk operations on the leads table. Every form here either
 * archives, restores, or hard-deletes rows — destructive enough that
 * each form has its own colored border (success / warning /
 * destructive) so the operator can't accidentally fire one when they
 * meant another.
 *
 * Result panels are inline next to each form so it stays obvious
 * which action just ran (toasts would lose that locality).
 */
export function OperationsTab({ sp }: { sp: AdminSearch }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk lead operations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unarchive: reverse every archive (full table or last N) */}
        <form
          action={unarchiveAllLeadsAction}
          className="flex flex-wrap items-start gap-3 rounded-md border border-success/40 bg-success/10 p-4"
        >
          <div className="flex-1 min-w-[260px]">
            <p className="font-medium text-foreground">Unarchive leads</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Reverses any archive — sets{" "}
              <span className="font-mono">archivedAt = NULL</span> for the
              matched rows so they reappear on{" "}
              <span className="font-mono">/leads</span>. Default scope is{" "}
              <strong className="text-foreground">all</strong> archived
              rows; pick a tighter window if you only want to recover a
              recent batch.
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
              Archives every lead where{" "}
              <span className="font-mono">email IS NULL</span> (sets{" "}
              <span className="font-mono">archivedAt = now()</span>) so they
              disappear from <span className="font-mono">/leads</span>{" "}
              immediately.{" "}
              <strong className="text-foreground">Reversible:</strong> the
              rows aren&apos;t deleted — clearing{" "}
              <span className="font-mono">archivedAt</span> in SQL brings
              them back. Use this to wipe the legacy spreadsheet seed
              before populating with high-quality emailed leads via the
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
                UPDATE settings SET business_name = &apos;MF Superior
                Products&apos; WHERE business_name = &apos;MF Superior
                Solutions&apos;
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
                {Number(sp.bizfix_updated ?? 0) === 1 ? "" : "s"}. Outbound
                emails will now sign as &quot;MF Superior Products&quot;.
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
              captured in the audit log&apos;s{" "}
              <span className="font-mono">beforeJson</span> so a false
              positive can be SQL-restored. Also runs Mondays at 09:00 UTC
              via cron + as a per-send safety net inside the tick engine.
            </p>
            {sp.validated === "1" && sp.validate_error ? (
              <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
                {decodeURIComponent(sp.validate_error)}
              </p>
            ) : sp.validated === "1" ? (
              <p className="mt-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-foreground">
                Last run: checked{" "}
                <span className="font-mono tabular-nums">
                  {Number(sp.v_checked ?? 0)}
                </span>
                , valid{" "}
                <span className="font-mono tabular-nums">
                  {Number(sp.v_valid ?? 0)}
                </span>
                , invalid{" "}
                <span className="font-mono tabular-nums">
                  {Number(sp.v_invalid ?? 0)}
                </span>
                , deleted{" "}
                <span className="font-mono tabular-nums">
                  {Number(sp.v_deleted ?? 0)}
                </span>{" "}
                in{" "}
                <span className="font-mono tabular-nums">
                  {Number(sp.v_dur ?? 0)}
                </span>
                ms.
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
              Archives every lead tagged{" "}
              <span className="font-mono">email-guessed</span> — the
              role-targeted addresses (
              <span className="font-mono">procurement@</span>,{" "}
              <span className="font-mono">dispatch@</span>,{" "}
              <span className="font-mono">orders@</span>) that the old
              Quick-add inserted without scraping the actual website. Use
              this once before re-running the new verified Quick-add so the
              CRM only ever holds real, deliverable addresses. Reversible
              via SQL.
            </p>
          </div>
          <Button type="submit" size="sm" variant="destructive">
            <X /> Archive all email-guessed
          </Button>
        </form>

        {/* Re-validate trust pipeline: runs the 10-approach
            email-trust classifier over every non-archived lead.
            See src/lib/leads/email-trust.ts for the full research
            doc. Archives (NOT deletes) any lead whose email fails
            validation, so a false positive is reversible. */}
        <form
          action={revalidateAllLeadEmailsAction}
          className="flex flex-wrap items-start gap-3 rounded-md border border-primary/40 bg-primary/5 p-4"
        >
          <div className="flex-1 min-w-[260px]">
            <p className="font-medium text-foreground">
              Re-validate email trust (all leads)
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Runs the deep email-trust pipeline on every non-archived
              lead: syntax → MX → disposable/freemail blocklist →
              tag-prior fast-path → website re-scrape (verbatim match →{" "}
              <span className="font-mono">verified</span>) → Hunter
              email-verifier (within free-tier budget) → strong-signal
              promotion (MX + reachable website →{" "}
              <span className="font-mono">verified</span>). Writes the
              verdict into <span className="font-mono">email_trust</span>{" "}
              and merges tags ({" "}
              <span className="font-mono">role-account</span>,{" "}
              <span className="font-mono">email-website-confirmed</span>,{" "}
              <span className="font-mono">email-api-verified</span>,{" "}
              <span className="font-mono">email-risky</span>). Invalids
              are archived (reversible).
            </p>
            {sp.trust_revalidated === "1" && sp.trust_error ? (
              <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
                {decodeURIComponent(sp.trust_error)}
              </p>
            ) : sp.trust_revalidated === "1" ? (
              <p className="mt-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-foreground">
                Checked{" "}
                <span className="font-mono tabular-nums">
                  {Number(sp.t_checked ?? 0)}
                </span>{" "}
                · verified{" "}
                <span className="font-mono tabular-nums text-primary">
                  {Number(sp.t_verified ?? 0)}
                </span>{" "}
                · guessed{" "}
                <span className="font-mono tabular-nums text-warning">
                  {Number(sp.t_guessed ?? 0)}
                </span>{" "}
                · unverified{" "}
                <span className="font-mono tabular-nums text-muted-foreground">
                  {Number(sp.t_unverified ?? 0)}
                </span>{" "}
                · invalid{" "}
                <span className="font-mono tabular-nums text-destructive">
                  {Number(sp.t_invalid ?? 0)}
                </span>{" "}
                · archived{" "}
                <span className="font-mono tabular-nums">
                  {Number(sp.t_archived ?? 0)}
                </span>{" "}
                {Number(sp.t_hunter ?? 0) > 0 ? (
                  <>
                    · Hunter calls{" "}
                    <span className="font-mono tabular-nums">
                      {Number(sp.t_hunter ?? 0)}
                    </span>{" "}
                  </>
                ) : null}
                in{" "}
                <span className="font-mono tabular-nums">
                  {Number(sp.t_dur ?? 0)}
                </span>
                ms
                {sp.t_partial === "1" ? (
                  <>
                    {" "}
                    <span className="text-warning">
                      (partial — deadline reached; re-click to continue)
                    </span>
                  </>
                ) : (
                  "."
                )}
              </p>
            ) : null}
          </div>
          <Button type="submit" size="sm">
            Re-validate all
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
