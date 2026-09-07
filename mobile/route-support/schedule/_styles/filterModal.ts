import { StyleSheet } from "react-native";

import { FONTS, RADIUS_LEGACY as RADIUS, SPACING, THEME } from "@/theme";

/** The filter sheet, its checkbox rows, and the pull-to-refresh update banner. */
export const filterModalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: THEME.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.xl,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: THEME.text,
  },
  filterSectionLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: THEME.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  filterRowText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: THEME.text,
    flex: 1,
  },
  filterRowTextActive: {
    color: THEME.primary,
    fontFamily: FONTS.semibold,
  },
  filterCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: THEME.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  filterCheckboxBlack: {
    borderColor: THEME.text,
  },
  filterCheckboxActive: {
    backgroundColor: THEME.primary,
  },
  modalDoneBtn: {
    marginTop: SPACING.xl,
    backgroundColor: THEME.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  modalDoneBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: "#FFF",
  },
  updateBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: THEME.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  updateBannerText: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: "#fff",
  },
});
