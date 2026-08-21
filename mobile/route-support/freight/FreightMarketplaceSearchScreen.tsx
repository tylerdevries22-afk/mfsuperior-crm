import Feather from "@expo/vector-icons/Feather";
import { useRouter, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RADIUS, RADIUS_DENSE, SPACE, TYPO, useTheme } from "@/theme";

import { FreightBackHeader, FreightStatusPill, toneColor } from "./FreightChrome";
import type { FreightRecord } from "./types";

export interface MarketplaceSearchSpec {
  readonly title: string;
  readonly description: string;
  readonly filters: readonly string[];
  readonly results: readonly FreightRecord[];
}

export function FreightMarketplaceSearchScreen({ spec }: { readonly spec: MarketplaceSearchSpec }) {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(spec.filters[0] ?? "All");
  const results = useMemo(() => spec.results.filter((record) => `${record.title} ${record.subtitle}`.toLowerCase().includes(query.trim().toLowerCase())), [query, spec.results]);
  return <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}><FreightBackHeader title={spec.title} /><ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag"><View style={styles.hero}><Text style={[styles.title, { color: theme.text }]}>{spec.title}</Text><Text style={[styles.description, { color: theme.textSecondary }]}>{spec.description}</Text></View><View style={[styles.search, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><Feather color={theme.textMuted} name="search" size={19} /><TextInput accessibilityLabel={`Search ${spec.title}`} autoCapitalize="none" onChangeText={setQuery} placeholder="Search lanes, equipment, location…" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} value={query} />{query ? <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={() => setQuery("")}><Feather color={theme.textMuted} name="x-circle" size={18} /></Pressable> : null}</View><ScrollView horizontal contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false}>{spec.filters.map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === item }} key={item} onPress={() => setFilter(item)} style={[styles.filter, { backgroundColor: filter === item ? theme.primary : theme.surface, borderColor: filter === item ? theme.primary : theme.border }]}><Text style={[styles.filterText, { color: filter === item ? theme.primaryForeground : theme.textSecondary }]}>{item}</Text></Pressable>)}</ScrollView><View style={styles.resultsHeader}><Text style={[styles.resultsTitle, { color: theme.text }]}>{results.length} matches</Text><Pressable accessibilityLabel="Open advanced filters" accessibilityRole="button" style={styles.filterAction}><Feather color={theme.primaryLight} name="sliders" size={16} /><Text style={[styles.filterActionText, { color: theme.primaryLight }]}>Filters</Text></Pressable></View><View style={styles.results}>{results.map((record) => <Pressable accessibilityRole="button" key={record.id} onPress={() => record.route && router.push(record.route as Href)} style={({ pressed }) => [styles.result, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}><View style={[styles.icon, { backgroundColor: `${toneColor(theme, record.tone ?? "brand")}18` }]}><Feather color={toneColor(theme, record.tone ?? "brand")} name={record.icon ?? "box"} size={20} /></View><View style={styles.copy}><Text style={[styles.resultTitle, { color: theme.text }]}>{record.title}</Text><Text style={[styles.resultSubtitle, { color: theme.textSecondary }]}>{record.subtitle}</Text>{record.meta ? <Text style={[styles.resultMeta, { color: theme.textMuted }]}>{record.meta}</Text> : null}</View>{record.status ? <FreightStatusPill label={record.status} tone={record.tone} /> : null}</Pressable>)}</View></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl, paddingHorizontal: 20, paddingTop: SPACE.lg },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  description: { ...TYPO.body },
  filter: { alignItems: "center", borderRadius: RADIUS.pill, borderWidth: 1, minHeight: 38, paddingHorizontal: 15 },
  filterAction: { alignItems: "center", flexDirection: "row", gap: 6, minHeight: 44 },
  filterActionText: { ...TYPO.captionStrong },
  filters: { gap: SPACE.sm, paddingRight: 20 },
  filterText: { ...TYPO.captionStrong, lineHeight: 36 },
  hero: { gap: SPACE.sm },
  icon: { alignItems: "center", borderRadius: RADIUS_DENSE.xl, height: 44, justifyContent: "center", width: 44 },
  input: { ...TYPO.body, flex: 1, minHeight: 50, paddingVertical: 12 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  result: { alignItems: "center", borderRadius: RADIUS.lg, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 92, padding: 14 },
  resultMeta: { ...TYPO.subtitle, marginTop: 2 },
  results: { gap: SPACE.sm },
  resultsHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  resultsTitle: { ...TYPO.heading },
  resultSubtitle: { ...TYPO.caption },
  resultTitle: { ...TYPO.rowTitle },
  safe: { flex: 1 },
  search: { alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 54, paddingHorizontal: 14 },
  title: { ...TYPO.largeTitle, fontSize: 34, lineHeight: 39 },
});
