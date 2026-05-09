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
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium leading-none ring-1 ring-inset",
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
        "inline-flex size-5 items-center justify-center rounded-sm font-mono text-xs font-semibold tabular-nums",
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

const TAG_STYLE: Record<string, string> = {
  refrigerated:
    "bg-cyan-100 text-cyan-900 ring-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-100 dark:ring-cyan-700",
  "needs-manual-email":
    "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700",
  "email-unverified":
    "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800",
  freemail:
    "bg-muted text-muted-foreground ring-border",
  "role-account":
    "bg-muted text-muted-foreground ring-border",
  "chain-store":
    "bg-secondary text-secondary-foreground ring-border",
  "catch-all":
    "bg-muted text-muted-foreground ring-border",
  "email-guessed":
    "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700",
  "tier-untriaged":
    "bg-muted text-muted-foreground ring-border",
};

const TAG_LABEL: Record<string, string> = {
  refrigerated: "❄ Refrigerated",
  "needs-manual-email": "⚠ Needs email",
  "email-unverified": "Email unverified",
  freemail: "Free webmail",
  "role-account": "Role account",
  "chain-store": "Chain store",
  "catch-all": "Catch-all domain",
  "email-guessed": "Email guessed",
  "tier-untriaged": "Untriaged",
};

// Hide noise tags (tier markers, vertical labels — already shown in their
// own columns). `tier-untriaged` is the one tier-* tag we want visible.
const HIDDEN_EXACT = new Set([
  "tier-A",
  "tier-B",
  "tier-C",
  "Restaurant",
  "Restaurants & food",
  "Big-box retail",
  "Freight broker / 3PL",
  "Small business",
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
  const visible = tags
    .filter(
      (t) => !HIDDEN_PREFIXES.some((p) => t.startsWith(p)) && !HIDDEN_EXACT.has(t),
    )
    .slice(0, max);
  if (visible.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-none ring-1 ring-inset",
            TAG_STYLE[tag] ?? "bg-muted text-muted-foreground ring-border",
          )}
        >
          {TAG_LABEL[tag] ?? tag}
        </span>
      ))}
    </div>
  );
}
