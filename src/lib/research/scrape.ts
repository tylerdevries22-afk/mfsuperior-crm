/**
 * Last-resort contact discovery. When Hunter has nothing for a domain (or
 * we're out of budget), fetch the company's about/contact/team pages and
 * pull `mailto:` + a name-near-title heuristic. Costs nothing — only the
 * remote site sees the request.
 *
 * Heuristic only — never claim "verified" on these emails. The orchestrator
 * tags `email-unverified` if the verifier wasn't run on top.
 */

import * as cheerio from "cheerio";

export type ScrapedContact = {
  email: string;
  /** Best-effort extracted name (may be null). */
  name: string | null;
  /** Free-text role we matched near the email. */
  position: string | null;
};

const PATHS = ["", "/about", "/contact", "/contact-us", "/team", "/our-team", "/leadership"];

const ROLE_PATTERN =
  /\b(owner|president|ceo|founder|general manager|gm|director|operations manager|operations|purchasing|logistics|facilities|office manager|store manager)\b/i;

const NAME_NEAR_ROLE =
  /\b(owner|president|ceo|founder|general manager|gm|operations|purchasing|logistics|facilities|office manager|store manager)\s*[-:|—]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i;

export async function scrapeDomainForContacts(
  domain: string,
  log: (msg: string) => void = () => {},
): Promise<ScrapedContact[]> {
  const root = `https://${domain}`;
  const found = new Map<string, ScrapedContact>();

  for (const p of PATHS) {
    const url = `${root}${p}`;
    let html: string;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "MF-Superior-Lead-Research/1.0 (+https://mfsuperiorproducts.com)" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      html = await res.text();
    } catch (err) {
      log(`    ! scrape fetch failed ${url}: ${(err as Error).message}`);
      continue;
    }

    const $ = cheerio.load(html);
    const text = $("body").text();

    // 1. mailto: links — most reliable.
    $("a[href^='mailto:']").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const email = href.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
      if (!email || !email.includes("@")) return;
      // Ignore mailto:webmaster@... unless it's the only one — pickBest does that later.
      if (!found.has(email)) {
        // Try to pull a role from the surrounding text.
        const surroundings = $(el).parent().text().slice(0, 200);
        const role = surroundings.match(ROLE_PATTERN)?.[1] ?? null;
        found.set(email, { email, name: null, position: role });
      }
    });

    // 2. "Owner — Jane Doe" / "Operations: John Smith" patterns near a mailto-less listing.
    const m = text.match(NAME_NEAR_ROLE);
    if (m) {
      // Mark these positions; the orchestrator may pair them with a mailto found elsewhere.
      // (No email here, so we don't add to `found` directly.)
      log(`    ~ inferred ${m[1]}: ${m[2]} on ${url}`);
    }
  }

  return [...found.values()];
}

/* ── Pick best scraped contact ──────────────────────────────────── */

const PREFERRED_LOCAL_PARTS = [
  "owner",
  "president",
  "ceo",
  "founder",
  "operations",
  "purchasing",
  "logistics",
  "manager",
  "gm",
];

const DEPRIORITIZED_LOCAL_PARTS = [
  "support",
  "help",
  "noreply",
  "no-reply",
  "donotreply",
  "marketing",
  "press",
  "media",
  "careers",
  "jobs",
];

export function pickBestScrapedContact(contacts: ScrapedContact[]): ScrapedContact | null {
  if (contacts.length === 0) return null;
  const scored = contacts.map((c) => {
    const local = c.email.split("@")[0]?.toLowerCase() ?? "";
    let s = 0;
    if (c.position && ROLE_PATTERN.test(c.position)) s -= 3;
    for (const p of PREFERRED_LOCAL_PARTS) if (local.includes(p)) s -= 2;
    for (const d of DEPRIORITIZED_LOCAL_PARTS) if (local.includes(d)) s += 5;
    if (local.startsWith("info") || local.startsWith("contact") || local.startsWith("hello")) s += 1;
    return { c, s };
  });
  scored.sort((a, b) => a.s - b.s);
  return scored[0]?.c ?? null;
}
