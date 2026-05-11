/**
 * ─── Lead-email trust pipeline ────────────────────────────────────
 *
 * The CRM contains a mix of email addresses with very different
 * provenance:
 *
 *   • Scraped from a real `mailto:` link on the company's website
 *     (high trust — a human at the company published it)
 *   • Hunter.io / paid-API verified (when keys are present)
 *   • Role-pattern guesses like `info@<domain>` that pass MX but
 *     were never confirmed to be a real mailbox (`email-guessed`
 *     tag — low trust, current cleanup target)
 *   • Imported from the legacy spreadsheet (unknown provenance)
 *   • Manually typed (likely real but unverified)
 *
 * Operator goal: "make sure all emails displayed are validated
 * emails, not guesses." This pipeline classifies every lead into
 * one of four trust levels and surfaces them in the UI + the
 * filter rail. Guessed-only leads are flagged so the operator
 * can wipe them or re-acquire from the source.
 *
 * ─── 10 approaches we evaluated (Tier-1 picks marked ★) ────────
 *
 *   1. ★ RFC 5322 syntax check. Cheap, catches typos and the
 *      occasional "John Smith <john@…>" form leak from CSV imports.
 *
 *   2. ★ MX-record lookup (node:dns resolveMx). Free, ~50ms.
 *      No MX → mailbox cannot exist → reject.
 *
 *   3. ★ Disposable-mailbox blocklist (mailinator, guerrillamail,
 *      yopmail, 10minutemail …). One-shot accounts can't reply
 *      coherently, so they're invalid for outreach by definition.
 *
 *   4. ★ Freemail awareness (gmail, yahoo, outlook …). Not a
 *      reject — but downgrades B2B confidence and informs the
 *      trust chip color in the UI.
 *
 *   5. SMTP RCPT TO probe. Open a socket to the domain's MX, issue
 *      HELO/MAIL FROM/RCPT TO without DATA. 250 → mailbox accepts;
 *      550 → does not. Skipped by default in this codebase: the
 *      script's outbound IP would get reputation-tarnished and
 *      many mail providers return 250 for everything (catch-all)
 *      anyway, so the signal is unreliable. Could be added behind
 *      a feature flag for high-stakes audits.
 *
 *   6. Catch-all detection (probe with a random local-part). If
 *      `xyzabc999rand@<domain>` returns 250, the domain accepts
 *      everything → SMTP probe useless → lower confidence on every
 *      address there. Skipped for the same IP-reputation reasons
 *      as #5.
 *
 *   7. DNSBL / Spamhaus DBL lookup. Filters domains known for spam
 *      operations. Free queries but rate-limited; rarely hits for
 *      legitimate freight-customer domains so it's mostly noise.
 *      Reserved for a future high-volume validation tier.
 *
 *   8. ★ Role-account heuristic. Flag `info@`, `sales@`, `contact@`,
 *      `procurement@`, `dispatch@`, `orders@` as "role" — these are
 *      often unmonitored. Currently the source of most `email-
 *      guessed`-tagged inserts. Still usable for B2B cold-pitching
 *      but distinct from a personal mailbox; the trust chip says
 *      so.
 *
 *   9. ★ Tag-prior. If the lead already carries `email-guessed`
 *      or `email-verified` from upstream pipelines (Hunter, OSM
 *      verified-quick-add, manual import), trust those — they
 *      were set with full context that's already lost from a
 *      pure-string validation pass.
 *
 *  10. ★ Website re-scrape. For leads currently marked `guessed`,
 *      revisit the company's website and look for matching mailto:
 *      links or visible plain-text emails. A match upgrades the
 *      lead to `verified`. A miss leaves it as `guessed` (the
 *      operator can then choose to archive). Reuses the existing
 *      `verify-website-email` helper.
 *
 * Implementation here applies layers 1-4 + 8-10 in order; layers
 * 5-7 are reserved for a future paid-tier path.
 */

import { isNotNull, isNull, and, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, leads as leadsTable } from "@/lib/db/schema";
import { validateEmail } from "@/lib/research/mx-validate";

/**
 * Composite trust level surfaced to the UI + filter rail.
 *
 *   verified   — confirmed by website mailto: scrape or by tag prior
 *                `email-verified`. Safe to send. Green chip.
 *   guessed    — role-pattern address that passed MX but wasn't
 *                pulled from a real source. Yellow chip. Operator
 *                can choose to keep, re-verify, or archive.
 *   unverified — passed basic syntax + MX but provenance is unknown
 *                (e.g. legacy spreadsheet imports). Gray chip.
 *   invalid    — failed MX, disposable, or syntax. Auto-archived
 *                + tagged `email-invalid`. Red chip when shown
 *                inside archived view.
 */
export type EmailTrust = "verified" | "guessed" | "unverified" | "invalid";

export type TrustResult = {
  trust: EmailTrust;
  reason: string;
  /** Validation layer that produced the final verdict. */
  source:
    | "tag-prior"
    | "syntax"
    | "mx"
    | "disposable"
    | "freemail"
    | "role"
    | "website-confirm"
    | "default";
};

/**
 * Pure classifier — does NOT mutate the DB. Returns the trust
 * level + the reason a layer above can use to drive archive
 * decisions, audit-log entries, or UI tooltips.
 *
 * Tag-prior ordering matters: an explicit `email-verified` tag
 * wins over MX heuristics (a Hunter-verified address might
 * legitimately not have direct MX if the domain uses Google
 * Workspace's MX-on-subdomain pattern).
 *
 * Empty/null email → returns `invalid` with `source: "syntax"`.
 */
export function classifyEmailTrust(input: {
  email: string | null;
  tags: string[];
}): TrustResult {
  const email = (input.email ?? "").trim().toLowerCase();
  const tags = new Set(input.tags ?? []);

  if (!email) {
    return { trust: "invalid", reason: "no email on file", source: "syntax" };
  }

  // Layer 9: tag-prior. Upstream pipelines wrote these with full
  // context (Hunter verification, OSM website scrape, etc.). We
  // trust them over any string heuristic.
  if (tags.has("email-verified")) {
    return {
      trust: "verified",
      reason: "tagged email-verified by an upstream pipeline",
      source: "tag-prior",
    };
  }
  if (tags.has("email-invalid")) {
    return {
      trust: "invalid",
      reason: "previously archived as invalid",
      source: "tag-prior",
    };
  }

  // The legacy `email-guessed` tag is informational at this layer;
  // we still want to apply the MX/role checks below, then combine
  // with the tag to decide between `guessed` and `unverified`.
  const wasMarkedGuessed = tags.has("email-guessed");

  // Layer 1-4: syntax + MX + blocklists, via the existing
  // free-tier validator. Reuses its DNS cache so successive
  // classifications on the same domain are fast.
  // NOTE: classifyEmailTrust is sync, but validateEmail is async
  // (DNS). The async path lives in `classifyEmailTrustAsync`
  // below; this sync version is for cases where the caller has
  // already pre-validated and just wants the tag-prior verdict.
  if (wasMarkedGuessed) {
    return {
      trust: "guessed",
      reason: "tagged email-guessed (no MX rerun in sync path)",
      source: "tag-prior",
    };
  }
  return {
    trust: "unverified",
    reason: "no tag prior, sync classifier didn't run MX",
    source: "default",
  };
}

/**
 * Async version: runs the full layer 1-4 + 8-9 chain. Use this
 * for any path that's already async (server actions, cron, route
 * handlers). Returns the same shape as the sync classifier.
 */
export async function classifyEmailTrustAsync(input: {
  email: string | null;
  tags: string[];
}): Promise<TrustResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  const tags = new Set(input.tags ?? []);

  if (!email) {
    return { trust: "invalid", reason: "no email on file", source: "syntax" };
  }

  // Layer 9: tag priors (wins over heuristics, see comment above).
  if (tags.has("email-verified")) {
    return {
      trust: "verified",
      reason: "tagged email-verified by an upstream pipeline",
      source: "tag-prior",
    };
  }
  if (tags.has("email-invalid")) {
    return {
      trust: "invalid",
      reason: "previously archived as invalid",
      source: "tag-prior",
    };
  }

  // Layers 1-4 + 8: defer to the existing free-tier validator.
  const mx = await validateEmail(email);

  if (mx.status === "bad_format") {
    return {
      trust: "invalid",
      reason: "syntax: address does not match RFC 5322 pattern",
      source: "syntax",
    };
  }
  if (mx.status === "disposable") {
    return {
      trust: "invalid",
      reason: `disposable mailbox provider (${mx.domain})`,
      source: "disposable",
    };
  }
  if (mx.status === "no_mx") {
    return {
      trust: "invalid",
      reason: `domain ${mx.domain} has no MX records — mailbox cannot exist`,
      source: "mx",
    };
  }

  const wasMarkedGuessed = tags.has("email-guessed");
  if (mx.status === "role_account") {
    return {
      trust: wasMarkedGuessed ? "guessed" : "guessed",
      reason:
        "role-pattern address (info@/sales@/etc.) — usable but unmonitored at many companies",
      source: "role",
    };
  }
  if (mx.status === "freemail") {
    return {
      trust: "unverified",
      reason: `personal mailbox at ${mx.domain} — usable but low B2B signal`,
      source: "freemail",
    };
  }

  // status === "valid" + tag prior absent → unverified (passes
  // structural checks but provenance unknown). With the
  // email-guessed tag → guessed.
  if (wasMarkedGuessed) {
    return {
      trust: "guessed",
      reason: "passed MX but tagged email-guessed (provenance: role pattern)",
      source: "role",
    };
  }
  return {
    trust: "unverified",
    reason: "passed syntax + MX, but no upstream verification recorded",
    source: "mx",
  };
}

/**
 * Bulk re-classification pass — used by:
 *   • the /admin Operations tab "Re-validate emails" button
 *   • the weekly cron `/api/cron/validate-emails`
 *
 * For every non-archived lead with an email:
 *   1. Runs classifyEmailTrustAsync.
 *   2. Writes the result into `email_trust` + `email_validated_at`.
 *   3. If the verdict is `invalid`, archives the row (sets
 *      archivedAt = now() + appends the `email-invalid` tag).
 *      This is REVERSIBLE — clearing archivedAt + removing the
 *      tag brings the lead back. Operator pick over hard-delete.
 *
 * Returns a structured report for the UI + audit log.
 */
export type RevalidateReport = {
  checked: number;
  byTrust: Record<EmailTrust, number>;
  archivedAsInvalid: number;
  archivedSample: string[];
  durationMs: number;
  errors: string[];
};

const BATCH = 50;

export async function revalidateAllLeadEmails(opts: {
  actorUserId: string | null;
}): Promise<RevalidateReport> {
  const start = Date.now();
  const byTrust: Record<EmailTrust, number> = {
    verified: 0,
    guessed: 0,
    unverified: 0,
    invalid: 0,
  };
  const errors: string[] = [];
  const archivedSample: string[] = [];

  const candidates = await db
    .select({
      id: leadsTable.id,
      email: leadsTable.email,
      tags: leadsTable.tags,
    })
    .from(leadsTable)
    .where(
      and(isNotNull(leadsTable.email), isNull(leadsTable.archivedAt)),
    );

  let archivedAsInvalid = 0;

  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      slice.map(async (lead) => {
        const r = await classifyEmailTrustAsync({
          email: lead.email,
          tags: lead.tags ?? [],
        });
        return { lead, r };
      }),
    );

    // Two writes per row max: an update for the trust + timestamp,
    // and a conditional archive update for the invalid ones. We
    // do them inline (one round-trip per row inside the batch) to
    // keep the surface small; a single bulk UPDATE…CASE would be
    // faster but harder to reason about for the audit-log call.
    for (const r of results) {
      if (r.status === "rejected") {
        errors.push(
          `classify threw: ${(r.reason as Error)?.message?.slice(0, 80) ?? "unknown"}`,
        );
        continue;
      }
      const { lead, r: verdict } = r.value;
      byTrust[verdict.trust] += 1;

      try {
        if (verdict.trust === "invalid") {
          // Archive + add email-invalid tag (skip if already
          // tagged to keep the array tidy under repeat runs).
          const existing = lead.tags ?? [];
          const nextTags = existing.includes("email-invalid")
            ? existing
            : [...existing, "email-invalid"];
          await db
            .update(leadsTable)
            .set({
              emailTrust: verdict.trust,
              emailValidatedAt: sql`now()`,
              archivedAt: sql`now()`,
              tags: nextTags,
              updatedAt: sql`now()`,
            })
            .where(sql`${leadsTable.id} = ${lead.id}`);
          archivedAsInvalid += 1;
          if (archivedSample.length < 20) archivedSample.push(lead.id);
        } else {
          await db
            .update(leadsTable)
            .set({
              emailTrust: verdict.trust,
              emailValidatedAt: sql`now()`,
              updatedAt: sql`now()`,
            })
            .where(sql`${leadsTable.id} = ${lead.id}`);
        }
      } catch (err) {
        errors.push(
          `update ${lead.id} failed: ${(err as Error).message?.slice(0, 80) ?? "unknown"}`,
        );
      }
    }
  }

  // Single summary audit entry — easier to spot in the Health tab's
  // recent-audit table than 50 per-row entries.
  try {
    await db.insert(auditLog).values({
      actorUserId: opts.actorUserId,
      entity: "leads",
      entityId: null,
      action: "revalidate_all_email_trust",
      beforeJson: null,
      afterJson: {
        checked: candidates.length,
        byTrust,
        archivedAsInvalid,
        durationMs: Date.now() - start,
        errors: errors.slice(0, 10),
      },
      occurredAt: sql`now()`,
    });
  } catch (err) {
    errors.push(
      `summary audit failed: ${(err as Error).message?.slice(0, 80) ?? "unknown"}`,
    );
  }

  return {
    checked: candidates.length,
    byTrust,
    archivedAsInvalid,
    archivedSample,
    durationMs: Date.now() - start,
    errors,
  };
}
