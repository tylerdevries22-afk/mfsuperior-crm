import Feather from "@expo/vector-icons/Feather";
import { useRouter, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState, SegmentedControl } from "@/components/ui";
import { FONTS, RADIUS, RADIUS_DENSE, SPACE, TYPO, useTheme } from "@/theme";

import { FreightBackHeader, FreightStatusPill, toneColor } from "./FreightChrome";
import type { FreightCollectionSpec, FreightRecord } from "./types";

function MetricRow({ metrics }: { readonly metrics: NonNullable<FreightCollectionSpec["metrics"]> }) {
  const theme = useTheme();
  return <View style={styles.metrics}>{metrics.map((metric) => <View key={metric.label} style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.metricValue, { color: toneColor(theme, metric.tone ?? "brand") }]}>{metric.value}</Text><Text style={[styles.metricLabel, { color: theme.textMuted }]}>{metric.label}</Text>{metric.detail ? <Text numberOfLines={1} style={[styles.metricDetail, { color: theme.textSecondary }]}>{metric.detail}</Text> : null}</View>)}</View>;
}

function RecordRow({ record, isLast }: { readonly record: FreightRecord; readonly isLast: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  const body = <><View style={[styles.recordIcon, { backgroundColor: `${toneColor(theme, record.tone ?? "neutral")}16` }]}><Feather color={toneColor(theme, record.tone ?? "neutral")} name={record.icon ?? "box"} size={18} /></View><View style={styles.recordCopy}><Text numberOfLines={1} style={[styles.recordTitle, { color: theme.text }]}>{record.title}</Text><Text numberOfLines={2} style={[styles.recordSubtitle, { color: theme.textSecondary }]}>{record.subtitle}</Text>{record.meta ? <Text numberOfLines={1} style={[styles.recordMeta, { color: theme.textMuted }]}>{record.meta}</Text> : null}</View><View style={styles.recordTrailing}>{record.status ? <FreightStatusPill label={record.status} tone={record.tone} /> : null}{record.route ? <Feather color={theme.textMuted} name="chevron-right" size={17} /> : null}</View></>;
  return <Pressable accessibilityRole={record.route ? "button" : undefined} disabled={!record.route} onPress={() => record.route && router.push(record.route as Href)} style={({ pressed }) => [styles.record, !isLast && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && styles.pressed]}>{body}</Pressable>;
}

export function FreightCollectionScreen({ spec }: { readonly spec: FreightCollectionSpec }) {
  const router = useRouter();
  const theme = useTheme();
  const [segment, setSegment] = useState(spec.segments?.[0] ?? "All");
  const options = useMemo(() => spec.segments?.map((label) => ({ label, value: label })) ?? [], [spec.segments]);
  const visibleRecords = useMemo(
    () => options.length ? spec.records.filter((record) => record.segment === segment) : spec.records,
    [options.length, segment, spec.records],
  );
  return <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}><FreightBackHeader title={spec.title} /><ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}><View style={styles.hero}><Text style={[styles.eyebrow, { color: theme.primaryLight }]}>{spec.eyebrow}</Text><Text style={[styles.title, { color: theme.text }]}>{spec.title}</Text><Text style={[styles.description, { color: theme.textSecondary }]}>{spec.description}</Text></View>{spec.metrics?.length ? <MetricRow metrics={spec.metrics} /> : null}{options.length ? <SegmentedControl accessibilityLabel={`${spec.title} view`} onChange={setSegment} options={options} value={segment} /> : null}<View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.text }]}>{segment}</Text><Text style={[styles.count, { color: theme.textMuted }]}>{visibleRecords.length} records</Text></View>{visibleRecords.length ? <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>{visibleRecords.map((record, index) => <RecordRow isLast={index === visibleRecords.length - 1} key={record.id} record={record} />)}</View> : <EmptyState description={spec.emptyDescription ?? "There are no records in this view."} title={spec.emptyTitle ?? "Nothing here yet"} />}</ScrollView>{spec.primaryAction ? <Pressable accessibilityLabel={spec.primaryAction.label} accessibilityRole="button" onPress={() => spec.primaryAction?.route && router.push(spec.primaryAction.route as Href)} style={({ pressed }) => [styles.fab, { backgroundColor: theme.primary }, pressed && styles.pressed]}><Feather color={theme.primaryForeground} name={spec.primaryAction.icon} size={20} /><Text style={[styles.fabText, { color: theme.primaryForeground }]}>{spec.primaryAction.label}</Text></Pressable> : null}</SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: 116, paddingHorizontal: 20, paddingTop: SPACE.lg },
  count: { ...TYPO.caption },
  description: { ...TYPO.body, maxWidth: 350 },
  eyebrow: { ...TYPO.eyebrow },
  fab: { alignItems: "center", borderRadius: 25, bottom: 28, flexDirection: "row", gap: 8, minHeight: 50, paddingHorizontal: 20, position: "absolute", right: 20 },
  fabText: { ...TYPO.captionStrong },
  hero: { gap: SPACE.sm },
  list: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: "hidden" },
  metric: { borderRadius: RADIUS.md, borderWidth: 1, flex: 1, gap: 2, minWidth: 100, padding: 14 },
  metricDetail: { ...TYPO.subtitle },
  metricLabel: { ...TYPO.metricLabel },
  metricValue: { ...TYPO.metric },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  record: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 82, paddingHorizontal: 14, paddingVertical: 12 },
  recordCopy: { flex: 1, gap: 2, minWidth: 0 },
  recordIcon: { alignItems: "center", borderRadius: RADIUS_DENSE.xl, height: 42, justifyContent: "center", width: 42 },
  recordMeta: { ...TYPO.subtitle, marginTop: 2 },
  recordSubtitle: { ...TYPO.caption },
  recordTitle: { ...TYPO.rowTitle },
  recordTrailing: { alignItems: "flex-end", gap: 5, maxWidth: 112 },
  safe: { flex: 1 },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: SPACE.xs },
  sectionTitle: { ...TYPO.heading },
  title: { fontFamily: FONTS.bold, fontSize: 34, letterSpacing: -1, lineHeight: 39 },
});
