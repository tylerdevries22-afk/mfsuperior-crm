import { StyleSheet } from "react-native";

import { FONTS, RADIUS, RADIUS_DENSE, SPACING, THEME } from "@/theme";

/** Screen frame, header actions, the horizontal calendar strip and the list/day view toggle. */
export const chromeStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: `${THEME.primary}15`,
  },
  headerAddBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: `${THEME.primary}15`,
  },
  floatingTodayWrap: {
    position: "absolute",
    bottom: 90,
    alignSelf: "center",
    zIndex: 50,
  },
  floatingTodayBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: THEME.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingTodayText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: "#FFF",
  },
  calendarStrip: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    paddingVertical: SPACING.sm,
  },
  calendarScroll: {
    paddingHorizontal: SPACING.sm,
    gap: 2,
  },
  calendarDay: {
    alignItems: "center",
    width: 44,
    paddingVertical: SPACING.xs,
  },
  calendarDaySelected: {},
  calendarDayLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: THEME.textMuted,
    marginBottom: 4,
  },
  calendarDayLabelSelected: {
    color: THEME.text,
  },
  calendarDayNum: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayNumSelected: {
    backgroundColor: THEME.primary,
  },
  calendarDayNumToday: {
    borderWidth: 2,
    borderColor: THEME.primary,
  },
  calendarDayNumText: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: THEME.textSecondary,
  },
  calendarDayNumTextSelected: {
    color: "#FFF",
  },
  calendarDayNumTextToday: {
    color: THEME.primary,
  },
  calendarDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.primary,
    marginTop: 3,
  },
  techFilterRow: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: 2,
  },
  viewToggle: {
    flexDirection: "row",
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
    backgroundColor: THEME.surface,
    borderRadius: RADIUS.sm,
    padding: 3,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: RADIUS_DENSE.sm,
  },
  viewToggleBtnActive: {
    backgroundColor: `${THEME.primary}20`,
  },
  viewToggleText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: THEME.textMuted,
  },
  viewToggleTextActive: {
    color: THEME.text,
    fontFamily: FONTS.semibold,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
