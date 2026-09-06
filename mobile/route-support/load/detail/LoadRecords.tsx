import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, View } from "react-native";
import { ProgressTrack, StopTimeline } from "@/components/operations/OperationsUI";
import { Badge, Card, KeyValueRow, ListRow, SectionHeader, StatusBadge } from "@/components/ui";
import type { EdiTransaction, ProofOfDelivery, Shipment, ShipmentStop } from "@/domain/types";
import { formatCurrency, shipmentProgress, shipmentRoute } from "@/lib/operations-format";
import { ICON, useTheme } from "@/theme";
import { styles } from "./styles";

export function LoadSummary({ shipment }: { shipment: Shipment }) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.loadHeader}>
        <View style={styles.grow}>
          <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>FREIGHT LOAD</Text>
          <Text style={[styles.title, { color: theme.text }]}>{shipment.loadNumber}</Text>
          <Text style={[styles.route, { color: theme.textSecondary }]}>{shipmentRoute(shipment)}</Text>
        </View>
        <StatusBadge size="md" status={shipment.status} />
      </View>
      <ProgressTrack value={shipmentProgress(shipment.status)} tone={shipment.status === "exception" ? "warning" : "brand"} />
      <View style={styles.badges}>
        <Badge label={shipment.equipmentType.replaceAll("_", " ")} tone="info" />
        <Badge label={`${shipment.weightPounds.toLocaleString()} lb`} />
        <Badge label={`${shipment.palletCount} pallets`} />
        {shipment.temperatureFahrenheit !== undefined ? <Badge label={`${shipment.temperatureFahrenheit}°F`} tone="warning" /> : null}
      </View>
    </Card>

  );
}

interface LoadRecordsProps {
  shipment: Shipment;
  proof?: ProofOfDelivery;
  shipmentEdi: readonly EdiTransaction[];
  onRoutePlan: () => void;
  setSelectedStop: (stop: ShipmentStop) => void;
}
export function LoadRecords({ shipment, proof, shipmentEdi, onRoutePlan, setSelectedStop }: LoadRecordsProps) {
  const theme = useTheme();
  const chargeTotal = shipment.charges.linehaulCents + shipment.charges.fuelSurchargeCents + shipment.charges.accessorialsCents;
  return <>
    <SectionHeader title="Load information" />
    <Card padding="none">
      <KeyValueRow label="Purchase order" value={shipment.purchaseOrderNumber} />
      <KeyValueRow label="Bill of lading" value={shipment.billOfLadingNumber} />
      <KeyValueRow label="PRO number" value={shipment.proNumber} />
      <KeyValueRow label="Distance" value={`${shipment.distanceMiles.toLocaleString()} miles`} />
      <KeyValueRow label="Commodity" value={shipment.commodity} />
      <KeyValueRow isLast label="Total charges" value={formatCurrency(chargeTotal)} />
    </Card>

    <SectionHeader title="Special instructions" />
    <Card>
      <Text style={[styles.body, { color: theme.textSecondary }]}>{shipment.specialInstructions}</Text>
    </Card>

    <SectionHeader action="Route plan" onAction={onRoutePlan} title="Stops" />
    <Card>
      <StopTimeline onStopPress={setSelectedStop} stops={shipment.stops} />
    </Card>

    {proof ? (
      <>
        <SectionHeader title="Proof of delivery" />
        <Card>
          <View style={styles.noticeRow}>
            <View style={[styles.successMark, { backgroundColor: theme.successMuted }]}>
              <Ionicons color={theme.success} name="checkmark" size={ICON.md} />
            </View>
            <View style={styles.grow}>
              <Text style={[styles.noticeTitle, { color: theme.text }]}>Received by {proof.recipientName}</Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>{proof.attachments.length} attachment{proof.attachments.length === 1 ? "" : "s"} · {new Date(proof.submittedAt).toLocaleString()}</Text>
            </View>
            <StatusBadge status={proof.status} />
          </View>
        </Card>
      </>
    ) : null}

    <SectionHeader title="Milestone timeline" />
    <Card padding="none">
      {shipment.events.slice().reverse().map((event, index) => (
        <ListRow
          isLast={index === shipment.events.length - 1}
          key={event.id}
          meta={`${event.eventCode} · ${event.source}`}
          subtitle={new Date(event.occurredAt).toLocaleString()}
          title={event.description}
          trailing={event.resultingStatus ? <StatusBadge status={event.resultingStatus} /> : undefined}
        />
      ))}
    </Card>

    <SectionHeader title="EDI audit" />
    <Card padding="none">
      {shipmentEdi.map((transaction, index) => (
        <ListRow
          isLast={index === shipmentEdi.length - 1}
          key={transaction.id}
          meta={`${transaction.direction} · ${transaction.controlNumber}`}
          subtitle={transaction.summary}
          title={`${transaction.transactionType} transaction`}
          trailing={<StatusBadge status={transaction.status} />}
        />
      ))}
    </Card>
  </>;
}
