import Link from "next/link";
import { Check, Minus, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Faceted left-rail filter sidebar for /leads — the Linear / Attio
 * pattern. Replaces the inline horizontal dropdown row that lived in
 * `filter-bar.tsx`.
 *
 * Why a rail instead of inline chips:
 *   • Vertically aligned facets let operators scan and click options
 *     without the cognitive overhead of opening / closing dropdowns.
 *   • Each option is one click toggle (the old dropdowns required
 *     open → check → submit → close).
 *   • Active state is visible at a glance — lime check + bold text on
 *     the active option, plus a section count badge.
 *
 * Server-rendered. Every option is a plain `<Link>` whose href has
 * the relevant CSV param toggled (value added if absent, removed if
 * present). No client JS, fully deep-linkable.
 *
 * Sections collapse via native `<details>`; defaultOpen sections
 * (Stage, Tier) start expanded so the most-used filters are
 * one-click-away even on first visit.
 */

const STAGES = ["new", "contacted", "replied", "quoted", "won", "lost"] as const;
const TIERS = ["A", "B", "C"] as const;
const SOURCES = [
  { value: "lead-gen", label: "Generated (OSM)" },
  { value: "website-scrape", label: "Generated (curated)" },
  { value: "spreadsheet", label: "Spreadsheet import" },
  { value: "website_contact", label: "Website inbound" },
  { value: "manual", label: "Manually added" },
] as const;
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
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
] as const;
const HAS_EMAIL = [
  { value: "any", label: "Any" },
  { value: "yes", label: "Has email" },
  { value: "no", label: "No email" },
] as const;

/** Email-trust facet. Multi-select so an operator can include both
 * "verified" + "guessed" while excluding "invalid", or whatever
 * combination matches the workflow at hand. Sourced from the new
 * `email_trust` column populated by the trust pipeline. */
const EMAIL_TRUST = [
  { value: "verified", label: "Verified" },
  { value: "guessed", label: "Guessed" },
  { value: "unverified", label: "Unverified" },
  { value: "invalid", label: "Invalid" },
] as const;

/** Same fallback as filter-bar; only used when the parent page didn't
 * pass `availableTags` (which currently always passes a fresh distinct
 * query result from the DB). */
const FALLBACK_TAGS = [
  "refrigerated",
  "role-account",
  "chain-store",
  "email-verified",
  "email-guessed",
  "denver-batch-1",
  "discovered-via-osm",
  "discovered-via-curated",
] as const;

/* ─── Tag taxonomy ────────────────────────────────────────────────
 *
 * Distinct tags returned from `unnest(tags)` mix three very different
 * concerns: operationally-meaningful flags an outreach operator
 * actually filters on (`refrigerated`, `role-account`), email-trust
 * pipeline state (`email-verified`, `email-website-confirmed`,
 * `email-risky`, …), and provenance markers (`denver-batch-1`,
 * `discovered-via-osm`). Rendering them all in one flat list — as the
 * old rail did — made the most-useful tags hard to find.
 *
 * `tagGroup` buckets a tag into one of four groups. The `tier-*` tags
 * are filtered out entirely (covered by the Tier facet — duplicating
 * them in a tag list is just noise).
 *
 * `formatTagLabel` pretty-prints the raw kebab-case stored in the DB
 * into something a human can scan at a glance. */

type TagGroup = "ops" | "source" | "email" | "other";

function tagGroup(tag: string): TagGroup | null {
  if (tag.startsWith("tier-")) return null; // hidden — covered by Tier facet
  if (tag === "refrigerated" || tag === "role-account" || tag === "chain-store") {
    return "ops";
  }
  if (tag.startsWith("email-")) return "email";
  if (
    tag.startsWith("denver-batch-") ||
    tag.startsWith("discovered-via-") ||
    tag === "spreadsheet-import"
  ) {
    return "source";
  }
  return "other";
}

const TAG_LABEL_OVERRIDES: Record<string, string> = {
  refrigerated: "Refrigerated",
  "role-account": "Role account (info@/sales@)",
  "chain-store": "Chain store",
  "email-verified": "Email: verified",
  "email-guessed": "Email: guessed",
  "email-unverified": "Email: unverified",
  "email-invalid": "Email: invalid",
  "email-website-confirmed": "Email: confirmed on website",
  "email-api-verified": "Email: Hunter verified",
  "email-api-invalid": "Email: Hunter invalid",
  "email-risky": "Email: risky",
  "email-role-account": "Email: role account",
  "denver-batch-1": "Denver batch 1",
  "discovered-via-osm": "Discovered via OSM",
  "discovered-via-curated": "Discovered via curated pack",
  "spreadsheet-import": "Spreadsheet import",
};

function formatTagLabel(tag: string): string {
  if (TAG_LABEL_OVERRIDES[tag]) return TAG_LABEL_OVERRIDES[tag];
  // Generic kebab → Title Case prettifier.
  return tag
    .split(/[-_]/)
    .map((s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)))
    .join(" ");
}

const TAG_GROUP_TITLES: Record<TagGroup, string> = {
  ops: "Operations",
  source: "Source markers",
  email: "Email pipeline",
  other: "Other tags",
};

export type FilterRailProps = {
  q: string;
  stages: string[];
  tiers: string[];
  sources: string[];
  tags: string[];
  /** Tags to EXCLUDE — leads carrying any of these are hidden.
   * Independent from `tags` (which is inclusive). Lets operators
   * say "non-refrigerated only" via the per-tag exclude button. */
  excludeTags: string[];
  availableTags?: string[];
  lastContacted: string;
  enrollment: string;
  hasEmail: string;
  /** CSV-multi: which email-trust buckets to include. Empty array
   * means "any trust level". */
  emailTrust: string[];
  perPage: number;
};

/** Build a `/leads?…` URL from a partial param map, dropping empty
 * and `any` sentinel values so URLs stay tidy. */
function build(params: Record<string, string | undefined>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "" && v !== "any") out.set(k, v);
  }
  const qs = out.toString();
  return qs ? `/leads?${qs}` : "/leads";
}

/** Toggle a single value inside a comma-separated CSV. */
function toggleCsv(csv: string, value: string): string {
  const set = new Set(csv ? csv.split(",").filter(Boolean) : []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set).join(",");
}

export function FilterRail(props: FilterRailProps) {
  const stagesCsv = props.stages.join(",");
  const tiersCsv = props.tiers.join(",");
  const sourcesCsv = props.sources.join(",");
  const tagsCsv = props.tags.join(",");
  const excludeTagsCsv = props.excludeTags.join(",");
  const emailTrustCsv = props.emailTrust.join(",");

  const baseParams = {
    q: props.q,
    stage: stagesCsv,
    tier: tiersCsv,
    source: sourcesCsv,
    tags: tagsCsv,
    excludeTags: excludeTagsCsv,
    lastContacted: props.lastContacted,
    enrollment: props.enrollment,
    hasEmail: props.hasEmail,
    emailTrust: emailTrustCsv,
    perPage: String(props.perPage),
  };

  const totalActive =
    props.stages.length +
    props.tiers.length +
    props.sources.length +
    props.tags.length +
    props.excludeTags.length +
    props.emailTrust.length +
    (props.lastContacted !== "any" ? 1 : 0) +
    (props.enrollment !== "any" ? 1 : 0) +
    (props.hasEmail !== "any" ? 1 : 0);

  const tagOptionsRaw =
    props.availableTags && props.availableTags.length > 0
      ? props.availableTags
      : (FALLBACK_TAGS as readonly string[]);

  // Bucket tags into the four taxonomy groups; drop the hidden
  // `tier-*` tags (already surfaced via the Tier facet).
  const groupedTags: Record<TagGroup, string[]> = {
    ops: [],
    source: [],
    email: [],
    other: [],
  };
  for (const t of tagOptionsRaw) {
    const g = tagGroup(t);
    if (g) groupedTags[g].push(t);
  }
  // Stable display order within a group: alphabetical, but with the
  // "Refrigerated" + "Role account" pair pinned to the top of Ops
  // because they're the most-used outreach filters.
  const opsPriority = new Set(["refrigerated", "role-account"]);
  groupedTags.ops.sort((a, b) => {
    const ap = opsPriority.has(a) ? 0 : 1;
    const bp = opsPriority.has(b) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.localeCompare(b);
  });
  groupedTags.source.sort();
  groupedTags.email.sort();
  groupedTags.other.sort();

  return (
    <aside
      aria-label="Lead filters"
      className="hidden w-56 shrink-0 border-r border-border bg-card/40 lg:flex lg:flex-col"
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Filters
          {totalActive > 0 && (
            <span className="ml-2 rounded-full bg-primary px-1.5 py-px text-[10px] font-medium text-primary-foreground tabular-nums">
              {totalActive}
            </span>
          )}
        </span>
        {totalActive > 0 && (
          // "Clear all" goes back to /leads with no params. The search
          // (`q`) and per-page are also dropped, matching the previous
          // FilterBar's behavior — that's what operators expect from a
          // hard reset.
          <Link
            href="/leads"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3" /> Clear
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <MultiSection
          title="Stage"
          paramName="stage"
          options={STAGES.map((s) => ({
            value: s,
            label: s[0].toUpperCase() + s.slice(1),
          }))}
          selected={props.stages}
          baseParams={baseParams}
          defaultOpen
        />
        <MultiSection
          title="Tier"
          paramName="tier"
          options={TIERS.map((t) => ({ value: t, label: `Tier ${t}` }))}
          selected={props.tiers}
          baseParams={baseParams}
          defaultOpen
        />
        <SingleSection
          title="Email"
          paramName="hasEmail"
          options={HAS_EMAIL}
          selected={props.hasEmail}
          baseParams={baseParams}
        />
        {/* Email-trust pipeline output. Operators who only want to
            send to confirmed addresses pick "verified" alone; the
            cleanup-day workflow is "guessed + unverified" so the
            list shows only candidates that need attention. */}
        <MultiSection
          title="Email trust"
          paramName="emailTrust"
          options={EMAIL_TRUST.map((t) => ({ value: t.value, label: t.label }))}
          selected={props.emailTrust}
          baseParams={baseParams}
          defaultOpen
        />
        <SingleSection
          title="Enrollment"
          paramName="enrollment"
          options={ENROLLMENT}
          selected={props.enrollment}
          baseParams={baseParams}
        />
        <SingleSection
          title="Last contacted"
          paramName="lastContacted"
          options={LAST_CONTACTED}
          selected={props.lastContacted}
          baseParams={baseParams}
        />
        <MultiSection
          title="Source"
          paramName="source"
          options={SOURCES.map((s) => ({ value: s.value, label: s.label }))}
          selected={props.sources}
          baseParams={baseParams}
        />
        {/* Grouped tag facets. Each tag row carries TWO affordances:
            include (left checkbox) and exclude (right minus). They're
            mutually exclusive — clicking include while excluded swaps
            states, and vice versa. The exclude path was added so
            operators can say "non-refrigerated leads only" without
            having to know which tags to omit. */}
        {(["ops", "source", "email", "other"] as TagGroup[]).map((g) =>
          groupedTags[g].length === 0 ? null : (
            <TagSection
              key={g}
              title={TAG_GROUP_TITLES[g]}
              tags={groupedTags[g]}
              selectedInclude={props.tags}
              selectedExclude={props.excludeTags}
              baseParams={baseParams}
              defaultOpen={g === "ops"}
              scrollable={groupedTags[g].length > 10}
            />
          ),
        )}
      </div>
    </aside>
  );
}

/* ─── Multi-select section (CSV param) ────────────────────────────── */

function MultiSection({
  title,
  paramName,
  options,
  selected,
  baseParams,
  defaultOpen = false,
  scrollable = false,
}: {
  title: string;
  paramName: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  baseParams: Record<string, string>;
  defaultOpen?: boolean;
  /** When the option list is long (e.g. tags), constrain the inner
   * scroll height so the section doesn't push the rest of the rail
   * off-screen. */
  scrollable?: boolean;
}) {
  const csv = selected.join(",");
  const count = selected.length;

  return (
    <details
      className="group border-b border-border/60 px-2 py-1 last:border-b-0 [&[open]>summary>.chev]:rotate-90"
      open={defaultOpen || count > 0}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-sm px-1 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-foreground hover:text-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="chev transition-transform text-muted-foreground">
            ›
          </span>
          {title}
          {count > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-medium normal-case tracking-normal text-primary tabular-nums">
              {count}
            </span>
          )}
        </span>
      </summary>
      <ul
        className={cn(
          "mt-1 space-y-px pl-3",
          scrollable && "max-h-56 overflow-y-auto",
        )}
      >
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          const nextCsv = toggleCsv(csv, opt.value);
          const href = build({ ...baseParams, [paramName]: nextCsv });
          return (
            <li key={opt.value}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-2 py-1 text-[12.5px] transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background",
                  )}
                  aria-hidden
                >
                  {active && <Check className="size-2.5 stroke-[3]" />}
                </span>
                <span className="truncate">{opt.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/* ─── Tag section with dual include/exclude affordances ──────────── */

function TagSection({
  title,
  tags,
  selectedInclude,
  selectedExclude,
  baseParams,
  defaultOpen = false,
  scrollable = false,
}: {
  title: string;
  tags: string[];
  selectedInclude: string[];
  selectedExclude: string[];
  baseParams: Record<string, string>;
  defaultOpen?: boolean;
  scrollable?: boolean;
}) {
  const includeSet = new Set(selectedInclude);
  const excludeSet = new Set(selectedExclude);
  // Count is per-group: how many of THIS group's tags are active in
  // either direction. Used for the chip next to the header.
  let activeInclude = 0;
  let activeExclude = 0;
  for (const t of tags) {
    if (includeSet.has(t)) activeInclude += 1;
    if (excludeSet.has(t)) activeExclude += 1;
  }
  const total = activeInclude + activeExclude;

  return (
    <details
      className="group border-b border-border/60 px-2 py-1 last:border-b-0 [&[open]>summary>.chev]:rotate-90"
      open={defaultOpen || total > 0}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-sm px-1 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-foreground hover:text-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="chev transition-transform text-muted-foreground">
            ›
          </span>
          {title}
          {activeInclude > 0 && (
            <span
              title={`${activeInclude} included`}
              className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-medium normal-case tracking-normal text-primary tabular-nums"
            >
              {activeInclude}
            </span>
          )}
          {activeExclude > 0 && (
            <span
              title={`${activeExclude} excluded`}
              className="rounded-full bg-destructive/15 px-1.5 py-px text-[10px] font-medium normal-case tracking-normal text-destructive tabular-nums"
            >
              −{activeExclude}
            </span>
          )}
        </span>
      </summary>
      <ul
        className={cn(
          "mt-1 space-y-px pl-3",
          scrollable && "max-h-64 overflow-y-auto",
        )}
      >
        {tags.map((t) => {
          const isIncluded = includeSet.has(t);
          const isExcluded = excludeSet.has(t);

          // Toggle math: clicking include adds-or-removes from the
          // include set AND clears any exclude on the same tag (you
          // can't both include and exclude the same value). Exclude
          // is the mirror.
          const nextInclude = new Set(includeSet);
          const nextExcludeOnInclude = new Set(excludeSet);
          if (isIncluded) {
            nextInclude.delete(t);
          } else {
            nextInclude.add(t);
            nextExcludeOnInclude.delete(t);
          }
          const includeHref = build({
            ...baseParams,
            tags: [...nextInclude].join(","),
            excludeTags: [...nextExcludeOnInclude].join(","),
          });

          const nextExclude = new Set(excludeSet);
          const nextIncludeOnExclude = new Set(includeSet);
          if (isExcluded) {
            nextExclude.delete(t);
          } else {
            nextExclude.add(t);
            nextIncludeOnExclude.delete(t);
          }
          const excludeHref = build({
            ...baseParams,
            tags: [...nextIncludeOnExclude].join(","),
            excludeTags: [...nextExclude].join(","),
          });

          return (
            <li key={t}>
              <div
                className={cn(
                  "group/row flex items-center gap-2 rounded-sm pr-1 text-[12.5px] transition-colors",
                  isIncluded
                    ? "bg-primary/5 text-foreground"
                    : isExcluded
                      ? "bg-destructive/5 text-foreground"
                      : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                )}
              >
                {/* Include affordance: left checkbox. Whole label
                    region is the click target for the include
                    toggle — matches the prior MultiSection UX. */}
                <Link
                  href={includeHref}
                  className="flex flex-1 items-center gap-2 rounded-sm py-1 pl-2 pr-1"
                  aria-pressed={isIncluded}
                  aria-label={
                    isIncluded
                      ? `Remove include filter ${formatTagLabel(t)}`
                      : `Include leads with ${formatTagLabel(t)}`
                  }
                >
                  <span
                    className={cn(
                      "flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border",
                      isIncluded
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background",
                    )}
                    aria-hidden
                  >
                    {isIncluded && <Check className="size-2.5 stroke-[3]" />}
                  </span>
                  <span className="truncate">{formatTagLabel(t)}</span>
                </Link>

                {/* Exclude affordance: right "minus" button.
                    Compact icon-only target — only visible on row
                    hover when neutral, always visible when active. */}
                <Link
                  href={excludeHref}
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-[3px] border transition-opacity",
                    isExcluded
                      ? "border-destructive bg-destructive text-destructive-foreground opacity-100"
                      : "border-input bg-background text-muted-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 hover:border-destructive hover:text-destructive",
                  )}
                  title={isExcluded ? "Remove exclude filter" : "Exclude leads with this tag"}
                  aria-pressed={isExcluded}
                  aria-label={
                    isExcluded
                      ? `Remove exclude filter ${formatTagLabel(t)}`
                      : `Exclude leads with ${formatTagLabel(t)}`
                  }
                >
                  <Minus className="size-2.5 stroke-[3]" aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/* ─── Single-select section (single-value param) ──────────────────── */

function SingleSection({
  title,
  paramName,
  options,
  selected,
  baseParams,
}: {
  title: string;
  paramName: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string;
  baseParams: Record<string, string>;
}) {
  const active = selected !== "any";

  return (
    <details
      className="group border-b border-border/60 px-2 py-1 last:border-b-0 [&[open]>summary>.chev]:rotate-90"
      open={active}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-sm px-1 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-foreground hover:text-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="chev transition-transform text-muted-foreground">
            ›
          </span>
          {title}
          {active && (
            <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-medium normal-case tracking-normal text-primary">
              1
            </span>
          )}
        </span>
      </summary>
      <ul className="mt-1 space-y-px pl-3">
        {options.map((opt) => {
          const isActive = selected === opt.value;
          // Tapping the already-active option is a no-op; clicking
          // another option swaps the single value. "Any" clears the
          // filter by setting the value back to the sentinel.
          const href = build({ ...baseParams, [paramName]: opt.value });
          return (
            <li key={opt.value}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-2 py-1 text-[12.5px] transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                    isActive
                      ? "border-primary bg-primary"
                      : "border-input bg-background",
                  )}
                  aria-hidden
                >
                  {isActive && (
                    <span className="size-1.5 rounded-full bg-primary-foreground" />
                  )}
                </span>
                <span className="truncate">{opt.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
