import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  Button,
  Card,
  EmptyState,
  Header,
  ListRow,
  Screen,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import type { CustomerRequest } from "@/domain/types";
import { useOperations } from "@/store";
import { ICON, SPACE, TYPO, useTheme } from "@/theme";

function PendingBanner() {
  const theme = useTheme();
  return (
    <Card variant="tinted">
      <View accessibilityRole="alert" style={styles.bannerRow} testID="pending-approval-banner">
        <Ionicons color={theme.primaryLight} name="time-outline" size={ICON.lg} />
        <View style={styles.grow}>
          <Text style={[styles.bannerTitle, { color: theme.text }]}>Access pending approval</Text>
          <Text style={[styles.bannerCopy, { color: theme.textSecondary }]}>
            An MF Superior Products admin must link your company before shipment tracking,
            documents, and load history unlock.
          </Text>
        </View>
      </View>
    </Card>
  );
}

function PendingCapabilities() {
  const theme = useTheme();
  const rows = [
    { available: true, label: "Submit and track your own freight requests" },
    { available: false, label: "Shipment tracking and load history" },
    { available: false, label: "Proof of delivery and freight documents" },
  ];
  return (
    <Card padding="none">
      {rows.map((row, index) => (
        <ListRow
          isLast={index === rows.length - 1}
          key={row.label}
          leading={
            <Ionicons
              color={row.available ? theme.success : theme.textMuted}
              name={row.available ? "checkmark-circle-outline" : "lock-closed-outline"}
              size={ICON.md}
            />
          }
          title={row.label}
        />
      ))}
    </Card>
  );
}

function PendingRequests({ requests }: { readonly requests: readonly CustomerRequest[] }) {
  return (
    <>
      <SectionHeader title="Your freight requests" />
      {requests.length === 0 ? (
        <EmptyState
          description="Requests you submit while access is pending will appear here."
          title="No requests yet"
        />
      ) : (
        <Card padding="none">
          {requests.map((request, index) => (
            <ListRow
              isLast={index === requests.length - 1}
              key={request.id}
              meta={request.type.replaceAll("_", " ")}
              subtitle={request.details}
              title={request.subject}
              trailing={<StatusBadge size="sm" status={request.status} />}
            />
          ))}
        </Card>
      )}
    </>
  );
}

export default function PendingApprovalScreen() {
  const theme = useTheme();
  const { actions, currentAccount, customerRequests } = useOperations();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    try {
      await actions.restoreSession();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header subtitle={currentAccount?.email ?? "Customer account"} title="Pending approval" />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <PendingBanner />
        <PendingCapabilities />
        <PendingRequests requests={customerRequests} />
        <Button
          fullWidth
          loading={refreshing}
          onPress={() => { void refresh(); }}
          title="Check approval status"
          variant="secondary"
        />
        <Button
          fullWidth
          onPress={() => { void actions.signOut(); }}
          title="Sign out"
          variant="ghost"
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerCopy: { ...TYPO.body, marginTop: 4 },
  bannerRow: { alignItems: "flex-start", flexDirection: "row", gap: SPACE.sm },
  bannerTitle: { ...TYPO.cardTitle },
  content: { gap: SPACE.md, paddingVertical: SPACE.md },
  fill: { flex: 1 },
  grow: { flex: 1 },
});
