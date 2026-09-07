import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button, Card, EmptyState, Header, ListRow, Screen, SegmentedControl, TextArea } from "@/components/ui";
import type { ExceptionCategory, ExceptionSeverity } from "@/domain/types";
import { formatStatus } from "@/lib/operations-format";
import { CategorySheet, StopSheet } from "@/route-support/exception/_components/ExceptionSheets";
import { PhotoAttachments } from "@/route-support/exception/_components/PhotoAttachments";
import { styles } from "@/route-support/exception/styles";
import { useOperations } from "@/store";
import { ICON, useTheme } from "@/theme";

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
          <EmptyState actionLabel="Return home" description="An active driver or admin load is required to report an exception." onAction={() => router.replace("/(tabs)")} title="No operable load" />
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
      <Header centered onBack={() => router.back()} showBack subtitle={shipment.loadNumber} title="Report exception" />
      <Screen keyboardAware safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>

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

        <PhotoAttachments
          onAdd={() => void addAttachment()}
          onRemove={(uri) => setAttachmentUris((current) => current.filter((candidate) => candidate !== uri))}
          permissionError={permissionError}
          uris={attachmentUris}
        />

        <View style={[styles.escalation, { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium }]}>
          <Ionicons color={theme.danger} name="call-outline" size={ICON.md} />
          <Text style={[styles.escalationText, { color: theme.textSecondary }]}>For an emergency or immediate safety risk, stop safely and call the appropriate emergency or operations contact. This app does not place emergency calls.</Text>
        </View>

        {error ? <Text accessibilityRole="alert" style={[styles.errorText, { color: theme.danger }]}>{error.message}</Text> : null}
        <Button disabled={!canSubmit} fullWidth loading={isSubmitting} onPress={() => void submit()} title="Submit local exception" variant="danger" />
      </Screen>

      <CategorySheet
        onClose={() => setCategoryVisible(false)}
        onSelect={(candidate) => { setCategory(candidate); setCategoryVisible(false); }}
        selected={category}
        visible={categoryVisible}
      />

      <StopSheet
        onClose={() => setStopVisible(false)}
        onSelect={(nextStopId) => { setStopId(nextStopId); setStopVisible(false); }}
        selectedStopId={stopId}
        stops={shipment.stops}
        visible={stopVisible}
      />
    </View>
  );
}
