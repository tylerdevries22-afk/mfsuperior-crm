import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, EmptyState, Header, ListRow, Screen, SegmentedControl, StatusBadge } from "@/components/ui";
import { shipmentRoute } from "@/lib/operations-format";
import { useOperations } from "@/store";
import { SPACE, TYPO, useTheme } from "@/theme";

type HistoryMode = "shipments" | "events" | "pod";

export default function HistoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { shipments, state } = useOperations();
  const [mode, setMode] = useState<HistoryMode>("shipments");
  const visibleShipments = shipments;
  const visibleIds = new Set(visibleShipments.map((shipment) => shipment.id));
  const events = visibleShipments.flatMap((shipment) => shipment.events.map((event) => ({ event, shipment })));
  const proofs = state.proofsOfDelivery.filter((proof) => visibleIds.has(proof.shipmentId));

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack title="History" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={[styles.title, { color: theme.text }]}>Operational record</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>Review load milestones, EDI-coded events, and delivery proof.</Text>
        </View>
        <SegmentedControl
          accessibilityLabel="History category"
          onChange={setMode}
          options={[
            { label: "Loads", value: "shipments" },
            { label: "Events", value: "events" },
            { label: "POD", value: "pod" },
          ]}
          value={mode}
        />

        {mode === "shipments" ? (
          visibleShipments.length ? (
            <Card padding="none">
              {visibleShipments.map((shipment, index) => (
                <ListRow
                  isLast={index === visibleShipments.length - 1}
                  key={shipment.id}
                  meta={shipment.loadNumber}
                  onPress={() => router.push({ pathname: "/load/[id]", params: { id: shipment.id } })}
                  subtitle={shipmentRoute(shipment)}
                  title={shipment.commodity}
                  trailing={<StatusBadge status={shipment.status} />}
                />
              ))}
            </Card>
          ) : <EmptyState description="No shipments are available for this role." title="No load history" />
        ) : null}

        {mode === "events" ? (
          events.length ? (
            <Card padding="none">
              {events.slice().reverse().map(({ event, shipment }, index) => (
                <ListRow
                  isLast={index === events.length - 1}
                  key={event.id}
                  meta={`${event.eventCode} · ${shipment.loadNumber}`}
                  onPress={() => router.push({ pathname: "/load/[id]", params: { id: shipment.id } })}
                  subtitle={`${new Date(event.occurredAt).toLocaleString()} · ${event.source}`}
                  title={event.description}
                  trailing={<StatusBadge status={event.resultingStatus ?? event.type} />}
                />
              ))}
            </Card>
          ) : <EmptyState description="Shipment actions will appear here." title="No events yet" />
        ) : null}

        {mode === "pod" ? (
          proofs.length ? (
            <Card padding="none">
              {proofs.map((proof, index) => {
                const shipment = visibleShipments.find((candidate) => candidate.id === proof.shipmentId);
                return (
                  <ListRow
                    isLast={index === proofs.length - 1}
                    key={proof.id}
                    meta={shipment?.loadNumber ?? proof.shipmentId}
                    onPress={() => router.push({ pathname: "/load/[id]", params: { id: proof.shipmentId } })}
                    subtitle={`${proof.attachments.length} attachment${proof.attachments.length === 1 ? "" : "s"} · ${new Date(proof.submittedAt).toLocaleString()}`}
                    title={`Received by ${proof.recipientName}`}
                    trailing={<StatusBadge status={proof.status} />}
                  />
                );
              })}
            </Card>
          ) : <EmptyState description="Completed delivery proof will appear here." title="No POD records" />
        ) : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { ...TYPO.body },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  fill: { flex: 1 },
  intro: { gap: SPACE.xs },
  title: { ...TYPO.screenTitle },
});
