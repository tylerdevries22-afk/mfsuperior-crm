import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SimulationBanner } from "@/components/operations";
import { Badge, Button, Card, EmptyState, Header, Screen, TextArea } from "@/components/ui";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

export default function MessagesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentAccount, effectiveRole, activeShipment, shipments, messages, accounts, error, actions } = useOperations();
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const shipment = activeShipment ?? shipments[0];
  const dispatcher = accounts.find((account) => account.role === "dispatcher");
  const driver = accounts.find((account) => account.role === "driver");
  const customer = accounts.find((account) => account.role === "customer");
  const recipient = currentAccount?.role === "dispatcher"
    ? effectiveRole === "customer" ? customer : driver
    : dispatcher;
  const threadId = shipment ? `thread-${shipment.id}` : "thread-operations-support";
  const visibleMessages = useMemo(() => messages.filter((message) => {
    if (message.threadId !== threadId) return false;
    if (currentAccount?.role === "dispatcher") return true;
    return message.senderAccountId === currentAccount?.id || message.recipientAccountIds.includes(currentAccount?.id ?? "");
  }), [currentAccount?.id, currentAccount?.role, messages, threadId]);

  const send = async () => {
    if (!currentAccount || !recipient || !draft.trim()) return;
    setIsSending(true);
    const succeeded = await actions.sendMessage({
      threadId,
      threadKind: shipment ? "shipment" : "support",
      shipmentId: shipment?.id,
      recipientAccountIds: [recipient.id],
      body: draft,
    });
    setIsSending(false);
    if (succeeded) setDraft("");
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack subtitle={shipment?.targetLoadId ?? "Operations support"} title="Messages" />
      <Screen keyboardAware safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <SimulationBanner message="Messages stay in local prototype storage and are not sent to Target, dispatch systems, email, or SMS." />

        <Card>
          <View style={styles.threadHeader}>
            <View style={[styles.avatar, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons color={theme.primaryLight} name={recipient?.role === "dispatcher" ? "headset-outline" : recipient?.role === "driver" ? "car-outline" : "business-outline"} size={ICON.lg} />
            </View>
            <View style={styles.grow}>
              <Text style={[styles.threadTitle, { color: theme.text }]}>{recipient?.displayName ?? "Operations support"}</Text>
              <Text style={[styles.threadSubtitle, { color: theme.textSecondary }]}>{recipient?.title ?? "Local demo thread"}</Text>
            </View>
            <Badge label="Local" showDot tone="success" />
          </View>
        </Card>

        {visibleMessages.length ? (
          <View accessibilityLabel="Message history" style={styles.messageList}>
            {visibleMessages.map((message) => {
              const isMine = message.senderAccountId === currentAccount?.id;
              const sender = accounts.find((account) => account.id === message.senderAccountId);
              return (
                <View key={message.id} style={[styles.messageWrap, isMine ? styles.mineWrap : styles.theirsWrap]}>
                  <View style={[
                    styles.messageBubble,
                    isMine
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}>
                    <Text style={[styles.sender, { color: isMine ? theme.primaryForeground : theme.primaryLight }]}>{isMine ? "You" : sender?.displayName ?? "Teammate"}</Text>
                    <Text style={[styles.messageBody, { color: isMine ? theme.primaryForeground : theme.text }]}>{message.body}</Text>
                    <Text style={[styles.timestamp, { color: isMine ? theme.primaryForeground : theme.textMuted }]}>{new Date(message.sentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : <EmptyState description="Send a local message to begin this demo thread." title="No messages yet" />}

        <Card title="New message">
          <TextArea
            helperText={`Sending to ${recipient?.displayName ?? "operations support"}`}
            label="Message"
            maxLength={2000}
            onChangeText={setDraft}
            placeholder="Write a clear operational update…"
            value={draft}
          />
          {error ? <Text accessibilityRole="alert" style={[styles.errorText, { color: theme.danger }]}>{error.message}</Text> : null}
          <Button
            disabled={!draft.trim() || !recipient}
            fullWidth
            icon={<Ionicons color={theme.primaryForeground} name="send" size={ICON.md} />}
            loading={isSending}
            onPress={() => void send()}
            title="Send local message"
          />
        </Card>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", borderRadius: RADIUS.md, height: 48, justifyContent: "center", width: 48 },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  errorText: { ...TYPO.captionStrong },
  fill: { flex: 1 },
  grow: { flex: 1, gap: SPACE.xxs },
  messageBody: { ...TYPO.body },
  messageBubble: { borderRadius: RADIUS.md, borderWidth: 1, gap: SPACE.xxs, maxWidth: "84%", padding: SPACE.md },
  messageList: { gap: SPACE.sm },
  messageWrap: { flexDirection: "row" },
  mineWrap: { justifyContent: "flex-end" },
  sender: { ...TYPO.captionStrong },
  theirsWrap: { justifyContent: "flex-start" },
  threadHeader: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  threadSubtitle: { ...TYPO.caption },
  threadTitle: { ...TYPO.cardTitle },
  timestamp: { ...TYPO.subtitle, opacity: 0.8 },
});
