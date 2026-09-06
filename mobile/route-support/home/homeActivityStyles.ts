import { StyleSheet } from "react-native";

import { FONTS, RADIUS_LEGACY as RADIUS, SPACING, THEME } from "@/theme";

export const homeActivityStyles = StyleSheet.create({
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
  loadAssets: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm, marginTop: SPACING.xs },
  loadPerson: { alignItems: "center", flexDirection: "row", flex: 1, gap: 7 },
  loadVehicle: { alignItems: "center", flexDirection: "row", flex: 1, gap: 7 },
  loadVehicleImage: { borderRadius: 8, height: 36, width: 48 },
  loadAssetLabel: { fontFamily: FONTS.semibold, fontSize: 8, color: THEME.textMuted, letterSpacing: 0.6 },
  loadAssetName: { fontFamily: FONTS.semibold, fontSize: 10, color: THEME.text, maxWidth: 100 },
  attentionTruck: { borderRadius: RADIUS.md, height: 48, width: 64 },
});
