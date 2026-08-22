"use client";

import Image from "next/image";
import { useState } from "react";
import {
  PARTNERS,
  findPartner,
  partnerAccent,
  partnerMonogram,
  type Partner,
} from "@/data/partners";
import { cn } from "@/lib/utils";

/**
 * Logo lockups are drawn 240x64 (see public/partners/README.md), so height
 * drives the size and width follows the ratio.
 */
export const PARTNER_LOGO_RATIO = 240 / 64;

export type PartnerLogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<PartnerLogoSize, number> = {
  xs: 16,
  sm: 20,
  md: 28,
  lg: 40,
  xl: 56,
};

function resolveHeight(size: PartnerLogoSize | number | undefined): number {
  if (typeof size === "number") return size;
  return SIZE_PX[size ?? "md"];
}

export interface PartnerLogoProps {
  /** Partner slug, e.g. `ch-robinson`. Unknown slugs render the monogram. */
  slug: string;
  /** Named step or an explicit pixel height. Defaults to `md` (28px). */
  size?: PartnerLogoSize | number;
  /**
   * Directory to resolve `slug` against. Server surfaces pass the runtime list
   * from `listPartners()` so admin uploads and status flips show up; omitting
   * it falls back to the committed seed.
   */
  partners?: readonly Partner[];
  /** Overrides the accessible name. Defaults to the partner name. */
  label?: string;
  className?: string;
}

/**
 * A partner's logo on a white plate.
 *
 * The plate is deliberate: most of these lockups are dark wordmarks, and the
 * app runs a dark theme, so painting them straight onto the surface would sink
 * them into the background. A plate is also how the brands themselves expect
 * to be reproduced.
 *
 * Falls back to a brand-coloured monogram tile when the slug is unknown or the
 * file fails to load, so a missing asset never leaves a hole in a row.
 */
export function PartnerLogo({
  slug,
  size,
  partners = PARTNERS,
  label,
  className,
}: PartnerLogoProps) {
  const [failed, setFailed] = useState(false);
  const partner = findPartner(slug, partners);
  const height = resolveHeight(size);
  const name = label ?? partner?.name ?? slug;

  if (!partner || failed) {
    return (
      <span
        role="img"
        aria-label={name}
        title={name}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-sm font-semibold uppercase leading-none text-white",
          className,
        )}
        style={{
          height,
          width: height,
          backgroundColor: partnerAccent(partner),
          fontSize: Math.max(8, Math.round(height * 0.42)),
        }}
      >
        {partnerMonogram(name)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white ring-1 ring-black/10",
        className,
      )}
      style={{ height, width: Math.round(height * PARTNER_LOGO_RATIO) }}
    >
      <Image
        src={partner.logo}
        alt={name}
        title={name}
        width={Math.round(height * PARTNER_LOGO_RATIO)}
        height={height}
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
