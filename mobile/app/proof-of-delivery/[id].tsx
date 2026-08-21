import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { Button, Card, EmptyState, Header, Screen, TextArea, TextField } from "@/components/ui";
import type { DeliveryAttachment } from "@/domain/types";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

type DraftAttachment = Omit<DeliveryAttachment, "id">;

export default function ProofOfDeliveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const theme = useTheme();
  const { effectiveRole, shipments, state, error, actions } = useOperations();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const shipment = shipments.find((candidate) => candidate.id === id);
  const [recipientName, setRecipientName] = useState("");
  const [signature, setSignature] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<readonly DraftAttachment[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!shipment || effectiveRole === "customer") {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header centered onBack={() => router.back()} showBack title="Proof of delivery" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState description="A Driver or Admin membership is required to submit proof of delivery." title="Role access required" />
        </Screen>
      </View>
    );
  }

  const deliveryStop = [...shipment.stops].reverse().find((stop) => stop.type === "delivery");
  const existingProof = state.proofsOfDelivery.find((proof) => proof.shipmentId === shipment.id);
  const canSubmit = shipment.status === "at_delivery"
    && Boolean(deliveryStop)
    && recipientName.trim().length >= 2
    && signature.trim().length >= 3
    && !existingProof;

  const takePhoto = async () => {
    setPermissionError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPermissionError("Camera access is needed only when you choose to add a delivery photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        cameraType: ImagePicker.CameraType.back,
        mediaTypes: ["images"],
        quality: 0.72,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      setAttachments((current) => [
        ...current,
        { kind: "photo", uri: asset.uri, name: asset.fileName ?? `delivery-photo-${current.length + 1}.jpg` },
      ]);
    } catch {
      setPermissionError("The camera could not be opened. You can still submit proof without a photo.");
    }
  };

  const submit = async () => {
    if (!canSubmit || !deliveryStop) return;
    setIsSubmitting(true);
    try {
      const succeeded = await actions.submitProofOfDelivery(shipment.id, {
        stopId: deliveryStop.id,
        recipientName,
        signatureData: signature,
        notes,
        attachments,
      });
      if (succeeded) router.replace({ pathname: "/load/[id]", params: { id: shipment.id } });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack subtitle={shipment.loadNumber} title="Proof of delivery" />
      <Screen keyboardAware safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>

        {existingProof ? (
          <Card>
            <View style={styles.successRow}>
              <View style={[styles.successMark, { backgroundColor: theme.successMuted }]}>
                <Ionicons color={theme.success} name="checkmark" size={ICON.lg} />
              </View>
              <View style={styles.grow}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>POD already submitted</Text>
                <Text style={[styles.body, { color: theme.textSecondary }]}>Received by {existingProof.recipientName}.</Text>
              </View>
            </View>
          </Card>
        ) : null}

        {shipment.status !== "at_delivery" && !existingProof ? (
          <View accessibilityRole="alert" style={[styles.warning, { backgroundColor: theme.warningMuted, borderColor: theme.tint.warning.medium }]}>
            <Ionicons color={theme.warning} name="warning-outline" size={ICON.md} />
            <Text style={[styles.warningText, { color: theme.textSecondary }]}>Mark the load arrived at delivery before submitting POD.</Text>
          </View>
        ) : null}

        <Card title="Receiver">
          <View style={styles.form}>
            <TextField autoCapitalize="words" editable={!existingProof} label="Recipient name" onChangeText={setRecipientName} placeholder="Full name" value={recipientName} />
            <TextField
              autoCapitalize="words"
              editable={!existingProof}
              helperText="Enter the recipient’s acknowledgment exactly as it appears on the delivery record."
              label="Signature acknowledgment"
              onChangeText={setSignature}
              placeholder="Type recipient's full name"
              value={signature}
            />
            <TextArea editable={!existingProof} label="Delivery notes" onChangeText={setNotes} placeholder="Seal, count, condition, receiving notes…" value={notes} />
          </View>
        </Card>

        <Card title="Attachments">
          <Text style={[styles.body, { color: theme.textSecondary }]}>Add an optional delivery photo after the receiver gives permission.</Text>
          {attachments.length ? (
            <View style={styles.attachmentGrid}>
              {attachments.map((attachment, index) => (
                <View key={`${attachment.uri}-${index}`} style={styles.attachment}>
                  <Image accessibilityLabel={attachment.name} source={{ uri: attachment.uri }} style={styles.attachmentImage} />
                  <Button onPress={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} size="sm" title="Remove" variant="ghost" />
                </View>
              ))}
            </View>
          ) : null}
          <Button icon={<Ionicons color={theme.text} name="camera-outline" size={ICON.md} />} onPress={() => void takePhoto()} title="Take delivery photo" variant="secondary" />
          {permissionError ? <Text accessibilityRole="alert" style={[styles.errorText, { color: theme.danger }]}>{permissionError}</Text> : null}
        </Card>

        {error ? <Text accessibilityRole="alert" style={[styles.errorText, { color: theme.danger }]}>{error.message}</Text> : null}
        <Button disabled={!canSubmit} fullWidth loading={isSubmitting} onPress={() => void submit()} title="Submit proof and complete delivery" />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  attachment: { alignItems: "center", flexBasis: "46%", flexGrow: 1, gap: SPACE.xs },
  attachmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  attachmentImage: { borderRadius: RADIUS.sm, height: 124, width: "100%" },
  body: { ...TYPO.body },
  cardTitle: { ...TYPO.cardTitle },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  errorText: { ...TYPO.captionStrong },
  fill: { flex: 1 },
  form: { gap: SPACE.md },
  grow: { flex: 1, gap: SPACE.xxs },
  successMark: { alignItems: "center", borderRadius: RADIUS.pill, height: 48, justifyContent: "center", width: 48 },
  successRow: { alignItems: "center", flexDirection: "row", gap: SPACE.md },
  warning: { alignItems: "flex-start", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, padding: SPACE.md },
  warningText: { ...TYPO.caption, flex: 1 },
});
