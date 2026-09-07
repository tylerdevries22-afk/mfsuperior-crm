import { StyleSheet } from "react-native";

import { RADIUS, SPACE, TYPO } from "@/theme";

/** Shared styles for the exception composer, its photo grid, and its pickers. */
export const styles = StyleSheet.create({
  attachment: { alignItems: "center", flexBasis: "30%", flexGrow: 1, gap: SPACE.xs },
  attachmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  attachmentImage: { borderRadius: RADIUS.sm, height: 104, width: "100%" },
  body: { ...TYPO.body },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  errorText: { ...TYPO.captionStrong },
  escalation: { alignItems: "flex-start", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, padding: SPACE.md },
  escalationText: { ...TYPO.caption, flex: 1 },
  fill: { flex: 1 },
  form: { gap: SPACE.md },
  sheetList: { paddingBottom: SPACE.sm },
});
