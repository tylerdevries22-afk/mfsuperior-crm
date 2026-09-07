import { StyleSheet } from "react-native";

import { FONTS, THEME } from "@/theme";

export const styles = StyleSheet.create({
  fill: { backgroundColor: THEME.background, flex: 1 },
  footer: { marginTop: 18 },
  row: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowMeta: { color: THEME.textMuted, fontFamily: FONTS.regular, fontSize: 12 },
  rowSelected: { backgroundColor: THEME.surfaceElevated },
  rowStatusDot: {
    borderColor: THEME.surface,
    borderRadius: 5,
    borderWidth: 2,
    bottom: -1,
    height: 10,
    position: "absolute",
    right: -1,
    width: 10,
  },
  rowTitle: { color: THEME.text, fontFamily: FONTS.semibold, fontSize: 15 },
  sectionLabel: {
    color: THEME.textMuted,
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sheetBody: { paddingBottom: 140 },
});
