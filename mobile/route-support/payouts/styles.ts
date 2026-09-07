import { StyleSheet } from "react-native";

import { RADIUS, SPACE, TYPO } from "@/theme";

export const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  error: {
    alignItems: "flex-start",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
  },
  errorText: { ...TYPO.caption, flex: 1 },
  fill: { flex: 1 },
  net: { ...TYPO.rowTitle },
  privacy: { alignItems: "flex-start", borderTopWidth: 1, flexDirection: "row", gap: SPACE.xs, paddingTop: SPACE.sm },
  privacyText: { ...TYPO.subtitle, flex: 1, lineHeight: 16 },
  sheetBody: { paddingBottom: SPACE.md },
  total: { flex: 1, gap: 2 },
  totalLabel: { ...TYPO.metricLabel },
  totalValue: { ...TYPO.metric, fontSize: 24, lineHeight: 28 },
  totalsRow: { flexDirection: "row", gap: SPACE.md },
  trailing: { alignItems: "flex-end", gap: SPACE.xxs },
});
