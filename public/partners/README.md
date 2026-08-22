# Partner logos

Every file here is referenced by `logo` in `src/data/partners.ts` and rendered
through `<PartnerLogo />` (`src/components/partners/partner-logo.tsx`).

## Format

- Wide lockup, `viewBox="0 0 240 64"` (15:4) — mark on the left, wordmark on
  the right. `<PartnerLogo />` scales by height and keeps that ratio.
- Transparent background. Logos are drawn on a white plate by the component so
  dark wordmarks stay legible in the app's dark theme.
- Wordmark runs use `textLength` + `lengthAdjust="spacingAndGlyphs"` so a run
  occupies the same box no matter which font resolves from the stack.

## Provenance

The two `active` partners were drawn from the reference images supplied with
the request; the sampled brand colours are exact (Target red `#CC0000`,
C.H. Robinson blue `#00A0DF`). The `target` partners are brand-accurate
renditions, not official press-kit vectors — this session's network policy
blocks every logo host (Wikimedia, Brandfetch, seeklogo, and each company's
own domain), so the official files could not be downloaded.

Brand colours sourced from public colour references: RXO `#00F49C`/`#0F0F0F`,
XPO `#CC0000`, J.B. Hunt `#FFDB00`, Old Dominion `#186944`/`#C87933`,
Home Depot `#F96302`, Lowe's `#012169` (PMS 280 C), Amazon `#FF9900`.
Curri (black/teal) and Estes (black/red) follow their published palettes.
DAT, Truckstop, Roadie, Frayt, GoShare, North Park Transportation and Warp
are approximations — their hex values are not published anywhere reachable
from here.

## Replacing one with an official asset

Drop the official file in this directory and point the partner's `logo` at it:

```ts
{ slug: "rxo", name: "RXO", logo: "/partners/rxo-official.svg", ... }
```

Nothing else changes — every surface reads the path from `src/data/partners.ts`.
Uploads through **Admin → Partners** land here too, alongside an entry in
`src/data/partners.custom.json`.

## The mobile copy

React Native ships no SVG renderer and its bundler needs static asset
references, so the mobile app bundles PNGs in `mobile/assets/partners/`
rendered from these same SVGs at @1x/@2x/@3x. They are derived artefacts —
after adding or changing a logo here, run:

```
npm run partners:sync
```

Then add the partner to `mobile/domain/partners.ts` as well if it is new; that
file mirrors `src/data/partners.ts` with `require()`d PNG handles.

Logos are third-party trademarks used nominatively to identify each partner.
