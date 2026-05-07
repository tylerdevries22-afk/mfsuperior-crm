/**
 * Vertical-specific personalization snippets, taken verbatim from
 * `02_Email_Template.md`. The renderer matches a lead's `vertical` field
 * against the keys (case-insensitive substring match) and falls back to
 * a generic line when no vertical maps cleanly.
 */
export const PERSONALIZATION_SNIPPETS: Record<string, string> = {
  "beverage distributor":
    "your overnight pre-open restock window into metro on/off-premise accounts",
  "wholesale bakery":
    "your daily pre-open delivery cadence into restaurants and cafés",
  "foodservice":
    "your same-day-window restaurant deliveries that need a carrier who actually shows up",
  "produce":
    "your same-day-window restaurant deliveries that need a carrier who actually shows up",
  "wholesale florist":
    "your AM delivery cadence into retail florists across the Front Range",
  "florist":
    "your AM delivery cadence into retail florists across the Front Range",
  "3pl":
    "your need for trusted overflow carriers when your primary network is at capacity",
  "freight broker":
    "your need for trusted overflow carriers when your primary network is at capacity",
  "building materials":
    "your pre-open jobsite delivery requirements",
  "hvac":
    "your inter-branch and contractor delivery rhythm",
  "plumbing supply":
    "your inter-branch and contractor delivery rhythm",
  "auto parts":
    "your early-AM dealer-to-dealer hot-shot freight",
  "print":
    "your event and install delivery work that lives in evening windows",
  "sign":
    "your event and install delivery work that lives in evening windows",
  "auction house":
    "your post-event pickup and liftgate furniture moves",
  "mattress":
    "your liftgate-required final-mile delivery",
  "furniture":
    "your liftgate-required final-mile delivery",
};

const GENERIC_FALLBACK =
  "your Denver-metro density and the kind of liftgate-required, time-windowed delivery work we're built for";

export function snippetForVertical(vertical: string | null | undefined): string {
  if (!vertical) return GENERIC_FALLBACK;
  const v = vertical.toLowerCase();
  for (const [key, snippet] of Object.entries(PERSONALIZATION_SNIPPETS)) {
    if (v.includes(key)) return snippet;
  }
  return GENERIC_FALLBACK;
}
