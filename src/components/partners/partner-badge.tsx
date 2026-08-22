"use client";

import { PARTNERS, findPartner, type Partner } from "@/data/partners";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PartnerLogo, type PartnerLogoSize } from "./partner-logo";

export interface PartnerBadgeProps {
  slug: string;
  size?: PartnerLogoSize | number;
  /** Runtime directory; see `PartnerLogo` for why this is threaded through. */
  partners?: readonly Partner[];
  /** Hide the status pill where the surrounding row already conveys it. */
  showStatus?: boolean;
  /** Hide the name where the logo alone is enough (tight cells). */
  showName?: boolean;
  /** Shown instead of the partner name — e.g. the raw slug on unknown data. */
  fallbackName?: string;
  className?: string;
}

/**
 * Logo + name + status pill. The standard way to render a partner anywhere a
 * customer or broker is named.
 */
export function PartnerBadge({
  slug,
  size = "sm",
  partners = PARTNERS,
  showStatus = true,
  showName = true,
  fallbackName,
  className,
}: PartnerBadgeProps) {
  const partner = findPartner(slug, partners);
  const name = partner?.name ?? fallbackName ?? slug;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <PartnerLogo slug={slug} size={size} partners={partners} label={name} />
      {showName && (
        <span className="truncate text-sm font-medium text-foreground">
          {name}
        </span>
      )}
      {showStatus && partner && (
        <Badge variant={partner.status === "active" ? "success" : "muted"}>
          {partner.status === "active" ? "Active" : "Target"}
        </Badge>
      )}
    </span>
  );
}
