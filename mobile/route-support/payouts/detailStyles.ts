import { StyleSheet } from "react-native";

import { RADIUS, SPACE, TYPO } from "@/theme";

export const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  headRow: { alignItems: "center", flexDirection: "row", gap: SPACE.md },
  lineItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  lineItemAmount: { ...TYPO.rowTitle },
  lineItemKind: { ...TYPO.subtitle, marginTop: 2 },
  lineItemText: { ...TYPO.body },
  net: { ...TYPO.metric },
  netLabel: { ...TYPO.metricLabel },
  paidNote: {
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
  },
  paidText: { ...TYPO.caption, flex: 1 },
  sheetBody: { gap: SPACE.xs, paddingBottom: SPACE.md },
  sheetNote: { ...TYPO.caption, marginBottom: SPACE.xs },
});
