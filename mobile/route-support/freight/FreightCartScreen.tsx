import Feather from "@expo/vector-icons/Feather";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RADIUS, RADIUS_DENSE, SPACE, TYPO, useTheme } from "@/theme";

import { FreightBackHeader } from "./FreightChrome";
import type { FreightRecord } from "./types";

export interface FreightCartSpec {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly items: readonly FreightRecord[];
  readonly totalLabel: string;
  readonly total: string;
  readonly submitLabel: string;
}

export function FreightCartScreen({ spec }: { readonly spec: FreightCartSpec }) {
  const theme = useTheme();
  return <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}><FreightBackHeader title={spec.title} /><ScrollView contentContainerStyle={styles.content}><View style={styles.hero}><Text style={[styles.eyebrow, { color: theme.primaryLight }]}>{spec.eyebrow}</Text><Text style={[styles.title, { color: theme.text }]}>{spec.title}</Text><Text style={[styles.description, { color: theme.textSecondary }]}>{spec.description}</Text></View><View style={[styles.items, { backgroundColor: theme.surface, borderColor: theme.border }]}>{spec.items.map((item, index) => <View key={item.id} style={[styles.item, index < spec.items.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}><View style={[styles.icon, { backgroundColor: theme.primaryMuted }]}><Feather color={theme.primaryLight} name={item.icon ?? "box"} size={20} /></View><View style={styles.copy}><Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text><Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text><Text style={[styles.itemMeta, { color: theme.textMuted }]}>{item.meta}</Text></View><Pressable accessibilityLabel={`Remove ${item.title}`} accessibilityRole="button" hitSlop={8}><Feather color={theme.textMuted} name="x" size={18} /></Pressable></View>)}</View><View style={[styles.summary, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><View><Text style={[styles.totalLabel, { color: theme.textMuted }]}>{spec.totalLabel}</Text><Text style={[styles.total, { color: theme.text }]}>{spec.total}</Text></View><Text style={[styles.disclaimer, { color: theme.textSecondary }]}>Final availability, price, and provider terms require confirmation.</Text></View></ScrollView><View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}><Pressable accessibilityRole="button" style={({ pressed }) => [styles.submit, { backgroundColor: theme.primary }, pressed && styles.pressed]}><Text style={[styles.submitText, { color: theme.primaryForeground }]}>{spec.submitLabel}</Text><Feather color={theme.primaryForeground} name="arrow-right" size={18} /></Pressable></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { gap: SPACE.lg, paddingBottom: 120, paddingHorizontal: 20, paddingTop: SPACE.lg },
  copy: { flex: 1, gap: 2 },
  description: { ...TYPO.body },
  disclaimer: { ...TYPO.caption, flex: 1, textAlign: "right" },
  eyebrow: { ...TYPO.eyebrow },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, bottom: 0, left: 0, padding: 16, position: "absolute", right: 0 },
  hero: { gap: SPACE.sm },
  icon: { alignItems: "center", borderRadius: RADIUS_DENSE.xl, height: 44, justifyContent: "center", width: 44 },
  item: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 100, padding: 14 },
  itemMeta: { ...TYPO.subtitle, marginTop: 2 },
  items: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: "hidden" },
  itemSubtitle: { ...TYPO.caption },
  itemTitle: { ...TYPO.rowTitle },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  safe: { flex: 1 },
  submit: { alignItems: "center", borderRadius: RADIUS.pill, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 54 },
  submitText: { ...TYPO.button },
  summary: { alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.md, padding: 16 },
  title: { ...TYPO.largeTitle, fontSize: 34, lineHeight: 39 },
  total: { ...TYPO.heading },
  totalLabel: { ...TYPO.metricLabel },
});
