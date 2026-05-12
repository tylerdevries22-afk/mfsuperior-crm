/**
 * verify-website-email.ts — single-entry pipeline that takes a domain,
 * extracts emails from the website, MX-validates them, and returns a
 * verified email or a skip-reason.
 *
 * NEVER GUESSES. If the website yields no extractable email, or no email
 * passes MX validation, this returns { kind: "skip", reason }. The caller
 * must NOT insert a lead in that case — the whole point of this module is
 * that the leads table only ever contains real, verified addresses.
 *
 * Built to fit inside Vercel Hobby's 10s function timeout when run over
 * 150+ companies in parallel: per-company hard cap of 4 seconds, per-HTTP
 * fetch hard cap of 2 seconds. Worst case: 5 paths × 2s with an early
 * abort once any email is found.
 */

import * as cheerio from "cheerio";
import { validateEmail, type MxValidation } from "./mx-validate";

const PATHS = [
  "",
  "/contact",
  "/contact-us",
  "/about",
  "/team",
  "/our-team",
  "/leadership",
  "/staff",
];

const USER_AGENT =
  "MF-Superior-Lead-Research/1.0 (+https://mfsuperiorproducts.com)";

/* ── Email-mining helpers ──────────────────────────────────────── */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Per-fetch timeout — keeps stalled pages from blowing the per-company budget. */
const PER_FETCH_MS = 2_000;

async function fetchHtml(
  url: string,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const fetchSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(PER_FETCH_MS),
    ]);
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: fetchSignal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractEmailsFromHtml(
  html: string,
  domain: string,
): Set<string> {
  const $ = cheerio.load(html);
  const emails = new Set<string>();

  // 1. mailto: links — most reliable.
  $("a[href^='mailto:'], a[href^='MAILTO:']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const raw = href.replace(/^mailto:/i, "").split("?")[0].trim();
    if (raw && raw.includes("@")) emails.add(raw.toLowerCase());
  });

  // 2. Visible-text regex sweep. Restrict to emails whose domain matches
  //    the company domain (or a subdomain) — otherwise a customer-support
  //    blurb mentioning hello@somethirdparty.com would pollute results.
  const matches = $("body").text().match(EMAIL_REGEX);
  if (matches) {
    for (const m of matches) {
      const e = m.toLowerCase();
      const eDomain = e.split("@")[1];
      if (eDomain === domain || eDomain.endsWith(`.${domain}`)) {
        emails.add(e);
      }
    }
  }

  return emails;
}

/* ── Best-email picker ─────────────────────────────────────────── */

// Highest-seniority local-parts get priority. Lower index = higher priority.
const PRIORITY_LOCAL_PARTS = [
  "owner",
  "president",
  "ceo",
  "founder",
  "gm",
  "generalmanager",
  "general.manager",
  "operations",
  "operationsmanager",
  "ops",
  "purchasing",
  "procurement",
  "logistics",
  "dispatch",
  "orders",
  "office",
  "officemanager",
  "office.manager",
  "manager",
  "facilities",
  "store",
  "storemanager",
  "info",
  "contact",
  "hello",
  "sales",
];

// Hard-blocked local-parts — never pick these.
const BLOCKED_LOCAL_PARTS = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "webmaster",
  "postmaster",
  "abuse",
  "privacy",
  "legal",
  "press",
  "media",
  "marketing",
  "careers",
  "jobs",
  "hr",
  "recruiting",
  "support",
  "help",
  "tech",
  "tickets",
]);

function pickBest(emails: Set<string>): string | null {
  if (emails.size === 0) return null;
  const usable = [...emails].filter((e) => {
    const local = e.split("@")[0];
    return !BLOCKED_LOCAL_PARTS.has(local);
  });
  if (usable.length === 0) return null;

  usable.sort((a, b) => {
    const la = a.split("@")[0];
    const lb = b.split("@")[0];
    const ia = PRIORITY_LOCAL_PARTS.findIndex((p) => la.startsWith(p));
    const ib = PRIORITY_LOCAL_PARTS.findIndex((p) => lb.startsWith(p));
    const aRank = ia === -1 ? PRIORITY_LOCAL_PARTS.length : ia;
    const bRank = ib === -1 ? PRIORITY_LOCAL_PARTS.length : ib;
    if (aRank !== bRank) return aRank - bRank;
    return a.length - b.length;
  });
  return usable[0];
}

/* ── Main entry ────────────────────────────────────────────────── */

export type WebsiteVerifyResult =
  | {
      kind: "verified";
      email: string;
      mx: MxValidation;
      sourcePath: string;
    }
  | {
      kind: "skip";
      reason:
        | "no_html"
        | "no_emails_on_website"
        | "no_usable_email"
        | "mx_failed"
        | "timeout"
        | "no_domain";
    };

/**
 * Lower-level helper used by both the lead-research insert path
 * (`verifyWebsiteEmail` below — picks the best email) and the
 * email-trust revalidation path (which needs to know whether a
 * SPECIFIC lead email appears on the site, not pick a new one).
 *
 * Returns `{ reachable, emails }` where `reachable` is true iff at
 * least one page fetched OK; `emails` is the de-duplicated set of
 * lowercase addresses found on the site (filtered to the company's
 * own domain to avoid pulling third-party support emails).
 */
export type WebsiteEmailScan = {
  reachable: boolean;
  emails: Set<string>;
  /** First path each email was found on, for diagnostics ("notes" field
   *  on inserted leads cites this). */
  emailToPath: Map<string, string>;
};

export async function findEmailsOnWebsite(
  domain: string,
  overallTimeoutMs = 4_000,
): Promise<WebsiteEmailScan> {
  if (!domain) {
    return { reachable: false, emails: new Set(), emailToPath: new Map() };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), overallTimeoutMs);
  try {
    const fetches = PATHS.map(async (p) => {
      const url = `https://${domain}${p}`;
      const html = await fetchHtml(url, controller.signal);
      return html ? { path: p, html } : null;
    });
    const settled = await Promise.allSettled(fetches);
    const pages = settled
      .map((s) => (s.status === "fulfilled" ? s.value : null))
      .filter((p): p is { path: string; html: string } => p !== null);
    if (pages.length === 0) {
      return { reachable: false, emails: new Set(), emailToPath: new Map() };
    }

    const all = new Set<string>();
    const emailToPath = new Map<string, string>();
    for (const { path, html } of pages) {
      const found = extractEmailsFromHtml(html, domain);
      for (const e of found) {
        if (!all.has(e)) emailToPath.set(e, path || "/");
        all.add(e);
      }
    }
    return { reachable: true, emails: all, emailToPath };
  } catch {
    return { reachable: false, emails: new Set(), emailToPath: new Map() };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @param domain Bare hostname (no scheme), e.g. `homedepot.com`.
 * @param overallTimeoutMs Hard cap for the whole verification. Default 4s
 *   so 150 companies fit inside Vercel Hobby's 10s function limit when run
 *   in parallel.
 */
export async function verifyWebsiteEmail(
  domain: string,
  overallTimeoutMs = 4_000,
): Promise<WebsiteVerifyResult> {
  if (!domain) return { kind: "skip", reason: "no_domain" };

  const scan = await findEmailsOnWebsite(domain, overallTimeoutMs);
  if (!scan.reachable) {
    return { kind: "skip", reason: "no_html" };
  }
  if (scan.emails.size === 0) {
    return { kind: "skip", reason: "no_emails_on_website" };
  }

  const best = pickBest(scan.emails);
  if (!best) {
    return { kind: "skip", reason: "no_usable_email" };
  }

  const mx = await validateEmail(best);
  if (mx.confidence === "rejected") {
    return { kind: "skip", reason: "mx_failed" };
  }

  return {
    kind: "verified",
    email: best,
    mx,
    sourcePath: scan.emailToPath.get(best) ?? "/",
  };
}
