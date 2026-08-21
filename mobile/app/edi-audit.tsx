import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { Card, EmptyState, Header, ListRow, Screen, SectionHeader, StatTile, StatusBadge } from "@/components/ui";
import { formatStatus } from "@/lib/operations-format";
import { useOperations } from "@/store";
import { SPACE, useTheme } from "@/theme";

export default function EdiAuditScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { ediTransactions, shipments } = useOperations();
  const transactions = useMemo(
    () => [...ediTransactions].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [ediTransactions],
  );
  const outboundCount = transactions.filter(({ direction }) => direction === "outbound").length;
  const attentionCount = transactions.filter(({ status }) => status === "failed").length;

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack subtitle="Validated transaction history" title="X12 audit" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <View style={styles.stats}>
          <StatTile label="Transactions" value={String(transactions.length)} />
          <StatTile label="Outbound" value={String(outboundCount)} />
          <StatTile label="Needs review" value={String(attentionCount)} />
        </View>
        <SectionHeader title="204 · 990 · 214 · 210 · 997" />
        {transactions.length ? (
          <Card padding="none">
            {transactions.map((transaction, index) => {
              const shipment = shipments.find(({ id }) => id === transaction.shipmentId);
              return (
                <ListRow
                  isLast={index === transactions.length - 1}
                  key={transaction.id}
                  meta={formatStatus(transaction.direction)}
                  subtitle={`${transaction.summary} · ${new Date(transaction.createdAt).toLocaleString()}`}
                  title={`${transaction.transactionType} · ${shipment?.loadNumber ?? "Unlinked"}`}
                  trailing={<StatusBadge status={transaction.status} />}
                />
              );
            })}
          </Card>
        ) : <EmptyState description="Validated partner transactions will appear here after onboarding." title="No transactions" />}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  fill: { flex: 1 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
});
