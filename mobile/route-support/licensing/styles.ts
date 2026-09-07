import { StyleSheet } from "react-native";

import { RADIUS, SPACE, TYPO } from "@/theme";

/** Shared styles for the compliance register and its document rows. */
export const styles = StyleSheet.create({
  banner: {
    alignItems: "flex-start",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
  },
  bannerBody: { ...TYPO.caption, marginTop: 2 },
  bannerTitle: { ...TYPO.captionStrong },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  expiryDate: { ...TYPO.subtitle },
  fill: { flex: 1 },
  group: { gap: SPACE.xs },
  grow: { flex: 1, minWidth: 0 },
  kindWell: { alignItems: "center", borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  remaining: { ...TYPO.captionStrong, textAlign: "right" },
  trailing: { alignItems: "flex-end", gap: 2, maxWidth: 128 },
});
