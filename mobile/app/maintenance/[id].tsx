import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  AnimatedButton,
  Badge,
  Card,
  EmptyState,
  Header,
  KeyValueRow,
  Screen,
  SectionHeader,
  statusLabel,
  StatusBadge,
} from "@/components/ui";
import type { MaintenanceStatus } from "@/domain/types";
import {
  MAINTENANCE_SEVERITY_LABELS,
  MAINTENANCE_STATUS_LABELS,
  severityTone,
} from "@/route-support/maintenance/utils";
import { driverFullName } from "@/route-support/schedule/utils";
import { formatCents } from "@/route-support/trip-history/utils";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

/** The states an open order can be moved to, in the order the shop moves them. */
const NEXT_STATUSES: readonly MaintenanceStatus[] = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

export default function MaintenanceDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { actions, effectiveRole, maintenanceOrders, state, vehicles } = useOperations();
  const [busy, setBusy] = useState<MaintenanceStatus | null>(null);

  const order = useMemo(
    () => maintenanceOrders.find((candidate) => candidate.id === id) ?? null,
    [id, maintenanceOrders],
  );
  const vehicle = useMemo(
    () => order ? vehicles.find((candidate) => candidate.id === order.vehicleId) ?? null : null,
    [order, vehicles],
  );
  const reportedBy = useMemo(
    () => order?.reportedByDriverId
      ? state.drivers.find((candidate) => candidate.id === order.reportedByDriverId) ?? null
      : null,
    [order, state.drivers],
  );

  const move = useCallback(async (status: MaintenanceStatus) => {
    if (!order) {
      return;
    }
    setBusy(status);
    await actions.updateMaintenanceOrder(order.id, { status });
    setBusy(null);
  }, [actions, order]);

  if (effectiveRole !== "admin" || !order) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Work order" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="tool" size={36} />}
            message={effectiveRole === "admin"
              ? "That work order no longer exists."
              : "The shop board is an admin console. Switch to an admin account to open it."}
            title={effectiveRole === "admin" ? "Not found" : "Admin role required"}
          />
        </Screen>
      </View>
    );
  }

  const isClosed = order.status === "completed" || order.status === "cancelled";

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header
        centered
        onBack={() => router.back()}
        showBack
        subtitle={vehicle ? `Unit ${vehicle.unitNumber}` : "Unassigned unit"}
        title="Work order"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <Card>
          <Text style={[styles.summary, { color: theme.text }]}>{order.summary}</Text>
          <View style={styles.badgeRow}>
            <StatusBadge status={MAINTENANCE_STATUS_LABELS[order.status]} />
            <Badge
              label={`${MAINTENANCE_SEVERITY_LABELS[order.severity]} severity`}
              showDot={false}
              tone={severityTone(order.severity)}
            />
          </View>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {order.description || "No further detail recorded."}
          </Text>
        </Card>

        <SectionHeader title="Record" />
        <Card padding="none">
          <KeyValueRow label="Kind" value={statusLabel(order.kind)} />
          <KeyValueRow label="Opened" value={new Date(order.openedAt).toLocaleString()} />
          {order.scheduledFor ? (
            <KeyValueRow label="Scheduled" value={new Date(order.scheduledFor).toLocaleString()} />
          ) : null}
          {order.completedAt ? (
            <KeyValueRow label="Completed" value={new Date(order.completedAt).toLocaleString()} />
          ) : null}
          {order.odometerMiles ? (
            <KeyValueRow label="Odometer" value={`${order.odometerMiles.toLocaleString()} mi`} />
          ) : null}
          {order.vendorName ? <KeyValueRow label="Vendor" value={order.vendorName} /> : null}
          {reportedBy ? (
            <KeyValueRow label="Reported by" value={driverFullName(reportedBy)} />
          ) : null}
          <KeyValueRow
            isLast
            label="Cost"
            value={order.costCents === undefined ? "Not recorded" : formatCents(order.costCents)}
          />
        </Card>

        {vehicle ? (
          <AnimatedButton
            accessibilityLabel={`Open unit ${vehicle.unitNumber}`}
            fullWidth
            onPress={() => router.push({ params: { id: vehicle.id }, pathname: "/fleet/[id]" })}
            title={`Open unit ${vehicle.unitNumber}`}
            variant="outline"
          />
        ) : null}

        <SectionHeader title="Move this order" />
        {isClosed ? (
          <View
            style={[
              styles.closedNote,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
            ]}
          >
            <Feather color={theme.textMuted} name="lock" size={ICON.sm} />
            <Text style={[styles.closedText, { color: theme.textSecondary }]}>
              This order is {MAINTENANCE_STATUS_LABELS[order.status].toLowerCase()} and can no
              longer be changed. Open a new one if the unit needs more work.
            </Text>
          </View>
        ) : (
          <View style={styles.actions}>
            {NEXT_STATUSES.filter((status) => status !== order.status).map((status) => (
              <AnimatedButton
                accessibilityLabel={`Mark as ${MAINTENANCE_STATUS_LABELS[status]}`}
                fullWidth
                key={status}
                loading={busy === status}
                onPress={() => void move(status)}
                title={MAINTENANCE_STATUS_LABELS[status]}
                variant={status === "completed" ? "primary" : status === "cancelled" ? "danger" : "outline"}
              />
            ))}
            <Text style={[styles.releaseNote, { color: theme.textMuted }]}>
              Closing the last open order on a unit puts it back in service.
            </Text>
          </View>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: SPACE.xs },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
  closedNote: {
    alignItems: "flex-start",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
  },
  closedText: { ...TYPO.caption, flex: 1 },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  description: { ...TYPO.body },
  fill: { flex: 1 },
  releaseNote: { ...TYPO.subtitle, lineHeight: 16, marginTop: SPACE.xxs },
  summary: { ...TYPO.heading },
});
