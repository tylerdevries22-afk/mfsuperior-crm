/**
 * hunter.io v2 client. Two endpoints used:
 *   GET /v2/domain-search?domain={d}&limit=10  — find emails for a domain
 *   GET /v2/email-verifier?email={e}           — verify a single email
 *
 * Free tier: 25 + 25 / month combined. We track usage locally (per-month
 * counter in the cache file) and stop calling once the budget is gone.
 *
 * Hunter rate-limits per second too — we add a small jitter delay between
 * calls so we don't 429 on fast enough hardware.
 */

export type HunterEmail = {
  value: string;
  type?: string; // "personal" | "generic"
  confidence?: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  seniority?: string | null;
  department?: string | null;
};

export type DomainSearchResult = { emails: HunterEmail[] };

export type VerifierResult = {
  result: "deliverable" | "undeliverable" | "risky" | "unknown";
  // Hunter's "status" field is finer-grained:
  status?:
    | "valid"
    | "invalid"
    | "accept_all"
    | "webmail"
    | "disposable"
    | "unknown";
  score?: number;
  mx_records?: boolean;
  webmail?: boolean;
  disposable?: boolean;
  gibberish?: boolean;
};

export type Budget = {
  searches: { used: number; cap: number };
  verifications: { used: number; cap: number };
};

export class HunterClient {
  constructor(
    private apiKey: string,
    private budget: Budget,
    /** Optional logger so the orchestrator can stream progress. */
    private log: (msg: string) => void = () => {},
  ) {}

  budgetLeft(): { searches: number; verifications: number } {
    return {
      searches: Math.max(0, this.budget.searches.cap - this.budget.searches.used),
      verifications: Math.max(
        0,
        this.budget.verifications.cap - this.budget.verifications.used,
      ),
    };
  }

  async domainSearch(domain: string): Promise<DomainSearchResult | null> {
    if (this.budget.searches.used >= this.budget.searches.cap) {
      this.log(
        `  ! Hunter search budget exhausted (${this.budget.searches.used}/${this.budget.searches.cap}). Skipping ${domain}.`,
      );
      return null;
    }
    const url = new URL("https://api.hunter.io/v2/domain-search");
    url.searchParams.set("domain", domain);
    url.searchParams.set("limit", "10");
    url.searchParams.set("api_key", this.apiKey);

    try {
      await this.throttle();
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        this.log(`  ! Hunter domain-search ${res.status} for ${domain}: ${text.slice(0, 200)}`);
        return null;
      }
      this.budget.searches.used++;
      const json = (await res.json()) as { data?: { emails?: HunterEmail[] } };
      return { emails: json.data?.emails ?? [] };
    } catch (err) {
      this.log(`  ! Hunter domain-search threw on ${domain}: ${(err as Error).message}`);
      return null;
    }
  }

  async verify(email: string): Promise<VerifierResult | null> {
    if (this.budget.verifications.used >= this.budget.verifications.cap) {
      this.log(
        `  ! Hunter verifier budget exhausted (${this.budget.verifications.used}/${this.budget.verifications.cap}). Skipping ${email}.`,
      );
      return null;
    }
    const url = new URL("https://api.hunter.io/v2/email-verifier");
    url.searchParams.set("email", email);
    url.searchParams.set("api_key", this.apiKey);

    try {
      await this.throttle();
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        this.log(`  ! Hunter verifier ${res.status} for ${email}: ${text.slice(0, 200)}`);
        return null;
      }
      this.budget.verifications.used++;
      const json = (await res.json()) as { data?: VerifierResult };
      return json.data ?? null;
    } catch (err) {
      this.log(`  ! Hunter verifier threw on ${email}: ${(err as Error).message}`);
      return null;
    }
  }

  private async throttle(): Promise<void> {
    // 100 ms is plenty under Hunter's 15 req/sec free-tier limit and
    // gives us slack if other traffic is on the same key.
    await new Promise((r) => setTimeout(r, 100));
  }
}

/* ── Right-person picker ─────────────────────────────────────────── */

const SENIORITY_PRIORITY = [
  "owner",
  "president",
  "ceo",
  "founder",
  "general manager",
  "gm",
  "director of operations",
  "operations",
  "purchasing",
  "logistics",
  "facilities",
  "office manager",
];

export function pickBestContact(emails: HunterEmail[]): HunterEmail | null {
  if (emails.length === 0) return null;
  const scored = emails.map((e) => {
    const pos = (e.position ?? e.seniority ?? "").toLowerCase();
    let rank = SENIORITY_PRIORITY.findIndex((kw) => pos.includes(kw));
    if (rank === -1) rank = SENIORITY_PRIORITY.length; // unknown role -> last
    // Prefer "personal" over generic info@/contact@.
    const typeBonus = e.type === "personal" ? -1 : 0;
    return { e, sortKey: rank + typeBonus };
  });
  scored.sort((a, b) => a.sortKey - b.sortKey);
  return scored[0]?.e ?? null;
}
