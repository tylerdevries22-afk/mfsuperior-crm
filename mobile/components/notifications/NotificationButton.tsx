import Feather from "@expo/vector-icons/Feather";
import { useRouter, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { OperationsMessage } from "@/domain/types";
import { useOptionalOperations } from "@/store";
import { RADIUS, SPACE, TYPO, useTheme } from "@/theme";

const NO_MESSAGES: readonly OperationsMessage[] = [];

type ActivityNotification = {
  readonly id: string;
  readonly body: string;
  readonly sentAt: string;
  readonly unread: boolean;
  readonly route: Href;
  readonly messageId?: string;
};

export function NotificationButton() {
  const router = useRouter();
  const theme = useTheme();
  const operations = useOptionalOperations();
  const actions = operations?.actions;
  const currentAccount = operations?.currentAccount;
  const messages = operations?.messages ?? NO_MESSAGES;
  const [open, setOpen] = useState(false);
  const notifications = useMemo<ActivityNotification[]>(() => {
    const accountId = currentAccount?.id ?? "";
    const messageItems: ActivityNotification[] = messages
      .filter((message) => message.recipientAccountIds.includes(accountId))
      .map((message) => ({
        id: `message-${message.id}`,
        messageId: message.id,
        body: message.body,
        sentAt: message.sentAt,
        unread: !message.readByAccountIds.includes(accountId),
        route: "/messages" as Href,
      }));
    if (!operations) return messageItems;

    const operationalItems: ActivityNotification[] = [];
    const operationsUpdatedAt = new Date(operations.state.updatedAt).getTime();
    for (const shipment of operations.shipments) {
      const isMine = currentAccount?.role !== "driver"
        || shipment.assignedDriverId === currentAccount.driverId;
      if (!isMine) continue;
      const latest = shipment.events.at(-1);
      if (latest) operationalItems.push({
        id: `shipment-${shipment.id}-${latest.id}`,
        body: `${shipment.loadNumber}: ${latest.description}`,
        sentAt: latest.occurredAt,
        unread: operationsUpdatedAt - new Date(latest.occurredAt).getTime() < 86_400_000,
        route: { pathname: "/load/[id]", params: { id: shipment.id } },
      });
      if (currentAccount?.role === "driver" && shipment.status === "accepted") {
        operationalItems.push({
          id: `offer-${shipment.id}`,
          body: `New job offer · ${shipment.loadNumber} · $${(shipment.charges.linehaulCents / 100).toFixed(0)}`,
          sentAt: shipment.updatedAt,
          unread: true,
          route: "/(tabs)" as Href,
        });
      }
    }
    if (currentAccount?.role === "admin") {
      const openExceptions = operations.state.exceptions.filter((item) => item.status !== "resolved");
      if (openExceptions.length) operationalItems.push({
        id: "open-exceptions",
        body: `${openExceptions.length} open shipment exception${openExceptions.length === 1 ? "" : "s"} require review`,
        sentAt: operations.state.updatedAt,
        unread: true,
        route: "/exception-diagnostic" as Href,
      });
    }
    return [...messageItems, ...operationalItems].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }, [currentAccount, messages, operations]);
  const unread = notifications.filter((item) => item.unread);

  const openNotification = (item: ActivityNotification) => {
    if (item.unread && item.messageId) void actions?.markMessageRead(item.messageId);
    setOpen(false);
    router.push(item.route);
  };

  return <>
    <Pressable accessibilityLabel={`${unread.length} unread notifications`} accessibilityRole="button" onPress={() => setOpen(true)} style={[styles.button, { backgroundColor: theme.surfaceElevated }]}>
      <Feather color={theme.text} name="bell" size={20} />
      {unread.length ? <View style={[styles.badge, { backgroundColor: theme.danger }]}><Text style={styles.badgeText}>{unread.length > 99 ? "99+" : unread.length}</Text></View> : null}
    </Pressable>
    <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
      <Pressable onPress={() => setOpen(false)} style={styles.backdrop}>
        <Pressable onPress={() => undefined} style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.panelHeader}><View><Text style={[styles.title, { color: theme.text }]}>Notifications</Text><Text style={[styles.subtitle, { color: theme.textMuted }]}>{unread.length} unread · updates live</Text></View><Pressable accessibilityLabel="Close notifications" hitSlop={8} onPress={() => setOpen(false)}><Feather color={theme.textMuted} name="x" size={20} /></Pressable></View>
          {notifications.slice(0, 6).map((item) => <Pressable key={item.id} onPress={() => openNotification(item)} style={[styles.row, { borderTopColor: theme.border }, item.unread && { backgroundColor: theme.primaryMuted }]}><View style={[styles.dot, { backgroundColor: item.unread ? theme.primaryLight : theme.textMuted }]} /><View style={styles.copy}><Text numberOfLines={2} style={[styles.body, { color: theme.text }]}>{item.body}</Text><Text style={[styles.time, { color: theme.textMuted }]}>{new Date(item.sentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text></View></Pressable>)}
          {!notifications.length ? <Text style={[styles.empty, { color: theme.textSecondary }]}>You’re all caught up.</Text> : null}
          <Pressable onPress={() => { setOpen(false); router.push("/messages"); }} style={[styles.viewAll, { borderTopColor: theme.border }]}><Text style={[styles.viewAllText, { color: theme.primaryLight }]}>View all activity</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.45)", flex: 1, paddingHorizontal: SPACE.md, paddingTop: 106 },
  badge: { alignItems: "center", borderRadius: 9, minHeight: 18, minWidth: 18, paddingHorizontal: 4, position: "absolute", right: -4, top: -4 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800", lineHeight: 18 },
  body: { ...TYPO.captionStrong }, button: { alignItems: "center", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  copy: { flex: 1, gap: 3 }, dot: { borderRadius: 4, height: 8, marginTop: 5, width: 8 }, empty: { ...TYPO.body, padding: SPACE.lg, textAlign: "center" },
  panel: { alignSelf: "flex-end", borderRadius: RADIUS.lg, borderWidth: 1, maxWidth: 390, overflow: "hidden", width: "92%" },
  panelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", padding: SPACE.md },
  row: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: SPACE.sm, padding: SPACE.md }, subtitle: { ...TYPO.subtitle }, time: { ...TYPO.subtitle }, title: { ...TYPO.heading },
  viewAll: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, padding: SPACE.md }, viewAllText: { ...TYPO.captionStrong },
});
