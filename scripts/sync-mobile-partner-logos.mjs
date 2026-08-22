/**
 * Render every logo in `public/partners/*.svg` into the PNG set the mobile app
 * bundles (`mobile/assets/partners/`), at @1x/@2x/@3x.
 *
 * The web app renders the SVGs directly; React Native ships no SVG renderer
 * and its bundler needs static asset references, so the mobile side uses PNGs.
 * Those PNGs are derived artefacts — run this after changing or adding a logo
 * so the two directories cannot drift:
 *
 *     npm run partners:sync
 *
 * The base size matches the largest `PartnerLogo` step (lg = 30pt) so React
 * Native only ever scales these down. Requires `sharp`, which is already
 * present via Next's dependency tree.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "public", "partners");
const OUT = path.join(ROOT, "mobile", "assets", "partners");

/** 15:4 lockup ratio, one step above the largest rendered size. */
const BASE_HEIGHT = 32;
const BASE_WIDTH = 120;

rmSync(OUT, { force: true, recursive: true });
mkdirSync(OUT, { recursive: true });

const logos = readdirSync(SRC)
  .filter((file) => file.endsWith(".svg"))
  .sort();

for (const file of logos) {
  const slug = path.basename(file, ".svg");
  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? "" : `@${scale}x`;
    await sharp(readFileSync(path.join(SRC, file)), { density: 72 * scale * 3 })
      .resize(BASE_WIDTH * scale, BASE_HEIGHT * scale, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, `${slug}${suffix}.png`));
  }
}

console.log(`Synced ${logos.length} logos to mobile/assets/partners/`);
