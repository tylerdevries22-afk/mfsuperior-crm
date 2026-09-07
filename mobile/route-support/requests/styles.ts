import { StyleSheet } from "react-native";

import { SPACE, TYPO } from "@/theme";

export const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  eyebrow: { ...TYPO.eyebrow },
  fieldGroup: { gap: SPACE.xs },
  fieldLabel: { ...TYPO.captionStrong },
  fill: { flex: 1 },
  form: { gap: SPACE.md, paddingBottom: SPACE.sm },
  formError: { ...TYPO.captionStrong },
  formScroll: { paddingBottom: SPACE.sm },
  grow: { flex: 1, minWidth: 0 },
  helper: { ...TYPO.subtitle },
  hero: { gap: SPACE.sm, paddingBottom: SPACE.sm },
  locationRow: { flexDirection: "row", gap: SPACE.sm },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  subtitle: { ...TYPO.body, maxWidth: 560 },
  successCopy: { ...TYPO.caption, marginTop: SPACE.xxs },
  successRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  successTitle: { ...TYPO.cardTitle },
  title: { ...TYPO.screenTitle },
});
