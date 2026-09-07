import { StyleSheet } from "react-native";

import { SPACE, TYPO } from "@/theme";

/** Shared styles for the trip history screen, its summary, and its rows. */
export const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  estimateNote: { ...TYPO.subtitle, lineHeight: 16 },
  fill: { flex: 1 },
  group: { gap: SPACE.xs },
  onTimeRow: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: SPACE.xs,
    paddingTop: SPACE.sm,
  },
  onTimeText: { ...TYPO.caption, flex: 1 },
  total: { alignItems: "center", flex: 1, gap: 2 },
  totalLabel: { ...TYPO.metricLabel },
  totalValue: { ...TYPO.metric, fontSize: 22, lineHeight: 26 },
  totalsRow: { flexDirection: "row", gap: SPACE.sm },
  trailing: { alignItems: "flex-end", gap: 2, maxWidth: 140 },
  trailingMeta: { ...TYPO.subtitle },
  trailingValue: { ...TYPO.rowTitle },
});
