import { cn } from "@/lib/utils";

const STAGE_STYLE: Record<string, string> = {
  new: "bg-stage-new/15 text-stage-new ring-stage-new/30",
  contacted: "bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-900 dark:text-brand-100 dark:ring-brand-800",
  replied: "bg-stage-replied/15 text-stage-replied ring-stage-replied/30",
  quoted: "bg-stage-quoted/20 text-stage-quoted ring-stage-quoted/40",
  won: "bg-stage-won/15 text-stage-won ring-stage-won/30",
  lost: "bg-stage-lost/20 text-muted-foreground ring-border",
};

const STAGE_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

export function StageChip({ stage, className }: { stage: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ring-1 ring-inset",
        STAGE_STYLE[stage] ?? STAGE_STYLE.new,
        className,
      )}
    >
      {STAGE_LABEL[stage] ?? stage}
    </span>
  );
}

const TIER_STYLE: Record<string, string> = {
  A: "bg-brand-600 text-primary-foreground",
  B: "bg-foreground text-background",
  C: "bg-muted text-muted-foreground",
};

export function TierChip({ tier, className }: { tier: string | null; className?: string }) {
  if (!tier) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-full font-mono text-xs font-semibold tabular-nums",
        TIER_STYLE[tier] ?? TIER_STYLE.C,
        className,
      )}
      aria-label={`Tier ${tier}`}
    >
      {tier}
    </span>
  );
}

/* ── Tag badges (renders the interesting tags from leads.tags[]) ─── */

// Color language:
//   • refrigerated → cyan (cold-chain visual cue)
//   • email-guessed / -unverified / -risky → amber (caution)
//   • email-invalid / -api-invalid → destructive (deletion candidate)
//   • email-verified / -api-verified / -website-confirmed → primary (lime)
//   • everything else → neutral muted ring
const TAG_STYLE: Record<string, string> = {
  refrigerated:
    "bg-cyan-100 text-cyan-900 ring-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-100 dark:ring-cyan-700",
  "needs-manual-email":
    "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700",
  "email-unverified":
    "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800",
  "email-guessed":
    "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700",
  "email-risky":
    "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700",
  "email-verified":
    "bg-brand-100 text-brand-800 ring-brand-300 dark:bg-brand-900/40 dark:text-brand-100 dark:ring-brand-700",
  "email-api-verified":
    "bg-brand-100 text-brand-800 ring-brand-300 dark:bg-brand-900/40 dark:text-brand-100 dark:ring-brand-700",
  "email-website-confirmed":
    "bg-brand-100 text-brand-800 ring-brand-300 dark:bg-brand-900/40 dark:text-brand-100 dark:ring-brand-700",
  "email-invalid":
    "bg-destructive/10 text-destructive ring-destructive/40",
  "email-api-invalid":
    "bg-destructive/10 text-destructive ring-destructive/40",
  freemail:
    "bg-muted text-muted-foreground ring-border",
  "role-account":
    "bg-secondary text-secondary-foreground ring-border",
  "chain-store":
    "bg-secondary text-secondary-foreground ring-border",
  "catch-all":
    "bg-muted text-muted-foreground ring-border",
  "tier-untriaged":
    "bg-muted text-muted-foreground ring-border",
};

const TAG_LABEL: Record<string, string> = {
  refrigerated: "Refrigerated",
  "needs-manual-email": "Needs email",
  "email-unverified": "Email: unverified",
  "email-guessed": "Email: guessed",
  "email-verified": "Email: verified",
  "email-website-confirmed": "Email: on website",
  "email-api-verified": "Email: Hunter ✓",
  "email-api-invalid": "Email: Hunter ✗",
  "email-invalid": "Email: invalid",
  "email-risky": "Email: risky",
  freemail: "Free webmail",
  "role-account": "Role account",
  "chain-store": "Chain store",
  "catch-all": "Catch-all domain",
  "tier-untriaged": "Untriaged",
  "denver-batch-1": "Denver batch 1",
  "discovered-via-osm": "Found via OSM",
  "discovered-via-curated": "From curated list",
};

// Hide noise tags. `tier-*` markers duplicate the Tier column; the
// vertical-label tags duplicate the Vertical column; and `email-role-
// account` is a legacy spelling of `role-account` we now render once.
//
// `refrigerated` and `Dry Van` are also hidden here — we render a
// derived "cold-chain" badge below based on whether `refrigerated`
// is present so each lead gets EXACTLY ONE of Refrigerated /
// Non-refrigerated (never both, never neither). This matches the
// new dedicated Cold-chain filter in the rail.
const HIDDEN_EXACT = new Set([
  "tier-A",
  "tier-B",
  "tier-C",
  "Restaurant",
  "Restaurants & food",
  "Big-box retail",
  "Freight broker / 3PL",
  "Small business",
  "email-role-account",
  "refrigerated",
  "Dry Van",
  "dry-van",
]);
const HIDDEN_PREFIXES: string[] = [];

export function TagBadges({
  tags,
  className,
  max = 3,
}: {
  tags: string[];
  className?: string;
  max?: number;
}) {
  // Derived cold-chain badge — always rendered, always exactly one.
  // Pinned first in the row so it reads at a glance as the lead's
  // primary freight-type indicator.
  const isRefrigerated = tags.includes("refrigerated");
  const coldBadge = {
    label: isRefrigerated ? "Refrigerated" : "Non-refrigerated",
    classes: isRefrigerated
      ? "bg-cyan-100 text-cyan-900 ring-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-100 dark:ring-cyan-700"
      : "bg-muted text-muted-foreground ring-border",
  };

  const visible = tags
    .filter(
      (t) => !HIDDEN_PREFIXES.some((p) => t.startsWith(p)) && !HIDDEN_EXACT.has(t),
    )
    .slice(0, Math.max(0, max - 1));

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium leading-none ring-1 ring-inset",
          coldBadge.classes,
        )}
      >
        {coldBadge.label}
      </span>
      {visible.map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium leading-none ring-1 ring-inset",
            TAG_STYLE[tag] ?? "bg-muted text-muted-foreground ring-border",
          )}
        >
          {TAG_LABEL[tag] ?? tag}
        </span>
      ))}
    </div>
  );
}
