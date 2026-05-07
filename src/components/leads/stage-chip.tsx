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
