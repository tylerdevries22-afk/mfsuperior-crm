import { StyleSheet } from "react-native";

import { FONTS, SPACING, THEME } from "@/theme";
import { HOUR_HEIGHT } from "../utils";

/** The day view: hour gutter, hour grid, now-line and the positioned load blocks. */
export const dayTimelineStyles = StyleSheet.create({
  dayViewContainer: {
    flexDirection: "row",
    paddingTop: SPACING.sm,
  },
  timeGutter: {
    width: 52,
    paddingLeft: SPACING.sm,
  },
  hourRow: {
    height: HOUR_HEIGHT,
    justifyContent: "flex-start",
    paddingTop: 2,
  },
  hourLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textMuted,
  },
  dayGrid: {
    flex: 1,
    position: "relative",
    marginRight: SPACING.md,
  },
  hourGridRow: {
    height: HOUR_HEIGHT,
    justifyContent: "flex-start",
  },
  hourGridLine: {
    height: 1,
    backgroundColor: THEME.border,
    marginTop: 1,
  },
  nowLine: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
    marginLeft: -4,
  },
  nowLineBar: {
    flex: 1,
    height: 2,
    backgroundColor: "#FF3B30",
  },
  dayViewBlock: {
    position: "absolute",
    borderRadius: 6,
    padding: 4,
    overflow: "hidden",
  },
  dayViewVisitLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 9,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  dayViewBlockTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: "#FFF",
  },
  dayViewBlockAddr: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
  },
  dayViewBlockDesc: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
  },
  dayBlockTechRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  dayBlockTechChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  dayBlockTechName: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: "rgba(255,255,255,0.9)",
  },
  dayBlockApplianceStack: {
    position: "absolute",
    bottom: 4,
    left: 4,
    alignItems: "center",
    gap: 2,
  },
  dayBlockBrandFallback: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  dayBlockApplianceImage: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
});
