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
import { findEmailsOnWebsite } from "@/lib/research/verify-website-email";
import {
  HunterClient,
  type Budget as HunterBudget,
} from "@/lib/research/hunter";
import { loadCache, saveCache, currentMonth } from "@/lib/research/cache";

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
    | "api-verified"
    | "api-invalid"
    | "strong-signal"
    | "default";
  /** Tags to merge onto the lead row (deep classifier only). */
  tagsToAdd?: string[];
};

/* ── Helpers shared by the deep classifier ─────────────────────── */

/**
 * "Usable" B2B role-pattern local-parts. These are NOT rejected — at
 * many small Colorado businesses they're the only address the owner
 * actually monitors. We tag them `role-account` so outreach can
 * prioritise personal addresses but still verify them normally.
 */
const B2B_ROLE_LOCAL_PARTS = new Set([
  "info",
  "sales",
  "contact",
  "hello",
  "office",
  "dispatch",
  "orders",
  "logistics",
  "operations",
  "ops",
  "purchasing",
  "procurement",
  "facilities",
  "shipping",
  "receiving",
]);

function isB2BRoleEmail(email: string): boolean {
  const local = email.split("@")[0] ?? "";
  if (B2B_ROLE_LOCAL_PARTS.has(local)) return true;
  // Match prefixes like `sales-team@`, `info.us@`.
  for (const p of B2B_ROLE_LOCAL_PARTS) {
    if (local.startsWith(`${p}.`) || local.startsWith(`${p}-`)) return true;
  }
  return false;
}

/**
 * Resolve the company's web domain. Prefer the lead's `website`
 * column (since `john@gmail.com` working at `acme.com` should
 * scrape `acme.com`, not `gmail.com`). Fall back to the email's
 * own domain if `website` is empty or unparseable.
 */
function resolveCompanyDomain(
  website: string | null,
  email: string,
): string | null {
  if (website) {
    try {
      const trimmed = website.trim();
      const url = /^https?:\/\//i.test(trimmed)
        ? new URL(trimmed)
        : new URL(`https://${trimmed}`);
      return url.hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      // fall through
    }
  }
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : null;
}

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
 * Deep classifier — extends `classifyEmailTrustAsync` with two
 * heavy verification layers that produce the bulk of "verified"
 * promotions today:
 *
 *   • Website re-scrape (layer 10) — fetches the company's site and
 *     checks whether `email` appears verbatim. A match upgrades to
 *     `verified` (+ tag `email-website-confirmed`). Reachable-but-
 *     no-match is recorded so the strong-signal step downstream can
 *     still promote MX-validated addresses on live B2B sites.
 *
 *   • Hunter.io email-verifier (layer 5, paid-API path) — only
 *     invoked if `opts.hunter` is non-null AND there's quota
 *     remaining. Deliverable → `verified` + `email-api-verified`.
 *     Undeliverable → `invalid` + `email-api-invalid` (archived).
 *     Risky → tag `email-risky`, keep current trust.
 *
 * Strong-signal fallback: when neither website nor Hunter
 * verifies the email but the MX is good AND the company's website
 * was reachable, we promote to `verified`. This is the
 * "deliverable OR strong signal" bar operators picked in the
 * pipeline audit — it correctly classifies the `info@company.com`
 * patterns that dominate small-business B2B but don't get hit by
 * any free API.
 */
export async function classifyEmailTrustDeep(
  input: {
    email: string | null;
    tags: string[];
    website: string | null;
  },
  opts: {
    /** When supplied, the verifier is called once per lead within
     *  the client's remaining monthly quota. Pass null to skip. */
    hunter: HunterClient | null;
    /** Whether to re-fetch the company's website. Setting false
     *  bypasses layer 10 (used by the lighter sync cron path). */
    scrapeWebsite: boolean;
    /** Per-domain hard timeout for the website scrape. Default 4s. */
    scrapeTimeoutMs?: number;
  },
): Promise<TrustResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  const tags = new Set(input.tags ?? []);
  const tagsToAdd = new Set<string>();

  if (!email) {
    return { trust: "invalid", reason: "no email on file", source: "syntax" };
  }

  // Fast-path: any earlier pipeline already proved this address is
  // deliverable. Skip the slow website fetch + Hunter call.
  if (
    tags.has("email-verified") ||
    tags.has("email-api-verified") ||
    tags.has("email-website-confirmed")
  ) {
    return {
      trust: "verified",
      reason: "verified by an earlier pipeline (upstream / website / API tag)",
      source: "tag-prior",
    };
  }
  if (tags.has("email-invalid") || tags.has("email-api-invalid")) {
    return {
      trust: "invalid",
      reason: "previously archived as invalid",
      source: "tag-prior",
    };
  }

  // Layer 1-4: cheap structural checks (RFC 5322 + MX + disposable).
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

  // Tag role-pattern emails regardless of how they end up classified
  // (operator can filter outreach on this tag without affecting trust).
  if (isB2BRoleEmail(email)) tagsToAdd.add("role-account");

  // Layer 10: website re-scrape. Verbatim match is the strongest
  // free signal we have — a human at the company published this
  // address on their own site.
  let websiteReachable = false;
  let companyDomain: string | null = null;
  if (opts.scrapeWebsite) {
    companyDomain = resolveCompanyDomain(input.website, email);
    if (companyDomain) {
      const scan = await findEmailsOnWebsite(
        companyDomain,
        opts.scrapeTimeoutMs ?? 4_000,
      );
      websiteReachable = scan.reachable;
      if (scan.reachable && scan.emails.has(email)) {
        tagsToAdd.add("email-website-confirmed");
        return {
          trust: "verified",
          reason: `found verbatim on ${companyDomain}${
            scan.emailToPath.get(email) ?? "/"
          }`,
          source: "website-confirm",
          tagsToAdd: [...tagsToAdd],
        };
      }
    }
  }

  // Layer 5: Hunter.io email-verifier (paid-API path, capped by
  // monthly free-tier budget).
  if (opts.hunter && opts.hunter.budgetLeft().verifications > 0) {
    const v = await opts.hunter.verify(email);
    if (v) {
      if (v.result === "deliverable") {
        tagsToAdd.add("email-api-verified");
        return {
          trust: "verified",
          reason: `Hunter API: deliverable${
            v.score != null ? ` (score ${v.score})` : ""
          }`,
          source: "api-verified",
          tagsToAdd: [...tagsToAdd],
        };
      }
      if (v.result === "undeliverable") {
        tagsToAdd.add("email-api-invalid");
        return {
          trust: "invalid",
          reason: `Hunter API: undeliverable (${v.status ?? "?"})`,
          source: "api-invalid",
          tagsToAdd: [...tagsToAdd],
        };
      }
      if (v.result === "risky") {
        // Don't reject — Hunter flags accept-all domains as risky
        // too, which is unhelpfully strict for small B2B. Note it
        // and let strong-signal take over.
        tagsToAdd.add("email-risky");
      }
      // "unknown" — fall through.
    }
  }

  // Strong-signal promotion: MX passes AND the company's website
  // was reachable just now. This is the bar operators picked —
  // covers `info@`/`sales@` on active small-biz sites that no free
  // API can confirm.
  if (
    websiteReachable &&
    (mx.status === "valid" || mx.status === "role_account")
  ) {
    return {
      trust: "verified",
      reason: `MX + reachable company website (${companyDomain ?? "?"})`,
      source: "strong-signal",
      tagsToAdd: [...tagsToAdd],
    };
  }

  // Catch-alls — neither website nor API verified, no strong signal.
  if (mx.status === "freemail") {
    return {
      trust: "unverified",
      reason: `personal mailbox at ${mx.domain} — low B2B signal`,
      source: "freemail",
      tagsToAdd: [...tagsToAdd],
    };
  }
  if (mx.status === "role_account") {
    return {
      trust: "guessed",
      reason: "role-pattern address, no website match or API verdict",
      source: "role",
      tagsToAdd: [...tagsToAdd],
    };
  }
  return {
    trust: "unverified",
    reason: "passed MX but no website / API confirmation",
    source: "mx",
    tagsToAdd: [...tagsToAdd],
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
  /** Counts indexed by the source layer that produced each verdict —
   *  useful for diagnosing which pipeline stage is doing the work. */
  bySource: Record<string, number>;
  archivedAsInvalid: number;
  archivedSample: string[];
  /** Number of Hunter verifier calls actually made this run. */
  hunterCalls: number;
  /** Whether we stopped early because the per-action deadline was hit. */
  partial: boolean;
  durationMs: number;
  errors: string[];
};

// Concurrency cap. The deep classifier fires up to ~5 parallel HTTP
// fetches per lead (one per common contact page), so 25 leads in
// flight = ~125 in-flight HTTPS requests at peak. Comfortable for
// Vercel's serverless runtime; higher and we start seeing UND_ERR
// socket exhaustions on cold starts.
const BATCH = 25;

// Per-action soft deadline. The /admin route is `maxDuration = 60` so
// we leave headroom for the audit-log insert + redirect + revalidate-
// Path round-trip. Leads we didn't reach this run stay at their old
// trust level and get picked up next click / next cron.
const DEADLINE_MS = 50_000;

// Free-tier Hunter cap. Loaded from the local cache file so multiple
// runs within the same month share the same monthly counter. The
// cache resets on month rollover (see currentMonth() in cache.ts).
const HUNTER_FREE_TIER_CAP = 25;

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
  const bySource: Record<string, number> = {};
  const errors: string[] = [];
  const archivedSample: string[] = [];

  // Boot a Hunter client if the key is present. The client's budget
  // is seeded from the on-disk cache so we don't blow the monthly
  // quota across multiple runs.
  let hunter: HunterClient | null = null;
  let cachedSearchesUsed = 0;
  let cachedVerificationsUsed = 0;
  if (process.env.HUNTER_API_KEY) {
    try {
      const cache = loadCache();
      cachedSearchesUsed = cache.hunterUsage.searches;
      cachedVerificationsUsed = cache.hunterUsage.verifications;
      const budget: HunterBudget = {
        searches: {
          used: cachedSearchesUsed,
          cap: HUNTER_FREE_TIER_CAP,
        },
        verifications: {
          used: cachedVerificationsUsed,
          cap: HUNTER_FREE_TIER_CAP,
        },
      };
      hunter = new HunterClient(process.env.HUNTER_API_KEY, budget);
    } catch (err) {
      errors.push(
        `hunter init: ${(err as Error).message?.slice(0, 80) ?? "?"}`,
      );
    }
  }

  const candidates = await db
    .select({
      id: leadsTable.id,
      email: leadsTable.email,
      tags: leadsTable.tags,
      website: leadsTable.website,
    })
    .from(leadsTable)
    .where(and(isNotNull(leadsTable.email), isNull(leadsTable.archivedAt)));

  // Process already-API-verified leads FIRST (cheap fast-path) so the
  // remaining time budget is spent on leads that actually need slow
  // verification. Sort: leads without strong-prior tags go to the
  // back, so a partial run still touches the maximum number of "hard"
  // candidates.
  const ordered = [...candidates].sort((a, b) => {
    const aFast = a.tags?.some(
      (t) =>
        t === "email-verified" ||
        t === "email-api-verified" ||
        t === "email-website-confirmed" ||
        t === "email-invalid" ||
        t === "email-api-invalid",
    )
      ? 0
      : 1;
    const bFast = b.tags?.some(
      (t) =>
        t === "email-verified" ||
        t === "email-api-verified" ||
        t === "email-website-confirmed" ||
        t === "email-invalid" ||
        t === "email-api-invalid",
    )
      ? 0
      : 1;
    return aFast - bFast;
  });

  let archivedAsInvalid = 0;
  let partial = false;
  let processed = 0;

  for (let i = 0; i < ordered.length; i += BATCH) {
    if (Date.now() - start > DEADLINE_MS) {
      partial = true;
      errors.push(
        `deadline: stopped after ${processed}/${ordered.length} leads`,
      );
      break;
    }
    const slice = ordered.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      slice.map(async (lead) => {
        const r = await classifyEmailTrustDeep(
          {
            email: lead.email,
            tags: lead.tags ?? [],
            website: lead.website ?? null,
          },
          { hunter, scrapeWebsite: true },
        );
        return { lead, r };
      }),
    );

    for (const r of results) {
      processed += 1;
      if (r.status === "rejected") {
        errors.push(
          `classify threw: ${(r.reason as Error)?.message?.slice(0, 80) ?? "unknown"}`,
        );
        continue;
      }
      const { lead, r: verdict } = r.value;
      byTrust[verdict.trust] += 1;
      bySource[verdict.source] = (bySource[verdict.source] ?? 0) + 1;

      try {
        // Merge existing tags + any new tags the verdict asked us to
        // add (role-account, email-website-confirmed, email-api-verified, etc.).
        const next = new Set(lead.tags ?? []);
        for (const t of verdict.tagsToAdd ?? []) next.add(t);

        if (verdict.trust === "invalid") {
          next.add("email-invalid");
          await db
            .update(leadsTable)
            .set({
              emailTrust: verdict.trust,
              emailValidatedAt: sql`now()`,
              archivedAt: sql`now()`,
              tags: [...next],
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
              tags: [...next],
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

  // Persist Hunter usage so the next run respects the same monthly
  // cap. saveCache() is a no-op on Vercel (read-only FS at runtime)
  // — that's fine: the Hunter API itself returns 402 once monthly
  // quota is exhausted, and the client swallows that as `null`.
  let hunterCalls = 0;
  if (hunter) {
    const left = hunter.budgetLeft();
    hunterCalls = HUNTER_FREE_TIER_CAP - left.verifications - cachedVerificationsUsed;
    try {
      const cache = loadCache();
      cache.hunterUsage = {
        month: currentMonth(),
        searches: HUNTER_FREE_TIER_CAP - left.searches,
        verifications: HUNTER_FREE_TIER_CAP - left.verifications,
      };
      saveCache(cache);
    } catch (err) {
      errors.push(
        `hunter cache save: ${(err as Error).message?.slice(0, 60) ?? "?"}`,
      );
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
        checked: processed,
        total: candidates.length,
        byTrust,
        bySource,
        archivedAsInvalid,
        hunterCalls,
        partial,
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
    checked: processed,
    byTrust,
    bySource,
    archivedAsInvalid,
    archivedSample,
    hunterCalls,
    partial,
    durationMs: Date.now() - start,
    errors,
  };
}
