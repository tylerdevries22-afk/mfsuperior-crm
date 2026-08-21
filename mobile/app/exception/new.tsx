import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { SimulationBanner } from "@/components/operations";
import { BottomSheet, Button, Card, EmptyState, Header, ListRow, Screen, SegmentedControl, TextArea } from "@/components/ui";
import type { ExceptionCategory, ExceptionSeverity } from "@/domain/types";
import { formatStatus } from "@/lib/operations-format";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

const CATEGORIES: readonly ExceptionCategory[] = [
  "delay",
  "equipment",
  "temperature",
  "cargo_damage",
  "refused_delivery",
  "route",
  "other",
];

export default function NewExceptionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ shipmentId?: string | string[] }>();
  const theme = useTheme();
  const { activeShipment, effectiveRole, shipments, error, actions } = useOperations();
  const requestedId = Array.isArray(params.shipmentId) ? params.shipmentId[0] : params.shipmentId;
  const shipment = shipments.find((candidate) => candidate.id === requestedId) ?? activeShipment;
  const [category, setCategory] = useState<ExceptionCategory>("delay");
  const [severity, setSeverity] = useState<ExceptionSeverity>("medium");
  const [description, setDescription] = useState("");
  const [stopId, setStopId] = useState<string | undefined>();
  const [attachmentUris, setAttachmentUris] = useState<readonly string[]>([]);
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [stopVisible, setStopVisible] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!shipment || effectiveRole === "customer") {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header centered onBack={() => router.back()} showBack title="Report exception" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState actionLabel="Return home" description="An active driver or dispatcher load is required to report an exception." onAction={() => router.replace("/(tabs)")} title="No operable load" />
        </Screen>
      </View>
    );
  }

  const selectedStop = shipment.stops.find((stop) => stop.id === stopId);
  const canSubmit = description.trim().length >= 10 && shipment.status !== "delivered" && shipment.status !== "cancelled";

  const addAttachment = async () => {
    setPermissionError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPermissionError("Photo-library access is needed only when you choose an attachment.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        mediaTypes: ["images"],
        quality: 0.7,
        selectionLimit: 3,
      });
      if (result.canceled) return;
      setAttachmentUris((current) => [...current, ...result.assets.map((asset) => asset.uri)].slice(0, 3));
    } catch {
      setPermissionError("The photo library could not be opened. You can submit the exception without an attachment.");
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const succeeded = await actions.reportException(shipment.id, {
        category,
        severity,
        description,
        stopId,
        attachmentUris,
      });
      if (succeeded) router.replace({ pathname: "/load/[id]", params: { id: shipment.id } });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack subtitle={shipment.targetLoadId} title="Report exception" />
      <Screen keyboardAware safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <SimulationBanner message="Submitting creates a local exception and simulated 214 event. It does not notify Target or emergency services." />

        <Card title="Exception details">
          <View style={styles.form}>
            <ListRow
              isLast
              meta="Required"
              onPress={() => setCategoryVisible(true)}
              subtitle="Choose the condition that best describes the issue."
              title={formatStatus(category)}
            />
            <SegmentedControl
              accessibilityLabel="Exception severity"
              onChange={setSeverity}
              options={[
                { label: "Low", value: "low" },
                { label: "Medium", value: "medium" },
                { label: "High", value: "high" },
                { label: "Critical", value: "critical" },
              ]}
              value={severity}
            />
            <ListRow
              isLast
              meta="Optional"
              onPress={() => setStopVisible(true)}
              subtitle={selectedStop ? `${selectedStop.address.city}, ${selectedStop.address.state}` : "Associate this report with a route stop."}
              title={selectedStop?.facilityName ?? "Select stop"}
            />
            <TextArea
              helperText={`${description.trim().length}/1000 characters · minimum 10`}
              label="What happened?"
              maxLength={1000}
              onChangeText={setDescription}
              placeholder="Describe the condition, immediate impact, and any safe actions taken."
              value={description}
            />
          </View>
        </Card>

        <Card title="Photos">
          <Text style={[styles.body, { color: theme.textSecondary }]}>Attach up to three local photos. They remain on this device.</Text>
          {attachmentUris.length ? (
            <View style={styles.attachmentGrid}>
              {attachmentUris.map((uri, index) => (
                <View key={uri} style={styles.attachment}>
                  <Image accessibilityLabel={`Exception attachment ${index + 1}`} source={{ uri }} style={styles.attachmentImage} />
                  <Button onPress={() => setAttachmentUris((current) => current.filter((candidate) => candidate !== uri))} size="sm" title="Remove" variant="ghost" />
                </View>
              ))}
            </View>
          ) : null}
          <Button disabled={attachmentUris.length >= 3} icon={<Ionicons color={theme.text} name="images-outline" size={ICON.md} />} onPress={() => void addAttachment()} title="Choose photos" variant="secondary" />
          {permissionError ? <Text accessibilityRole="alert" style={[styles.errorText, { color: theme.danger }]}>{permissionError}</Text> : null}
        </Card>

        <View style={[styles.escalation, { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium }]}>
          <Ionicons color={theme.danger} name="call-outline" size={ICON.md} />
          <Text style={[styles.escalationText, { color: theme.textSecondary }]}>For an emergency or immediate safety risk, stop safely and call the appropriate emergency or dispatch contact. This prototype does not send alerts.</Text>
        </View>

        {error ? <Text accessibilityRole="alert" style={[styles.errorText, { color: theme.danger }]}>{error.message}</Text> : null}
        <Button disabled={!canSubmit} fullWidth loading={isSubmitting} onPress={() => void submit()} title="Submit local exception" variant="danger" />
      </Screen>

      <BottomSheet onClose={() => setCategoryVisible(false)} title="Exception category" visible={categoryVisible}>
        <View style={styles.sheetList}>
          {CATEGORIES.map((candidate) => (
            <ListRow
              isLast={candidate === CATEGORIES.at(-1)}
              key={candidate}
              onPress={() => { setCategory(candidate); setCategoryVisible(false); }}
              title={formatStatus(candidate)}
              trailing={candidate === category ? <Ionicons color={theme.success} name="checkmark-circle" size={ICON.lg} /> : undefined}
            />
          ))}
        </View>
      </BottomSheet>

      <BottomSheet onClose={() => setStopVisible(false)} title="Related stop" visible={stopVisible}>
        <View style={styles.sheetList}>
          <ListRow isLast={shipment.stops.length === 0} onPress={() => { setStopId(undefined); setStopVisible(false); }} title="No specific stop" />
          {shipment.stops.map((stop, index) => (
            <ListRow
              isLast={index === shipment.stops.length - 1}
              key={stop.id}
              onPress={() => { setStopId(stop.id); setStopVisible(false); }}
              subtitle={`${stop.address.city}, ${stop.address.state}`}
              title={stop.facilityName}
              trailing={stop.id === stopId ? <Ionicons color={theme.success} name="checkmark-circle" size={ICON.lg} /> : undefined}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
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
