import { StyleSheet } from "react-native";

import { RADIUS, SPACE, TYPO } from "@/theme";

/** Shared styles for the dispatch board, its job cards, and the assign sheet. */
export const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: SPACE.xs },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  demoLoadCopy: { gap: SPACE.xs, marginBottom: SPACE.md },
  demoLoadDescription: { ...TYPO.caption },
  demoLoadTitle: { ...TYPO.cardTitle },
  driverName: { ...TYPO.caption },
  driverRow: { alignItems: "center", flexDirection: "row", gap: SPACE.xs },
  exception: {
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.xs,
    padding: SPACE.sm,
  },
  exceptionText: { ...TYPO.caption, flex: 1 },
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  jobFooter: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    justifyContent: "space-between",
    paddingTop: SPACE.sm,
  },
  jobHead: { alignItems: "flex-start", flexDirection: "row", gap: SPACE.sm },
  loadNumber: { ...TYPO.cardTitle },
  meta: { alignItems: "center", flexDirection: "row", gap: 3, maxWidth: "33%" },
  metaLabel: { ...TYPO.subtitle },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  route: { ...TYPO.caption, marginTop: 2 },
  sheetBody: { paddingBottom: SPACE.md },
});
