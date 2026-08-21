import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppModal, Badge, Button, Card, Header, PressableSurface, Screen, SectionHeader } from "@/components/ui";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

interface WorkflowStep {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly code: string;
  readonly required: boolean;
}

const BASE_STEPS: readonly WorkflowStep[] = [
  { id: "tender", title: "Tender received", detail: "Create inbound load record", code: "204", required: true },
  { id: "response", title: "Tender response", detail: "Accept or decline the load", code: "990", required: true },
  { id: "pickup", title: "Pickup milestones", detail: "Arrival, loading, and departure", code: "214", required: true },
  { id: "tracking", title: "In-transit updates", detail: "Location and status checkpoints", code: "214", required: false },
  { id: "delivery", title: "Delivery and POD", detail: "Arrival, signature, and attachments", code: "214", required: true },
  { id: "invoice", title: "Freight invoice", detail: "Linehaul and accessorial charges", code: "210", required: false },
] as const;

export default function WorkflowBuilderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ equipmentType?: string; origin?: string; destination?: string; commodity?: string; instructions?: string }>();
  const theme = useTheme();
  const [enabledIds, setEnabledIds] = useState<ReadonlySet<string>>(() => new Set(BASE_STEPS.map((step) => step.id)));
  const [previewVisible, setPreviewVisible] = useState(false);
  const enabledSteps = useMemo(() => BASE_STEPS.filter((step) => enabledIds.has(step.id)), [enabledIds]);

  const toggleStep = (step: WorkflowStep) => {
    if (step.required) return;
    setEnabledIds((current) => {
      const next = new Set(current);
      if (next.has(step.id)) next.delete(step.id);
      else next.add(step.id);
      return next;
    });
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack subtitle="Step 2 of 2" title="Workflow builder" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>MILESTONE DESIGN</Text>
          <Text style={[styles.title, { color: theme.text }]}>Arrange the handoffs</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>Required freight milestones stay protected. Optional tracking and invoicing steps can be included in this preview.</Text>
        </View>

        <Card>
          <View style={styles.summaryRow}>
            <View style={styles.grow}>
              <Text style={[styles.summaryTitle, { color: theme.text }]}>{params.origin || "Origin"} → {params.destination || "Destination"}</Text>
              <Text style={[styles.summaryCopy, { color: theme.textSecondary }]}>{params.commodity || "Freight"} · {(params.equipmentType || "dry_van").replaceAll("_", " ")}</Text>
            </View>
            <Badge label={`${enabledSteps.length} steps`} tone="brand" />
          </View>
        </Card>

        <SectionHeader title="Milestones" />
        <View accessibilityRole="list" style={styles.stepList}>
          {BASE_STEPS.map((step, index) => {
            const enabled = enabledIds.has(step.id);
            return (
              <PressableSurface
                accessibilityLabel={`${step.title}, ${step.required ? "required" : enabled ? "included" : "not included"}`}
                accessibilityRole={step.required ? "text" : "switch"}
                accessibilityState={step.required ? undefined : { checked: enabled }}
                disabled={step.required}
                haptic="selection"
                key={step.id}
                onPress={() => toggleStep(step)}
                style={[styles.stepCard, { backgroundColor: theme.surface, borderColor: enabled ? theme.primaryLight : theme.border, opacity: enabled ? 1 : 0.62 }]}
              >
                <View style={styles.stepRail}>
                  <View style={[styles.stepNumber, { backgroundColor: enabled ? theme.primary : theme.surfaceBright }]}>
                    <Text style={[styles.stepNumberText, { color: enabled ? theme.primaryForeground : theme.textMuted }]}>{index + 1}</Text>
                  </View>
                  {index < BASE_STEPS.length - 1 ? <View style={[styles.stepLine, { backgroundColor: theme.border }]} /> : null}
                </View>
                <View style={styles.stepCopy}>
                  <View style={styles.stepTitleRow}>
                    <Text style={[styles.stepTitle, { color: theme.text }]}>{step.title}</Text>
                    <Badge label={step.code} tone="info" />
                  </View>
                  <Text style={[styles.stepDetail, { color: theme.textSecondary }]}>{step.detail}</Text>
                  <Text style={[styles.stepRule, { color: step.required ? theme.textMuted : theme.primaryLight }]}>{step.required ? "Required milestone" : enabled ? "Included · tap to remove" : "Optional · tap to include"}</Text>
                </View>
                <Ionicons color={enabled ? theme.success : theme.textMuted} name={enabled ? "checkmark-circle" : "ellipse-outline"} size={ICON.lg} />
              </PressableSurface>
            );
          })}
        </View>

        <Button fullWidth onPress={() => setPreviewVisible(true)} title="Preview workflow" />
      </Screen>

      <AppModal
        footer={
          <View style={styles.modalActions}>
            <Button fullWidth onPress={() => setPreviewVisible(false)} title="Keep editing" variant="secondary" />
            <Button fullWidth onPress={() => router.replace("/(tabs)")} title="Save local preview" />
          </View>
        }
        onClose={() => setPreviewVisible(false)}
        title="Workflow ready"
        visible={previewVisible}
      >
        <View style={styles.modalBody}>
          <View style={[styles.successMark, { backgroundColor: theme.successMuted }]}>
            <Ionicons color={theme.success} name="checkmark" size={ICON.xl} />
          </View>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{enabledSteps.length} milestones configured</Text>
          <Text style={[styles.modalCopy, { color: theme.textSecondary }]}>The workflow is ready for review. Publishing requires an authorized production session.</Text>
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { ...TYPO.body },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  eyebrow: { ...TYPO.eyebrow },
  fill: { flex: 1 },
  grow: { flex: 1, gap: SPACE.xxs },
  intro: { gap: SPACE.sm },
  modalActions: { gap: SPACE.sm },
  modalBody: { alignItems: "center", gap: SPACE.md, paddingBottom: SPACE.sm },
  modalCopy: { ...TYPO.body, textAlign: "center" },
  modalTitle: { ...TYPO.heading, textAlign: "center" },
  stepCard: { alignItems: "flex-start", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, minHeight: 112, padding: SPACE.md },
  stepCopy: { flex: 1, gap: SPACE.xs },
  stepDetail: { ...TYPO.caption },
  stepLine: { flex: 1, marginVertical: SPACE.xxs, width: 2 },
  stepList: { gap: SPACE.sm },
  stepNumber: { alignItems: "center", borderRadius: RADIUS.pill, height: 32, justifyContent: "center", width: 32 },
  stepNumberText: { ...TYPO.captionStrong },
  stepRail: { alignItems: "center", alignSelf: "stretch" },
  stepRule: { ...TYPO.captionStrong },
  stepTitle: { ...TYPO.cardTitle, flex: 1 },
  stepTitleRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  successMark: { alignItems: "center", borderRadius: RADIUS.pill, height: 64, justifyContent: "center", width: 64 },
  summaryCopy: { ...TYPO.caption },
  summaryRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  summaryTitle: { ...TYPO.cardTitle },
  title: { ...TYPO.screenTitle },
});
