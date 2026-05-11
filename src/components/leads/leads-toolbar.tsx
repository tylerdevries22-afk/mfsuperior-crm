import Link from "next/link";
import { Search as SearchIcon, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Slim toolbar that lives above the leads table in the main column.
 * Replaces the inline dropdown row that used to live in FilterBar
 * (those facets moved to the new <FilterRail> on the left).
 *
 * What stays here:
 *   • Search input (free text → q param)
 *   • Per-page dropdown (most-touched form field after search)
 *   • A condensed "active filters" summary that links to /leads to
 *     clear everything in one click on mobile (where the rail is
 *     hidden behind a viewport breakpoint).
 *
 * Everything is a plain GET form / Link — no client JS required.
 */

const PAGE_SIZES = [25, 50, 100, 200] as const;

export type LeadsToolbarProps = {
  q: string;
  stages: string[];
  tiers: string[];
  sources: string[];
  tags: string[];
  lastContacted: string;
  enrollment: string;
  hasEmail: string;
  perPage: number;
  /** Pre-computed total of active filter facets. The rail computes
   * this too — passing it from the page keeps both sides in sync. */
  activeCount: number;
};

export function LeadsToolbar(props: LeadsToolbarProps) {
  const stagesCsv = props.stages.join(",");
  const tiersCsv = props.tiers.join(",");
  const sourcesCsv = props.sources.join(",");
  const tagsCsv = props.tags.join(",");

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {/* Search: GET form to /leads preserves every other facet via
          hidden inputs. */}
      <form
        id="leads-search-form"
        action="/leads"
        method="get"
        className="relative flex-1 min-w-[220px]"
      >
        <input type="hidden" name="stage" value={stagesCsv} />
        <input type="hidden" name="tier" value={tiersCsv} />
        <input type="hidden" name="source" value={sourcesCsv} />
        <input type="hidden" name="tags" value={tagsCsv} />
        <input type="hidden" name="lastContacted" value={props.lastContacted} />
        <input type="hidden" name="enrollment" value={props.enrollment} />
        <input type="hidden" name="hasEmail" value={props.hasEmail} />
        <input type="hidden" name="perPage" value={String(props.perPage)} />
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          placeholder="Search company, email, city, vertical…"
          defaultValue={props.q}
          className="h-8 pl-8 text-[13px]"
        />
      </form>

      <PerPageDropdown
        perPage={props.perPage}
        others={{
          q: props.q,
          stage: stagesCsv,
          tier: tiersCsv,
          source: sourcesCsv,
          tags: tagsCsv,
          lastContacted: props.lastContacted,
          enrollment: props.enrollment,
          hasEmail: props.hasEmail,
        }}
      />

      {(props.activeCount > 0 || props.q.length > 0) && (
        <Link
          href="/leads"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <XIcon className="size-3" /> Clear all
        </Link>
      )}

      {/* Apply is implicit on Enter from the search input; an explicit
          button helps less-keyboard-confident operators. The `form`
          attribute connects it to the search form above so the
          submit lives outside the form's DOM. */}
      <Button
        type="submit"
        form="leads-search-form"
        variant="outline"
        size="sm"
        className="h-8 px-2.5 text-[12px]"
      >
        Apply
      </Button>
    </div>
  );
}

function PerPageDropdown({
  perPage,
  others,
}: {
  perPage: number;
  others: Record<string, string>;
}) {
  return (
    <details className="relative">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-md border border-input bg-background px-2.5 text-[12px] text-foreground transition-colors hover:bg-secondary/40">
        <span className="text-muted-foreground">Show</span>
        <span className="font-mono tabular-nums">{perPage}</span>
        <span aria-hidden className="ml-0.5 text-muted-foreground">▾</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-28 rounded-md border border-border bg-card p-1 shadow-lg">
        {PAGE_SIZES.map((n) => {
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(others)) {
            if (v && v !== "" && v !== "any") params.set(k, v);
          }
          params.set("perPage", String(n));
          const href = `/leads?${params.toString()}`;
          const isActive = n === perPage;
          return (
            <Link
              key={n}
              href={href}
              className={
                "flex items-center justify-between rounded-sm px-2 py-1 text-[12px] transition-colors hover:bg-secondary/40 " +
                (isActive ? "text-foreground" : "text-muted-foreground")
              }
            >
              <span className="font-mono tabular-nums">{n}</span>
              {isActive && (
                <span className="text-primary" aria-hidden>
                  ✓
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </details>
  );
}
