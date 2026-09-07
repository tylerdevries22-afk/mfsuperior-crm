import { alpha, ramp } from "../alpha";
import { AA_NORMAL, contrastRatio } from "../contrast";
import { DARK_THEME, LIGHT_THEME, type ThemePalette } from "../palette";
import { ANIM, CARD_SHADOW, CARD_SHADOW_SM, SPACING, THEME, TYPO_LEGACY } from "../legacy";
import { RADIUS, SPACE, SIZE, TYPO } from "../tokens";

function expectPaletteContrast(theme: ThemePalette): void {
  const surfaces = [theme.background, theme.surface, theme.surfaceElevated, theme.surfaceBright];
  for (const surface of surfaces) {
    expect(contrastRatio(theme.text, surface)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrastRatio(theme.textSecondary, surface)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrastRatio(theme.textMuted, surface)).toBeGreaterThanOrEqual(AA_NORMAL);
  }
  expect(contrastRatio(theme.primaryForeground, theme.primary)).toBeGreaterThanOrEqual(AA_NORMAL);
  expect(contrastRatio(theme.success, theme.successMuted)).toBeGreaterThanOrEqual(AA_NORMAL);
  expect(contrastRatio(theme.warning, theme.warningMuted)).toBeGreaterThanOrEqual(AA_NORMAL);
  expect(contrastRatio(theme.danger, theme.dangerMuted)).toBeGreaterThanOrEqual(AA_NORMAL);
  expect(contrastRatio(theme.info, theme.infoMuted)).toBeGreaterThanOrEqual(AA_NORMAL);
}

describe("theme foundations", () => {
  /**
   * These values are pinned to Apple's HIG rather than to the ported appliance
   * app's geometry: an 8pt spacing grid, continuous-curve radii, and roles that
   * land on real SF text styles at the default Dynamic Type size. Changing one
   * is a deliberate design decision, so it should fail here first.
   */
  it("pins the Apple type ramp and 8pt geometry", () => {
    expect(SPACE).toEqual({ xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 });
    expect(RADIUS).toEqual({ sm: 10, md: 14, lg: 20, xl: 28, pill: 999 });
    expect(SIZE.button).toEqual({ sm: 44, md: 48, lg: 56 });
    expect(SIZE.hit).toBe(44);
    expect(TYPO.screenTitle).toMatchObject({ fontSize: 34, lineHeight: 41 });
    expect(TYPO.body).toMatchObject({ fontSize: 17, lineHeight: 22 });
    expect(TYPO.cardTitle).toMatchObject({ fontSize: 17, lineHeight: 22 });
    expect(TYPO.section).toMatchObject({ fontSize: 22, lineHeight: 28 });
    expect(TYPO.heading).toMatchObject({ fontSize: 20, lineHeight: 25 });
    expect(TYPO.caption).toMatchObject({ fontSize: 13, lineHeight: 18 });
  });

  it("keeps every type role at or above Apple's 11pt legibility floor", () => {
    for (const [role, style] of Object.entries(TYPO)) {
      expect(`${role}:${style.fontSize}`).toBe(`${role}:${Math.max(11, style.fontSize)}`);
    }
  });

  it("keeps spacing on the 4pt grid", () => {
    for (const [name, value] of Object.entries(SPACE)) {
      expect(`${name}:${value % 4}`).toBe(`${name}:0`);
    }
  });

  it("keeps the pinned reference compatibility surface intact", () => {
    expect(SPACING).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 });
    expect(TYPO_LEGACY.hero).toMatchObject({ fontSize: 28, lineHeight: 36 });
    expect(ANIM).toMatchObject({ pressScale: 0.97, duration: { fast: 150, normal: 250, slow: 400 } });
    expect(THEME).toHaveProperty("primary");
    expect(CARD_SHADOW).toBeDefined();
    expect(CARD_SHADOW_SM).toBeDefined();
  });

  it("builds clamped alpha ramps and rejects malformed tokens", () => {
    expect(alpha("#D4E030", 0.5)).toBe("#D4E03080");
    expect(alpha("#D4E030", -1)).toBe("#D4E03000");
    expect(alpha("#D4E030", 2)).toBe("#D4E030FF");
    expect(ramp("#D4E030").muted).toBe("#D4E03020");
    expect(() => alpha("rgba(0,0,0,0.5)", 0.5)).toThrow(RangeError);
  });

  it("keeps every text and semantic pairing at WCAG AA contrast", () => {
    expectPaletteContrast(LIGHT_THEME);
    expectPaletteContrast(DARK_THEME);
  });
});
