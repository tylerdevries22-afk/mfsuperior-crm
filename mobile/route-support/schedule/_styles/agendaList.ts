import { StyleSheet } from "react-native";

import { FONTS, RADIUS_LEGACY as RADIUS, SPACING, THEME } from "@/theme";

/** The scrolling agenda: date sections and the appointment cards inside them. */
export const agendaListStyles = StyleSheet.create({
  listScroll: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  emptyListWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyListTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: THEME.text,
  },
  emptyListSub: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: THEME.textMuted,
    textAlign: "center",
  },
  dateSection: {
    marginTop: SPACING.md,
  },
  dateSectionHeader: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    marginBottom: SPACING.sm,
  },
  dateSectionHeaderToday: {
    borderBottomColor: THEME.primary,
  },
  dateSectionTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: THEME.textSecondary,
  },
  dateSectionTitleToday: {
    color: THEME.primary,
    fontFamily: FONTS.bold,
  },
  appointmentCard: {
    flexDirection: "row",
    backgroundColor: THEME.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: "stretch",
    overflow: "hidden",
    minHeight: 130,
  },
  pastCard: {
    opacity: 0.6,
  },
  appointmentTimeCol: {
    width: 52,
    marginRight: SPACING.sm,
    justifyContent: "flex-start",
  },
  appointmentTime: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: THEME.text,
  },
  appointmentDuration: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
  },
  appointmentColorBar: {
    width: 3,
    borderRadius: 2,
    alignSelf: "stretch",
    marginRight: SPACING.sm,
  },
  appointmentDetails: {
    flex: 1,
  },
  visitLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    color: THEME.primary,
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  appointmentTitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textSecondary,
    marginBottom: 2,
  },
  appointmentCustomer: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: "#FFFFFF",
    marginBottom: 3,
  },
  appointmentAddress: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textMuted,
    marginBottom: 2,
  },
  appointmentArrival: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textSecondary,
    marginBottom: 4,
  },
  appointmentChevron: {
    marginLeft: SPACING.xs,
    alignSelf: "center",
  },
  partOrderBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cardApplianceStack: {
    position: "absolute",
    bottom: 6,
    left: 10,
    alignItems: "center",
    gap: 3,
  },
  cardBrandFallback: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardApplianceImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  pastText: {
    color: THEME.textMuted,
  },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  techAvatarStack: {
    flexDirection: "row",
  },
  techAvatarWrap: {},
  techName: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textSecondary,
    flex: 1,
  },
});
