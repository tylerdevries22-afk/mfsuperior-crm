/**
 * Shared cell renderers used across the /admin tabs. Hoisted out of
 * the per-tab files so the visual language is identical regardless of
 * which tab the operator is looking at.
 */

export function Stat({
  label,
  value,
  accent = false,
  muted = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={
          accent
            ? "font-mono text-base font-semibold tabular-nums text-primary"
            : muted
              ? "font-mono text-base font-semibold tabular-nums text-muted-foreground"
              : "font-mono text-base font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

export function Row({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-1.5 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          warn
            ? "font-mono tabular-nums text-warning"
            : "font-mono tabular-nums text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}
