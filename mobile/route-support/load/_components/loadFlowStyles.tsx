import { FONTS, RADIUS, SPACING, THEME } from "@/theme";
import {
  StyleSheet
} from "react-native";
import { CONNECTOR_WIDTH, H_PAD, NODE_WIDTH } from "./loadFlowParts";

export const st = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    paddingBottom: 0,
  },
  scrollWrap: {
    position: "relative",
    overflow: "hidden",
  },
  fadeEdge: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 24,
    zIndex: 10,
  },
  fadeLeft: {
    left: 0,
    backgroundColor: "transparent",
    borderRightWidth: 0,
  },
  fadeRight: {
    right: 0,
    backgroundColor: "transparent",
    borderLeftWidth: 0,
  },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingVertical: 6,
    alignItems: "center",
  },
  connectorWrap: {
    justifyContent: "center",
    alignItems: "center",
    width: CONNECTOR_WIDTH,
    marginTop: -8,
  },
  connector: {
    height: 2,
    width: CONNECTOR_WIDTH,
    borderRadius: 1,
  },
  stepNode: {
    alignItems: "center",
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: "transparent",
    width: NODE_WIDTH,
  },
  scrollActiveNode: {
    borderColor: `${THEME.primary}40`,
    backgroundColor: `${THEME.primary}08`,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  blockBadge: {
    position: "absolute",
    bottom: -2,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.warning,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontFamily: FONTS.medium,
    fontSize: 9,
    textAlign: "center",
  },
  activeLabel: {
    fontFamily: FONTS.bold,
    fontSize: 9,
  },
  skippedLabel: {
    textDecorationLine: "line-through",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
    paddingVertical: 3,
  },
  dot: {
    height: 3,
    borderRadius: 1.5,
  },
  focusedInfo: {
    alignItems: "center",
    paddingVertical: 3,
  },
  focusedInfoText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  completeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: SPACING.xs,
    backgroundColor: `${THEME.success}10`,
  },
  completeBannerText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: THEME.success,
  },
});
