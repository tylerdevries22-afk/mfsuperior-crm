/**
 * Completely free email validation using node:dns. Confirms:
 *   1. Format passes a strict regex.
 *   2. The domain has at least one MX record (real mail server).
 *   3. The domain isn't on a free-webmail / disposable blocklist (B2B
 *      cold-pitching shouldn't target gmail.com etc.).
 *
 * No SMTP probe — that risks blacklisting the script's outbound IP and
 * is unreliable behind catch-all domains anyway. MX-presence is a
 * pragmatic floor: if a domain has no MX, the mailbox cannot exist.
 */

import { promises as dns } from "node:dns";

const FORMAT_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const FREE_WEBMAIL = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "msn.com",
  "ymail.com",
  "comcast.net",
  "att.net",
  "sbcglobal.net",
  "verizon.net",
  "cox.net",
]);

const DISPOSABLE = new Set([
  "mailinator.com",
  "10minutemail.com",
  "tempmail.com",
  "guerrillamail.com",
  "throwaway.email",
  "trashmail.com",
  "yopmail.com",
  "getnada.com",
]);

const ROLE_PREFIXES = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "support",
  "help",
  "press",
  "media",
  "marketing",
  "careers",
  "jobs",
]);

export type MxValidation = {
  email: string;
  status: "valid" | "freemail" | "disposable" | "role_account" | "no_mx" | "bad_format";
  /** Stronger when the domain has its own MX (vs gmail/etc). */
  confidence: "high" | "medium" | "low" | "rejected";
  domain: string | null;
};

const mxCache = new Map<string, boolean>();

async function hasMx(domain: string): Promise<boolean> {
  if (mxCache.has(domain)) return mxCache.get(domain)!;
  try {
    const records = await dns.resolveMx(domain);
    const ok = records.length > 0;
    mxCache.set(domain, ok);
    return ok;
  } catch {
    mxCache.set(domain, false);
    return false;
  }
}

export async function validateEmail(rawEmail: string): Promise<MxValidation> {
  const email = rawEmail.trim().toLowerCase();
  if (!FORMAT_RE.test(email)) {
    return { email, status: "bad_format", confidence: "rejected", domain: null };
  }
  const [local, domain] = email.split("@");
  if (DISPOSABLE.has(domain)) {
    return { email, status: "disposable", confidence: "rejected", domain };
  }
  if (ROLE_PREFIXES.has(local)) {
    // Still potentially useful (e.g. info@) but flagged so scoring downgrades.
    if (!(await hasMx(domain))) {
      return { email, status: "no_mx", confidence: "rejected", domain };
    }
    return { email, status: "role_account", confidence: "low", domain };
  }
  if (FREE_WEBMAIL.has(domain)) {
    if (!(await hasMx(domain))) {
      return { email, status: "no_mx", confidence: "rejected", domain };
    }
    // Personal mailbox on a free service — usable but lower B2B signal.
    return { email, status: "freemail", confidence: "medium", domain };
  }
  if (!(await hasMx(domain))) {
    return { email, status: "no_mx", confidence: "rejected", domain };
  }
  return { email, status: "valid", confidence: "high", domain };
}
