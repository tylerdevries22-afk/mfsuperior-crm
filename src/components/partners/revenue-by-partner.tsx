import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PARTNER_FALLBACK_ACCENT,
  findPartner,
  partnerAccent,
  type Partner,
} from "@/data/partners";
import { PartnerLogo } from "./partner-logo";

export interface PartnerRevenueRow {
  partnerSlug: string | null;
  /** Total booked revenue in cents. */
  revenueCents: number;
  loadCount: number;
}

function currency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Revenue split across the partner book.
 *
 * A stacked bar plus a logo legend rather than a pie: the question an operator
 * asks here is "how concentrated are we", and a single proportional bar answers
 * that in one glance. Every legend row carries the partner's logo, which is
 * what makes the split readable without parsing the names.
 *
 * Server component — the dashboard already renders on the server, so the
 * partner directory comes in as a prop rather than through a client fetch.
 */
export function RevenueByPartner({
  rows,
  partners,
}: {
  rows: readonly PartnerRevenueRow[];
  partners: readonly Partner[];
}) {
  const ranked = [...rows]
    .filter((row) => row.revenueCents > 0)
    .sort((a, b) => b.revenueCents - a.revenueCents);
  const total = ranked.reduce((sum, row) => sum + row.revenueCents, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by partner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No booked revenue yet. Assign a partner on a load to start the
            split.
          </p>
        ) : (
          <>
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Revenue split across ${ranked.length} partners, ${currency(total)} total`}
            >
              {ranked.map((row) => {
                const partner = findPartner(row.partnerSlug, partners);
                return (
                  <span
                    key={row.partnerSlug ?? "__unassigned"}
                    className="h-full"
                    style={{
                      width: `${(row.revenueCents / total) * 100}%`,
                      backgroundColor: row.partnerSlug
                        ? partnerAccent(partner)
                        : PARTNER_FALLBACK_ACCENT,
                    }}
                  />
                );
              })}
            </div>

            <ul className="space-y-2">
              {ranked.map((row) => {
                const partner = findPartner(row.partnerSlug, partners);
                const share = Math.round((row.revenueCents / total) * 100);
                return (
                  <li
                    key={row.partnerSlug ?? "__unassigned"}
                    className="flex items-center gap-3"
                  >
                    {row.partnerSlug ? (
                      <PartnerLogo
                        slug={row.partnerSlug}
                        size="sm"
                        partners={partners}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="inline-block size-5 shrink-0 rounded-sm"
                        style={{ backgroundColor: PARTNER_FALLBACK_ACCENT }}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {partner?.name ?? row.partnerSlug ?? "Unassigned"}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {row.loadCount} load{row.loadCount === 1 ? "" : "s"}
                    </span>
                    <span className="w-20 shrink-0 text-right font-mono text-sm tabular-nums text-foreground">
                      {currency(row.revenueCents)}
                    </span>
                    <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {share}%
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              <span className="font-mono tabular-nums text-foreground">
                {currency(total)}
              </span>{" "}
              booked across {ranked.length} partner
              {ranked.length === 1 ? "" : "s"}.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
