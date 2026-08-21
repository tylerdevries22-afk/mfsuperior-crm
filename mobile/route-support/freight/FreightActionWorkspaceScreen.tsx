import Feather from "@expo/vector-icons/Feather";
import { useRouter, type Href } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RADIUS, RADIUS_DENSE, SPACE, TYPO, useTheme } from "@/theme";

import { FreightBackHeader, toneColor } from "./FreightChrome";
import type { FreightAction, FreightRecord, FreightTone } from "./types";

const art: ImageSourcePropType = require("@/assets/freight/equipment-categories.webp") as ImageSourcePropType;

export interface FreightActionWorkspaceSpec {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly icon: FreightAction["icon"];
  readonly tone?: FreightTone;
  readonly steps: readonly FreightRecord[];
  readonly actions: readonly FreightAction[];
  readonly primaryLabel: string;
  readonly primaryRoute?: string;
  readonly showArtwork?: boolean;
}

function WorkspaceSteps({ steps }: { readonly steps: readonly FreightRecord[] }) {
  const theme = useTheme();
  return <View style={styles.steps}>{steps.map((step, index) => <View key={step.id} style={[styles.step, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={[styles.stepNumber, { backgroundColor: theme.primaryMuted }]}><Text style={[styles.stepNumberText, { color: theme.primaryLight }]}>{index + 1}</Text></View><View style={styles.stepCopy}><Text style={[styles.stepTitle, { color: theme.text }]}>{step.title}</Text><Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>{step.subtitle}</Text></View>{step.status ? <Text style={[styles.stepStatus, { color: toneColor(theme, step.tone ?? "neutral") }]}>{step.status}</Text> : null}</View>)}</View>;
}

function WorkspaceActions({ actions }: { readonly actions: readonly FreightAction[] }) {
  const router = useRouter();
  const theme = useTheme();
  return <View style={styles.actions}>{actions.map((action) => <Pressable accessibilityRole="button" key={action.label} onPress={() => action.route && router.push(action.route as Href)} style={({ pressed }) => [styles.action, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}><View style={[styles.actionIcon, { backgroundColor: `${toneColor(theme, action.tone ?? "brand")}18` }]}><Feather color={toneColor(theme, action.tone ?? "brand")} name={action.icon} size={21} /></View><Text style={[styles.actionText, { color: theme.text }]}>{action.label}</Text><Feather color={theme.textMuted} name="chevron-right" size={17} /></Pressable>)}</View>;
}

export function FreightActionWorkspaceScreen({ spec }: { readonly spec: FreightActionWorkspaceSpec }) {
  const router = useRouter();
  const theme = useTheme();
  const accent = toneColor(theme, spec.tone ?? "brand");
  return <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}><FreightBackHeader title={spec.title} /><ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}><View style={[styles.hero, { backgroundColor: theme.surface, borderColor: `${accent}55` }]}>{spec.showArtwork ? <Image source={art} style={styles.art} /> : null}<View style={[styles.heroIcon, { backgroundColor: `${accent}18`, borderColor: `${accent}42` }]}><Feather color={accent} name={spec.icon} size={27} /></View><Text style={[styles.eyebrow, { color: accent }]}>{spec.eyebrow}</Text><Text style={[styles.title, { color: theme.text }]}>{spec.title}</Text><Text style={[styles.description, { color: theme.textSecondary }]}>{spec.description}</Text></View><Text style={[styles.sectionTitle, { color: theme.text }]}>Workflow</Text><WorkspaceSteps steps={spec.steps} /><Text style={[styles.sectionTitle, { color: theme.text }]}>Tools</Text><WorkspaceActions actions={spec.actions} /><Pressable accessibilityRole="button" onPress={() => spec.primaryRoute && router.push(spec.primaryRoute as Href)} style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: theme.primaryForeground }]}>{spec.primaryLabel}</Text><Feather color={theme.primaryForeground} name="arrow-right" size={18} /></Pressable></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  action: { alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 68, padding: 12 },
  actionIcon: { alignItems: "center", borderRadius: RADIUS_DENSE.xl, height: 42, justifyContent: "center", width: 42 },
  actions: { gap: SPACE.sm },
  actionText: { ...TYPO.rowTitle, flex: 1 },
  art: { bottom: -48, height: 218, opacity: 0.2, position: "absolute", right: -52, width: 218 },
  content: { gap: SPACE.lg, paddingBottom: SPACE.xxl, paddingHorizontal: 20, paddingTop: SPACE.lg },
  description: { ...TYPO.body, maxWidth: 330 },
  eyebrow: { ...TYPO.eyebrow },
  hero: { borderRadius: RADIUS.xl, borderWidth: 1, gap: SPACE.sm, minHeight: 284, overflow: "hidden", padding: 22 },
  heroIcon: { alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, height: 54, justifyContent: "center", marginBottom: SPACE.sm, width: 54 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  primary: { alignItems: "center", borderRadius: RADIUS.pill, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 54 },
  primaryText: { ...TYPO.button },
  safe: { flex: 1 },
  sectionTitle: { ...TYPO.heading },
  step: { alignItems: "flex-start", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 78, padding: 13 },
  stepCopy: { flex: 1, gap: 3 },
  stepNumber: { alignItems: "center", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
  stepNumberText: { ...TYPO.captionStrong },
  steps: { gap: SPACE.sm },
  stepStatus: { ...TYPO.metricLabel, marginTop: 4 },
  stepSubtitle: { ...TYPO.caption },
  stepTitle: { ...TYPO.rowTitle },
  title: { ...TYPO.largeTitle, fontSize: 34, lineHeight: 39 },
});
