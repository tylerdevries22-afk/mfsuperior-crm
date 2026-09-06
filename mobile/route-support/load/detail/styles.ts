import { StyleSheet } from "react-native";
import { RADIUS, SPACE, TYPO } from "@/theme";

export const styles = StyleSheet.create({
  actionRow: { gap: SPACE.sm },
  assignmentList: { borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  body: { ...TYPO.body },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  errorBanner: { alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, padding: SPACE.md },
  errorText: { ...TYPO.captionStrong, flex: 1 },
  eyebrow: { ...TYPO.eyebrow },
  fill: { flex: 1 },
  grow: { flex: 1, gap: SPACE.xs, minWidth: 0 },
  loadHeader: { alignItems: "flex-start", flexDirection: "row", gap: SPACE.md },
  noticeRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  noticeTitle: { ...TYPO.cardTitle },
  route: { ...TYPO.body },
  secondaryActions: { gap: SPACE.sm },
  sheetAddress: { ...TYPO.bodyStrong },
  sheetContent: { gap: SPACE.md, paddingBottom: SPACE.sm },
  successMark: { alignItems: "center", borderRadius: RADIUS.pill, height: 42, justifyContent: "center", width: 42 },
  title: { ...TYPO.screenTitle, fontSize: 34, lineHeight: 39 },
});
