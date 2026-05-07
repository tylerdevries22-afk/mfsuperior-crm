import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium leading-none ring-1 ring-inset",
  {
    variants: {
      variant: {
        neutral:
          "bg-secondary text-secondary-foreground ring-border",
        brand:
          "bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-900 dark:text-brand-100 dark:ring-brand-800",
        success:
          "bg-success/10 text-success ring-success/20",
        warning:
          "bg-warning/15 text-warning-foreground ring-warning/30 dark:text-warning",
        danger:
          "bg-destructive/10 text-destructive ring-destructive/20",
        muted:
          "bg-muted text-muted-foreground ring-border",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
