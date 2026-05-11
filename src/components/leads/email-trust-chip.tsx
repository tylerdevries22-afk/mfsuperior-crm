import { CheckCircle2, AlertCircle, HelpCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact pill that surfaces the result of the email-trust pipeline
 * (src/lib/leads/email-trust.ts). Used in:
 *   • LeadsTable rows — next to the email address
 *   • LeadDrawer Contact section
 *   • /leads/[id] full page
 *
 * Color language matches the existing CRM palette: lime = good
 * (verified), warning = caution (guessed / unverified), destructive
 * = bad (invalid).
 *
 * Tooltip via the native `title` attribute keeps the row height
 * unchanged at compact density. A richer hover card lives behind
 * the chip in the drawer where there's vertical space for it.
 */

type Trust = "verified" | "guessed" | "unverified" | "invalid" | null | undefined;

const STYLES: Record<
  Exclude<Trust, null | undefined>,
  {
    Icon: typeof CheckCircle2;
    label: string;
    classes: string;
    title: string;
  }
> = {
  verified: {
    Icon: CheckCircle2,
    label: "Verified",
    classes:
      "border-primary/40 bg-primary/10 text-primary",
    title:
      "Confirmed by a website mailto: scrape or by an upstream verification pipeline (Hunter / verified quick-add). Safe to send.",
  },
  guessed: {
    Icon: AlertCircle,
    label: "Guessed",
    classes:
      "border-warning/40 bg-warning/10 text-warning",
    title:
      "Role-pattern address (info@ / sales@ / dispatch@). Passed MX but was never confirmed to be a monitored mailbox. May still work for B2B cold outreach but treat as low-confidence.",
  },
  unverified: {
    Icon: HelpCircle,
    label: "Unverified",
    classes:
      "border-border bg-secondary/40 text-muted-foreground",
    title:
      "Passed syntax + MX but has no upstream verification record (legacy import or manual entry). Re-run the trust pipeline from /admin to upgrade.",
  },
  invalid: {
    Icon: XCircle,
    label: "Invalid",
    classes:
      "border-destructive/40 bg-destructive/10 text-destructive",
    title:
      "Failed validation (no MX records, disposable provider, or syntax error). Lead has been archived + tagged email-invalid.",
  },
};

export function EmailTrustChip({
  trust,
  size = "sm",
  showLabel = true,
}: {
  trust: Trust;
  size?: "xs" | "sm";
  /** Render the text label next to the icon. When false, only the
   * icon shows (useful in dense rows where the email cell is the
   * primary signal). */
  showLabel?: boolean;
}) {
  // Null trust = never run through the pipeline yet. Show a neutral
  // hint so the operator knows it's safe to run a backfill.
  if (!trust) {
    return (
      <span
        title="Not yet classified — run 'Re-validate emails' from /admin Operations."
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-background px-1.5 py-px text-muted-foreground/70",
          size === "xs" ? "text-[9px]" : "text-[10px]",
        )}
      >
        <HelpCircle className={size === "xs" ? "size-2.5" : "size-3"} />
        {showLabel && <span>?</span>}
      </span>
    );
  }

  const meta = STYLES[trust];
  const Icon = meta.Icon;
  return (
    <span
      title={meta.title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-medium",
        meta.classes,
        size === "xs" ? "text-[9px]" : "text-[10px]",
      )}
    >
      <Icon className={size === "xs" ? "size-2.5" : "size-3"} />
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}
