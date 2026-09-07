import { StyleSheet } from "react-native";

import { RADIUS, SPACE, TYPO } from "@/theme";

/** Shared styles for the shop board, its rows, totals, and work-order composer. */
export const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
  composer: { gap: SPACE.sm, paddingBottom: SPACE.md },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  criticalNote: {
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.xs,
    padding: SPACE.sm,
  },
  criticalText: { ...TYPO.caption, flex: 1 },
  fill: { flex: 1 },
  kindWell: { alignItems: "center", borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  label: { ...TYPO.label, marginTop: SPACE.xs },
  total: {
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingVertical: SPACE.md,
  },
  totalLabel: { ...TYPO.metricLabel },
  totalValue: { ...TYPO.metric },
  totalsRow: { flexDirection: "row", gap: SPACE.sm },
  trailing: { alignItems: "flex-end", gap: SPACE.xxs },
});
