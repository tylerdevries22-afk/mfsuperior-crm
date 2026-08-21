import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { SimulationBanner } from "@/components/operations";
import { Card, Header, KeyValueRow, Screen, SectionHeader, StatTile, StatusBadge } from "@/components/ui";
import { formatCurrency } from "@/lib/operations-format";
import { useOperations } from "@/store";
import { SPACE, TYPO, useTheme } from "@/theme";

export default function AnalyticsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { effectiveRole, shipments, state } = useOperations();
  const visibleShipments = shipments;
  const delivered = visibleShipments.filter((shipment) => shipment.status === "delivered");
  const active = visibleShipments.filter((shipment) => !["delivered", "declined", "cancelled"].includes(shipment.status));
  const totalRevenue = delivered.reduce((total, shipment) => (
    total + shipment.charges.linehaulCents + shipment.charges.fuelSurchargeCents + shipment.charges.accessorialsCents
  ), 0);
  const successfulEdi = state.ediTransactions.filter((transaction) => transaction.status !== "failed").length;
  const ediRate = state.ediTransactions.length === 0 ? 100 : Math.round(successfulEdi / state.ediTransactions.length * 100);
  const openExceptions = state.exceptions.filter((exception) => exception.status !== "resolved").length;

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack subtitle="Local demo scorecard" title="Analytics" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>OPERATIONS PERFORMANCE</Text>
          <Text style={[styles.title, { color: theme.text }]}>Freight at a glance</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>Shipment, service, and integration indicators derived from the locally persistent prototype.</Text>
        </View>

        <SimulationBanner message="These KPIs use seeded prototype records; they are not production performance or Target scorecard data." />

        <View style={styles.statGrid}>
          <StatTile label="Active loads" value={String(active.length)} />
          <StatTile label="Delivered" value={String(delivered.length)} />
          <StatTile label={effectiveRole === "customer" ? "Delivered value" : "Recognized revenue"} value={formatCurrency(totalRevenue)} />
          <StatTile label="EDI success" value={`${ediRate}%`} />
          <StatTile label="Open exceptions" value={String(openExceptions)} />
          <StatTile label="POD captured" value={String(state.proofsOfDelivery.length)} />
        </View>

        <SectionHeader title="Shipment status" />
        <Card padding="none">
          {visibleShipments.map((shipment, index) => (
            <KeyValueRow
              isLast={index === visibleShipments.length - 1}
              key={shipment.id}
              label={shipment.targetLoadId}
              value={shipment.status.replaceAll("_", " ")}
            />
          ))}
        </Card>

        <SectionHeader title="Integration health" />
        <Card padding="none">
          {state.integrations.map((integration, index) => (
            <View key={integration.id}>
              <View style={styles.integrationRow}>
                <View style={styles.grow}>
                  <Text style={[styles.integrationTitle, { color: theme.text }]}>{integration.name}</Text>
                  <Text style={[styles.integrationCopy, { color: theme.textSecondary }]}>{integration.summary}</Text>
                </View>
                <StatusBadge status={integration.status} />
              </View>
              {index < state.integrations.length - 1 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
            </View>
          ))}
        </Card>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { ...TYPO.body },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  divider: { height: 1, marginLeft: SPACE.md },
  eyebrow: { ...TYPO.eyebrow },
  fill: { flex: 1 },
  grow: { flex: 1, gap: 2 },
  integrationCopy: { ...TYPO.caption },
  integrationRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm, padding: SPACE.md },
  integrationTitle: { ...TYPO.rowTitle },
  intro: { gap: SPACE.sm },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  title: { ...TYPO.screenTitle },
});
