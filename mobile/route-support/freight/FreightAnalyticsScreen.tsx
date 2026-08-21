import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SegmentedControl } from "@/components/ui";
import { RADIUS, SPACE, TYPO, useTheme } from "@/theme";

import { FreightBackHeader, toneColor } from "./FreightChrome";
import type { FreightMetric, FreightTone } from "./types";

export interface FreightChartDatum {
  readonly label: string;
  readonly value: number;
  readonly display: string;
  readonly tone?: FreightTone;
}

export interface FreightAnalyticsSpec {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly metrics: readonly FreightMetric[];
  readonly chartTitle: string;
  readonly chart: readonly FreightChartDatum[];
}

function Chart({ spec }: { readonly spec: FreightAnalyticsSpec }) {
  const theme = useTheme();
  const max = Math.max(...spec.chart.map((datum) => datum.value), 1);
  return <View style={[styles.chart, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={styles.chartRows}>{spec.chart.map((datum) => <View key={datum.label} style={styles.chartRow}><View style={styles.barTrack}><View style={[styles.bar, { backgroundColor: toneColor(theme, datum.tone ?? "brand"), width: `${Math.max(7, datum.value / max * 100)}%` }]} /></View><View style={styles.chartCopy}><Text style={[styles.chartLabel, { color: theme.textSecondary }]}>{datum.label}</Text><Text style={[styles.chartValue, { color: theme.text }]}>{datum.display}</Text></View></View>)}</View></View>;
}

export function FreightAnalyticsScreen({ spec }: { readonly spec: FreightAnalyticsSpec }) {
  const theme = useTheme();
  const [period, setPeriod] = useState("30 days");
  const periods = [{ label: "7 days", value: "7 days" }, { label: "30 days", value: "30 days" }, { label: "Quarter", value: "Quarter" }] as const;
  return <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}><FreightBackHeader title={spec.title} /><ScrollView contentContainerStyle={styles.content}><View style={styles.hero}><Text style={[styles.eyebrow, { color: theme.primaryLight }]}>{spec.eyebrow}</Text><Text style={[styles.title, { color: theme.text }]}>{spec.title}</Text><Text style={[styles.description, { color: theme.textSecondary }]}>{spec.description}</Text></View><SegmentedControl accessibilityLabel="Analytics period" onChange={setPeriod} options={periods} value={period} /><View style={styles.metrics}>{spec.metrics.map((metric) => <View key={metric.label} style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.metricValue, { color: toneColor(theme, metric.tone ?? "brand") }]}>{metric.value}</Text><Text style={[styles.metricLabel, { color: theme.textMuted }]}>{metric.label}</Text><Text style={[styles.metricDetail, { color: theme.textSecondary }]}>{metric.detail}</Text></View>)}</View><Text style={[styles.sectionTitle, { color: theme.text }]}>{spec.chartTitle}</Text><Chart spec={spec} /></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  bar: { borderRadius: 4, height: 8 },
  barTrack: { flex: 1 },
  chart: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 16 },
  chartCopy: { alignItems: "flex-end", width: 82 },
  chartLabel: { ...TYPO.subtitle },
  chartRows: { gap: SPACE.lg },
  chartRow: { alignItems: "center", flexDirection: "row", gap: SPACE.md },
  chartValue: { ...TYPO.captionStrong },
  content: { gap: SPACE.lg, paddingBottom: SPACE.xxl, paddingHorizontal: 20, paddingTop: SPACE.lg },
  description: { ...TYPO.body },
  eyebrow: { ...TYPO.eyebrow },
  hero: { gap: SPACE.sm },
  metric: { borderRadius: RADIUS.md, borderWidth: 1, flex: 1, gap: 2, minWidth: "45%", padding: 14 },
  metricDetail: { ...TYPO.subtitle },
  metricLabel: { ...TYPO.metricLabel },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  metricValue: { ...TYPO.metric },
  safe: { flex: 1 },
  sectionTitle: { ...TYPO.heading },
  title: { ...TYPO.largeTitle, fontSize: 34, lineHeight: 39 },
});
