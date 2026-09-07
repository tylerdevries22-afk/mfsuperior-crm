import { StyleSheet } from "react-native";

import { FONTS, RADIUS_LEGACY } from "../../theme";

export const styles = StyleSheet.create({
  fullWidth: { alignSelf: "stretch" },
  gradientStop: {
    bottom: -12,
    position: "absolute",
    right: -24,
    top: -12,
    transform: [{ skewX: "-12deg" }],
  },
  stopTwo: { width: "82%" },
  stopThree: { width: "62%" },
  stopFour: { width: "42%" },
  stopFive: { width: "22%" },
  topHighlight: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderTopLeftRadius: RADIUS_LEGACY.lg,
    borderTopRightRadius: RADIUS_LEGACY.lg,
    height: "45%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  metalShadow: {
    elevation: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
  },
  metalBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: RADIUS_LEGACY.lg,
    borderWidth: 1.5,
  },
  primaryText: {
    fontFamily: FONTS.bold,
    letterSpacing: 0.3,
    textShadowColor: "rgba(255,255,255,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  variantText: { fontFamily: FONTS.bold, letterSpacing: 0.2 },
});
