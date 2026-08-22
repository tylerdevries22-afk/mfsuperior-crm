import { StyleSheet } from "react-native";

import {
  CARD_SHADOW,
  CARD_SHADOW_SM,
  FONTS,
  RADIUS as RADII,
  RADIUS_LEGACY as RADIUS,
  SPACE,
  SPACING,
  THEME,
  TYPO as TYPE,
} from "@/theme";

/**
 * Ported verbatim from the Appliance Diagnostic Systems home at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d so the two home screens share one
 * geometry. Only the token imports change: MF exposes the same reference
 * palette, legacy radii, and card shadows through `@/theme`.
 */

export const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: SPACING.xxxl },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },

  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  heroDate: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: THEME.primary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  greetingText: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: THEME.text,
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: THEME.textMuted,
    marginTop: 2,
  },
  heroRight: { alignItems: "center", gap: 4 },
  orbContainer: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  liveIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: `${THEME.success}30`,
    alignItems: "center",
    justifyContent: "center",
  },
  liveDotInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: THEME.success,
  },
  liveText: {
    fontFamily: FONTS.semibold,
    fontSize: 9,
    color: THEME.success,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  statsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: THEME.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: THEME.border,
    ...CARD_SHADOW_SM,
  },
  statDot: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: THEME.text,
  },
  statLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 1,
  },

  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: `${THEME.orange}08`,
    borderWidth: 1,
    borderColor: `${THEME.orange}25`,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  alertIconBg: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    backgroundColor: `${THEME.orange}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  alertText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: THEME.orange,
  },

  sectionLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    color: THEME.textMuted,
    letterSpacing: 1.2,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  seeAllText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: THEME.primary,
  },

  nextJobCard: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: `${THEME.primary}25`,
    ...CARD_SHADOW,
  },
  nextJobGradient: {
    padding: SPACING.lg,
  },
  nextJobTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  nextJobTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: `${THEME.primary}18`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  nextJobTimeText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: THEME.primary,
  },
  nextJobCustomer: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: THEME.text,
    marginBottom: 6,
  },
  nextJobMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  nextJobAddress: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: THEME.textSecondary,
    flex: 1,
  },
  nextJobActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  nextJobBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: `${THEME.primary}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  nextJobBtnText: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: THEME.primary,
  },

  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  actionCard: {
    backgroundColor: THEME.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingVertical: SPACING.lg,
    alignItems: "center",
    gap: SPACING.sm,
    ...CARD_SHADOW_SM,
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    color: THEME.textSecondary,
  },

  activityList: {
    backgroundColor: THEME.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: "hidden",
    marginBottom: SPACING.lg,
    ...CARD_SHADOW_SM,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityName: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: THEME.text,
  },
  activitySub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 1,
  },
  activityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  activityBadgeText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    textTransform: "capitalize",
  },
  partOrderBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: `${THEME.danger}08`,
    borderWidth: 1,
    borderColor: `${THEME.danger}20`,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  inlineErrorText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: THEME.danger,
  },

  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
  },
  syncText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textMuted,
  },
});

export const adminS = StyleSheet.create({
  /* ── Faithful-Heart-shaped dashboard layout ─────────────────────────────
     A 24pt gutter with a 16pt gap on the scroll container is the whole
     rhythm: sections carry no vertical margins of their own, so spacing can
     only be wrong in one place. */
  scroll: {
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.xl,
    gap: SPACE.md,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.md },
  headerCopy: { flex: 1, gap: 2 },
  /* Pulled up under the title, which carries its own line-height slack. */
  headerSubtitle: { ...TYPE.caption, color: THEME.textSecondary, marginTop: -2 },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },

  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.xs,
  },
  attentionCopy: { flex: 1, gap: 2 },
  attentionTitle: { ...TYPE.rowTitle, color: THEME.text },
  attentionHint: { ...TYPE.subtitle, color: THEME.textSecondary },
  attentionButton: {
    minHeight: 40,
    paddingHorizontal: SPACE.md,
    borderRadius: RADII.pill,
    borderWidth: 1.5,
    borderColor: THEME.text,
    alignItems: "center",
    justifyContent: "center",
  },
  attentionButtonText: { ...TYPE.captionStrong, color: THEME.text },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    width: "47.5%",
    backgroundColor: THEME.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: SPACING.md,
    alignItems: "flex-start",
    gap: SPACING.xs,
    ...CARD_SHADOW_SM,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statVal: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: THEME.text,
    letterSpacing: -0.5,
  },
  statLbl: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: THEME.textMuted,
  },
  techChip: {
    alignItems: "center",
    gap: 6,
    minWidth: 56,
  },
  techChipAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: THEME.border,
  },
  techChipInitials: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: THEME.textMuted,
  },
  techChipName: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: THEME.textSecondary,
    maxWidth: 56,
    textAlign: "center",
  },
});
