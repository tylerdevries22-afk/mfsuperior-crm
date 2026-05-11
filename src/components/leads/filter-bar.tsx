import Link from "next/link";
import { Search as SearchIcon, X as XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Server-rendered filter bar for /leads. No client-side state — every
 * filter change is encoded in the URL via plain GET form submission or
 * a `<Link href="/leads?...">`. Multi-value filters serialize as
 * comma-separated query params (`?stage=new,contacted&tier=A,B`).
 *
 * UX:
 *   - Top row: search box + Apply button + Clear-all link (when filters
 *     are active)
 *   - Chip row: each active filter rendered as a removable chip whose
 *     × button is a `<Link>` that strips that value from the URL
 *   - Dropdown row: multi-select checkbox dropdowns via `<details>`
 *     (native HTML — no JS required). Inside each `<details>` is a
 *     `<form>` of checkboxes scoped to that filter; the operator
 *     ticks boxes and clicks Apply.
 */

const STAGES = ["new", "contacted", "replied", "quoted", "won", "lost"] as const;
const TIERS = ["A", "B", "C"] as const;
const SOURCES = [
  { value: "lead-gen", label: "Generated (OSM + scrape + MX)" },
  { value: "website-scrape", label: "Generated (curated + scrape + MX)" },
  { value: "spreadsheet", label: "Imported (spreadsheet)" },
  { value: "website_contact", label: "Inbound (website contact form)" },
  { value: "manual", label: "Manually added" },
] as const;
const KNOWN_TAGS = [
  "tier-A",
  "tier-B",
  "tier-C",
  "email-verified",
  "email-guessed",
  "refrigerated",
  "chain-store",
  "discovered-via-osm",
  "discovered-via-curated",
] as const;
const PAGE_SIZES = [25, 50, 100, 200] as const;
const LAST_CONTACTED = [
  { value: "any", label: "Any time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "never", label: "Never contacted" },
] as const;
const ENROLLMENT = [
  { value: "any", label: "Any" },
  { value: "none", label: "Not enrolled" },
  { value: "active", label: "Active enrollment" },
  { value: "paused", label: "Paused enrollment" },
  { value: "completed", label: "Completed enrollment" },
] as const;
const HAS_EMAIL = [
  { value: "any", label: "Any" },
  { value: "yes", label: "Has email" },
  { value: "no", label: "No email" },
] as const;

type Props = {
  q: string;
  stages: string[];
  tiers: string[];
  sources: string[];
  tags: string[];
  lastContacted: string;
  enrollment: string;
  hasEmail: string;
  perPage: number;
};

function buildQueryString(params: Record<string, string | undefined>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "" && v !== "any") out.set(k, v);
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

function removeFromCsv(csv: string, value: string): string {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== value)
    .join(",");
}

export function FilterBar(props: Props) {
  const stagesCsv = props.stages.join(",");
  const tiersCsv = props.tiers.join(",");
  const sourcesCsv = props.sources.join(",");
  const tagsCsv = props.tags.join(",");

  // Active filters → chip list (removable)
  const chips: Array<{ label: string; href: string }> = [];

  for (const s of props.stages) {
    chips.push({
      label: `Stage: ${s}`,
      href: `/leads${buildQueryString({
        q: props.q,
        stage: removeFromCsv(stagesCsv, s),
        tier: tiersCsv,
        source: sourcesCsv,
        tags: tagsCsv,
        lastContacted: props.lastContacted,
        enrollment: props.enrollment,
        hasEmail: props.hasEmail,
      })}`,
    });
  }
  for (const t of props.tiers) {
    chips.push({
      label: `Tier ${t}`,
      href: `/leads${buildQueryString({
        q: props.q,
        stage: stagesCsv,
        tier: removeFromCsv(tiersCsv, t),
        source: sourcesCsv,
        tags: tagsCsv,
        lastContacted: props.lastContacted,
        enrollment: props.enrollment,
        hasEmail: props.hasEmail,
      })}`,
    });
  }
  for (const s of props.sources) {
    const label = SOURCES.find((x) => x.value === s)?.label ?? s;
    chips.push({
      label: `Source: ${label}`,
      href: `/leads${buildQueryString({
        q: props.q,
        stage: stagesCsv,
        tier: tiersCsv,
        source: removeFromCsv(sourcesCsv, s),
        tags: tagsCsv,
        lastContacted: props.lastContacted,
        enrollment: props.enrollment,
        hasEmail: props.hasEmail,
      })}`,
    });
  }
  for (const t of props.tags) {
    chips.push({
      label: `Tag: ${t}`,
      href: `/leads${buildQueryString({
        q: props.q,
        stage: stagesCsv,
        tier: tiersCsv,
        source: sourcesCsv,
        tags: removeFromCsv(tagsCsv, t),
        lastContacted: props.lastContacted,
        enrollment: props.enrollment,
        hasEmail: props.hasEmail,
      })}`,
    });
  }
  if (props.lastContacted !== "any") {
    const label =
      LAST_CONTACTED.find((x) => x.value === props.lastContacted)?.label ??
      props.lastContacted;
    chips.push({
      label: `Last contacted: ${label}`,
      href: `/leads${buildQueryString({
        q: props.q,
        stage: stagesCsv,
        tier: tiersCsv,
        source: sourcesCsv,
        tags: tagsCsv,
        lastContacted: "any",
        enrollment: props.enrollment,
        hasEmail: props.hasEmail,
      })}`,
    });
  }
  if (props.enrollment !== "any") {
    const label =
      ENROLLMENT.find((x) => x.value === props.enrollment)?.label ??
      props.enrollment;
    chips.push({
      label: `Enrollment: ${label}`,
      href: `/leads${buildQueryString({
        q: props.q,
        stage: stagesCsv,
        tier: tiersCsv,
        source: sourcesCsv,
        tags: tagsCsv,
        lastContacted: props.lastContacted,
        enrollment: "any",
        hasEmail: props.hasEmail,
      })}`,
    });
  }
  if (props.hasEmail !== "any") {
    const label = HAS_EMAIL.find((x) => x.value === props.hasEmail)?.label ?? props.hasEmail;
    chips.push({
      label: `Email: ${label}`,
      href: `/leads${buildQueryString({
        q: props.q,
        stage: stagesCsv,
        tier: tiersCsv,
        source: sourcesCsv,
        tags: tagsCsv,
        lastContacted: props.lastContacted,
        enrollment: props.enrollment,
        hasEmail: "any",
      })}`,
    });
  }

  const anyFilterActive = chips.length > 0 || props.q.length > 0;

  return (
    <div className="mb-5 space-y-3">
      {/* Search + Apply + Clear */}
      <form
        action="/leads"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        {/* Persist all multi-value selections across a fresh search. */}
        <input type="hidden" name="stage" value={stagesCsv} />
        <input type="hidden" name="tier" value={tiersCsv} />
        <input type="hidden" name="source" value={sourcesCsv} />
        <input type="hidden" name="tags" value={tagsCsv} />
        <input type="hidden" name="lastContacted" value={props.lastContacted} />
        <input type="hidden" name="enrollment" value={props.enrollment} />
        <input type="hidden" name="hasEmail" value={props.hasEmail} />
        <input type="hidden" name="perPage" value={String(props.perPage)} />

        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Search company, email, city, vertical…"
            defaultValue={props.q}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {anyFilterActive && (
          <Link
            href="/leads"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="size-3" /> Clear all
          </Link>
        )}
      </form>

      {/* Filter dropdowns row */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectDropdown
          label="Stage"
          paramName="stage"
          options={STAGES.map((s) => ({
            value: s,
            label: s[0].toUpperCase() + s.slice(1),
          }))}
          selected={props.stages}
          others={{
            q: props.q,
            tier: tiersCsv,
            source: sourcesCsv,
            tags: tagsCsv,
            lastContacted: props.lastContacted,
            enrollment: props.enrollment,
            hasEmail: props.hasEmail,
            perPage: String(props.perPage),
          }}
        />
        <MultiSelectDropdown
          label="Tier"
          paramName="tier"
          options={TIERS.map((t) => ({ value: t, label: `Tier ${t}` }))}
          selected={props.tiers}
          others={{
            q: props.q,
            stage: stagesCsv,
            source: sourcesCsv,
            tags: tagsCsv,
            lastContacted: props.lastContacted,
            enrollment: props.enrollment,
            hasEmail: props.hasEmail,
            perPage: String(props.perPage),
          }}
        />
        <MultiSelectDropdown
          label="Source"
          paramName="source"
          options={SOURCES.map((s) => ({ value: s.value, label: s.label }))}
          selected={props.sources}
          others={{
            q: props.q,
            stage: stagesCsv,
            tier: tiersCsv,
            tags: tagsCsv,
            lastContacted: props.lastContacted,
            enrollment: props.enrollment,
            hasEmail: props.hasEmail,
            perPage: String(props.perPage),
          }}
        />
        <MultiSelectDropdown
          label="Tags"
          paramName="tags"
          options={KNOWN_TAGS.map((t) => ({ value: t, label: t }))}
          selected={props.tags}
          others={{
            q: props.q,
            stage: stagesCsv,
            tier: tiersCsv,
            source: sourcesCsv,
            lastContacted: props.lastContacted,
            enrollment: props.enrollment,
            hasEmail: props.hasEmail,
            perPage: String(props.perPage),
          }}
        />
        <SingleSelectDropdown
          label="Last contacted"
          paramName="lastContacted"
          options={LAST_CONTACTED}
          selected={props.lastContacted}
          others={{
            q: props.q,
            stage: stagesCsv,
            tier: tiersCsv,
            source: sourcesCsv,
            tags: tagsCsv,
            enrollment: props.enrollment,
            hasEmail: props.hasEmail,
            perPage: String(props.perPage),
          }}
        />
        <SingleSelectDropdown
          label="Enrollment"
          paramName="enrollment"
          options={ENROLLMENT}
          selected={props.enrollment}
          others={{
            q: props.q,
            stage: stagesCsv,
            tier: tiersCsv,
            source: sourcesCsv,
            tags: tagsCsv,
            lastContacted: props.lastContacted,
            hasEmail: props.hasEmail,
            perPage: String(props.perPage),
          }}
        />
        <SingleSelectDropdown
          label="Email"
          paramName="hasEmail"
          options={HAS_EMAIL}
          selected={props.hasEmail}
          others={{
            q: props.q,
            stage: stagesCsv,
            tier: tiersCsv,
            source: sourcesCsv,
            tags: tagsCsv,
            lastContacted: props.lastContacted,
            enrollment: props.enrollment,
            perPage: String(props.perPage),
          }}
        />
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
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Active:</span>
          {chips.map((c) => (
            <Link
              key={c.href + c.label}
              href={c.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-xs text-foreground transition-colors hover:bg-secondary"
            >
              {c.label}
              <XIcon className="size-3 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Multi-select dropdown (checkbox list inside <details>) ────── */

function MultiSelectDropdown({
  label,
  paramName,
  options,
  selected,
  others,
}: {
  label: string;
  paramName: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  others: Record<string, string>;
}) {
  const count = selected.length;
  return (
    <details className="relative">
      <summary
        className={
          "inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary/40 " +
          (count > 0 ? "border-primary/50 ring-1 ring-primary/30" : "")
        }
      >
        {label}
        {count > 0 && (
          <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
            {count}
          </span>
        )}
        <span aria-hidden className="ml-1 text-muted-foreground">▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-56 rounded-md border border-border bg-card p-2 shadow-lg">
        <form action="/leads" method="get" className="space-y-1.5">
          {Object.entries(others).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {options.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-xs text-foreground hover:bg-secondary/40"
                >
                  <input
                    type="checkbox"
                    name={paramName}
                    value={opt.value}
                    defaultChecked={checked}
                    className="size-3.5 accent-primary"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <Link
              href={`/leads?${new URLSearchParams(
                Object.fromEntries(
                  Object.entries({ ...others, [paramName]: "" }).filter(
                    ([, v]) => v && v !== "any",
                  ),
                ),
              ).toString()}`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Link>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
}

/* ─── Single-select dropdown ──────────────────────────────────────── */

function SingleSelectDropdown({
  label,
  paramName,
  options,
  selected,
  others,
}: {
  label: string;
  paramName: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string;
  others: Record<string, string>;
}) {
  const isActive = selected !== "any";
  const activeLabel =
    options.find((o) => o.value === selected)?.label ?? selected;
  return (
    <details className="relative">
      <summary
        className={
          "inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary/40 " +
          (isActive ? "border-primary/50 ring-1 ring-primary/30" : "")
        }
      >
        {label}
        {isActive && (
          <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
            {activeLabel}
          </span>
        )}
        <span aria-hidden className="ml-1 text-muted-foreground">▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-52 rounded-md border border-border bg-card p-1 shadow-lg">
        <ul className="text-xs">
          {options.map((opt) => {
            const checked = opt.value === selected;
            const href = `/leads?${new URLSearchParams(
              Object.fromEntries(
                Object.entries({ ...others, [paramName]: opt.value }).filter(
                  ([, v]) => v && v !== "any",
                ),
              ),
            ).toString()}`;
            return (
              <li key={opt.value}>
                <Link
                  href={href}
                  className={
                    "block rounded-sm px-2 py-1.5 text-foreground hover:bg-secondary/40 " +
                    (checked ? "bg-secondary/60 font-medium" : "")
                  }
                >
                  {opt.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

/* ─── Per-page select ─────────────────────────────────────────────── */

function PerPageDropdown({
  perPage,
  others,
}: {
  perPage: number;
  others: Record<string, string>;
}) {
  return (
    <details className="relative ml-auto">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary/40">
        {perPage} / page
        <span aria-hidden className="ml-1 text-muted-foreground">▾</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-32 rounded-md border border-border bg-card p-1 shadow-lg">
        <ul className="text-xs">
          {PAGE_SIZES.map((n) => {
            const href = `/leads?${new URLSearchParams(
              Object.fromEntries(
                Object.entries({ ...others, perPage: String(n) }).filter(
                  ([, v]) => v && v !== "any",
                ),
              ),
            ).toString()}`;
            const active = n === perPage;
            return (
              <li key={n}>
                <Link
                  href={href}
                  className={
                    "block rounded-sm px-2 py-1.5 text-foreground hover:bg-secondary/40 " +
                    (active ? "bg-secondary/60 font-medium" : "")
                  }
                >
                  {n} / page
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
