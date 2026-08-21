import Feather from "@expo/vector-icons/Feather";
import { useRouter, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RADIUS, SPACE, TYPO, useTheme } from "@/theme";

import { FreightBackHeader, FreightStatusPill, toneColor } from "./FreightChrome";
import type { FreightDetailSpec } from "./types";

function DetailMetrics({ spec }: { readonly spec: FreightDetailSpec }) {
  const theme = useTheme();
  return <View style={styles.metrics}>{spec.metrics.map((metric) => <View key={metric.label} style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.metricLabel, { color: theme.textMuted }]}>{metric.label}</Text><Text numberOfLines={1} style={[styles.metricValue, { color: theme.text }]}>{metric.value}</Text>{metric.detail ? <Text numberOfLines={1} style={[styles.metricDetail, { color: theme.textSecondary }]}>{metric.detail}</Text> : null}</View>)}</View>;
}

function Timeline({ spec }: { readonly spec: FreightDetailSpec }) {
  const theme = useTheme();
  return <View style={[styles.timeline, { backgroundColor: theme.surface, borderColor: theme.border }]}>{spec.timeline.map((event, index) => <View key={event.id} style={styles.event}><View style={styles.rail}><View style={[styles.eventDot, { backgroundColor: toneColor(theme, event.tone ?? "neutral") }]} />{index < spec.timeline.length - 1 ? <View style={[styles.line, { backgroundColor: theme.borderLight }]} /> : null}</View><View style={styles.eventCopy}><Text style={[styles.eventTitle, { color: theme.text }]}>{event.title}</Text><Text style={[styles.eventSubtitle, { color: theme.textSecondary }]}>{event.subtitle}</Text>{event.meta ? <Text style={[styles.eventMeta, { color: theme.textMuted }]}>{event.meta}</Text> : null}</View></View>)}</View>;
}

export function FreightDetailScreen({ spec }: { readonly spec: FreightDetailSpec }) {
  const router = useRouter();
  const theme = useTheme();
  return <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}><FreightBackHeader title={spec.eyebrow} /><ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}><View style={styles.hero}><View style={styles.heroTop}><View style={styles.heroCopy}><Text style={[styles.eyebrow, { color: theme.primaryLight }]}>{spec.eyebrow}</Text><Text style={[styles.title, { color: theme.text }]}>{spec.title}</Text></View><FreightStatusPill label={spec.status} tone={spec.statusTone} /></View><Text style={[styles.subtitle, { color: theme.textSecondary }]}>{spec.subtitle}</Text></View><DetailMetrics spec={spec} /><Text style={[styles.section, { color: theme.text }]}>Timeline</Text><Timeline spec={spec} />{spec.actions?.length ? <View style={styles.actions}>{spec.actions.map((action, index) => <Pressable accessibilityRole="button" key={action.label} onPress={() => action.route && router.push(action.route as Href)} style={({ pressed }) => [styles.action, { backgroundColor: index === 0 ? theme.primary : theme.surfaceElevated, borderColor: index === 0 ? theme.primary : theme.border }, pressed && styles.pressed]}><Feather color={index === 0 ? theme.primaryForeground : toneColor(theme, action.tone ?? "brand")} name={action.icon} size={18} /><Text style={[styles.actionText, { color: index === 0 ? theme.primaryForeground : theme.text }]}>{action.label}</Text></Pressable>)}</View> : null}</ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  action: { alignItems: "center", borderRadius: RADIUS.pill, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 50, paddingHorizontal: 18 },
  actionText: { ...TYPO.captionStrong },
  actions: { gap: SPACE.sm },
  content: { gap: SPACE.lg, paddingBottom: SPACE.xxl, paddingHorizontal: 20, paddingTop: SPACE.lg },
  event: { flexDirection: "row", gap: 13, minHeight: 74 },
  eventCopy: { flex: 1, gap: 2, paddingBottom: 18 },
  eventDot: { borderRadius: 6, height: 12, width: 12 },
  eventMeta: { ...TYPO.subtitle, marginTop: 3 },
  eventSubtitle: { ...TYPO.caption },
  eventTitle: { ...TYPO.rowTitle },
  eyebrow: { ...TYPO.eyebrow },
  hero: { gap: SPACE.md },
  heroCopy: { flex: 1, gap: 5 },
  heroTop: { alignItems: "flex-start", flexDirection: "row", gap: SPACE.md },
  line: { flex: 1, marginVertical: 4, width: 1 },
  metric: { borderRadius: RADIUS.md, borderWidth: 1, flex: 1, gap: 2, minWidth: "45%", padding: 14 },
  metricDetail: { ...TYPO.subtitle },
  metricLabel: { ...TYPO.metricLabel },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  metricValue: { ...TYPO.cardTitle },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  rail: { alignItems: "center", width: 14 },
  safe: { flex: 1 },
  section: { ...TYPO.heading },
  subtitle: { ...TYPO.body },
  timeline: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 16, paddingBottom: 0 },
  title: { ...TYPO.largeTitle, fontSize: 32, lineHeight: 37 },
});
