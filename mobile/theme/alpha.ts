const SIX_DIGIT_HEX = /^#[0-9a-fA-F]{6}$/;

/** Append an alpha channel to a six-digit hex color. */
export function alpha(hex: string, ratio: number): string {
  if (!SIX_DIGIT_HEX.test(hex)) {
    if (process.env.NODE_ENV !== "production") {
      throw new RangeError(`alpha() needs a #RRGGBB token, got "${hex}"`);
    }
    return hex;
  }

  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const channel = Math.round(clampedRatio * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

  return `${hex}${channel}`;
}

export const TINT = {
  ghost: 0.031,
  faint: 0.063,
  soft: 0.082,
  gentle: 0.094,
  muted: 0.125,
  medium: 0.188,
  strong: 0.251,
  heavy: 0.502,
} as const;

export type TintWeight = keyof typeof TINT;
export type TintRamp = Readonly<Record<TintWeight, string>>;

/** Build the complete named alpha ramp for one color token. */
export function ramp(hex: string): TintRamp {
  const entries = Object.entries(TINT).map(([name, ratio]) => [name, alpha(hex, ratio)]);
  return Object.fromEntries(entries) as TintRamp;
}
