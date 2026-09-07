import { StyleSheet } from "react-native";

import { RADIUS, RADIUS_DENSE, SPACE, TYPO } from "@/theme";

/** Shared styles for the driver scheduling board, week nav, and assign sheet. */
export const styles = StyleSheet.create({
  cell: {
    alignItems: "center",
    borderRadius: RADIUS_DENSE.md,
    flex: 1,
    height: 34,
    justifyContent: "center",
    marginHorizontal: 1,
  },
  cellCount: { ...TYPO.subtitle, fontSize: 11 },
  conflictBanner: {
    alignItems: "flex-start",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.xs,
    padding: SPACE.sm,
  },
  conflictText: { ...TYPO.caption, flex: 1 },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  dayHeader: { alignItems: "center", flex: 1, marginHorizontal: 1 },
  dayHeaderLabel: { ...TYPO.subtitle, fontSize: 10 },
  dayHeaderNumber: { ...TYPO.subtitle, fontSize: 11 },
  dayHeaderRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    paddingTop: SPACE.sm,
  },
  driverColumn: { alignItems: "center", gap: 2, width: 60 },
  driverName: { ...TYPO.subtitle, fontSize: 10 },
  driverRow: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
  },
  emptyNote: { ...TYPO.body },
  fill: { flex: 1 },
  offBar: { borderRadius: 1, height: 2, width: 14 },
  sheetBody: { paddingBottom: SPACE.md },
  todayLink: { ...TYPO.subtitle },
  weekHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  weekLabel: { ...TYPO.cardTitle },
  weekLabelWrap: { alignItems: "center", gap: 2 },
});
