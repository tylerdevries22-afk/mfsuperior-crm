import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  AnimatedButton,
  Badge,
  Card,
  EmptyState,
  Header,
  ListRow,
  Screen,
  SegmentedControl,
  Sheet,
  StatusBadge,
  TextArea,
  TextField,
} from "@/components/ui";
import type { MaintenanceKind, MaintenanceSeverity } from "@/domain/types";
import {
  MAINTENANCE_SEVERITY_LABELS,
  MAINTENANCE_STATUS_LABELS,
  buildMaintenanceEntries,
  severityTone,
  summarizeMaintenance,
  type MaintenanceEntry,
} from "@/route-support/maintenance/utils";
import { SelectChip } from "@/route-support/maintenance/_components/SelectChip";
import { formatCents } from "@/route-support/trip-history/utils";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

type ShopFilter = "open" | "all";

const FILTER_OPTIONS = [
  { label: "Open", value: "open" as const },
  { label: "All", value: "all" as const },
];

const KIND_OPTIONS: readonly { readonly label: string; readonly value: MaintenanceKind }[] = [
  { label: "Repair", value: "repair" },
  { label: "Preventive", value: "preventive" },
  { label: "Inspection", value: "inspection" },
];

const SEVERITY_OPTIONS: readonly MaintenanceSeverity[] = ["low", "medium", "high", "critical"];

export default function MaintenanceScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { actions, effectiveRole, maintenanceOrders, state, vehicles } = useOperations();

  const [filter, setFilter] = useState<ShopFilter>("open");
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    description: "",
    kind: "repair" as MaintenanceKind,
    severity: "medium" as MaintenanceSeverity,
    summary: "",
    vehicleId: "",
  });

  const entries = useMemo(
    () => buildMaintenanceEntries(maintenanceOrders, vehicles, state.drivers),
    [maintenanceOrders, state.drivers, vehicles],
  );
  const visible = useMemo(
    () => filter === "open" ? entries.filter((entry) => entry.isOpen) : entries,
    [entries, filter],
  );
  const totals = useMemo(() => summarizeMaintenance(entries), [entries]);

  const openComposer = useCallback(() => {
    setDraft({
      description: "",
      kind: "repair",
      severity: "medium",
      summary: "",
      vehicleId: vehicles[0]?.id ?? "",
    });
    setComposing(true);
  }, [vehicles]);

  const create = useCallback(async () => {
    setBusy(true);
    const created = await actions.createMaintenanceOrder({
      description: draft.description.trim(),
      kind: draft.kind,
      severity: draft.severity,
      summary: draft.summary.trim(),
      vehicleId: draft.vehicleId,
    });
    setBusy(false);
    if (created) {
      setComposing(false);
    }
  }, [actions, draft]);

  if (effectiveRole !== "admin") {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Repairs & maintenance" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="tool" size={36} />}
            message="The shop board is an admin console. Switch to an admin account to open it."
            title="Admin role required"
          />
        </Screen>
      </View>
    );
  }

  const canSubmit = draft.summary.trim().length > 2 && draft.vehicleId.length > 0;

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header
        centered
        onBack={() => router.back()}
        rightAction={
          <AnimatedButton
            accessibilityLabel="Open a work order"
            onPress={openComposer}
            size="sm"
            title="New"
          />
        }
        showBack
        subtitle={`${totals.open} open · ${formatCents(totals.openCostCents)} committed`}
        title="Repairs & maintenance"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <View style={styles.totalsRow}>
          <Total label="Open" value={totals.open} />
          <Total label="Scheduled" value={totals.scheduled} />
          <Total
            label="Critical"
            tone={totals.critical > 0 ? "danger" : undefined}
            value={totals.critical}
          />
        </View>

        <SegmentedControl
          accessibilityLabel="Work order filter"
          onChange={setFilter}
          options={FILTER_OPTIONS}
          value={filter}
        />

        {visible.length === 0 ? (
          <EmptyState
            icon={<Feather color={theme.textMuted} name="check-circle" size={36} />}
            message={filter === "open" ? "Nothing is in the shop." : "No work orders recorded yet."}
            title="All clear"
          />
        ) : (
          <Card padding="none">
            {visible.map((entry, index) => (
              <OrderRow
                entry={entry}
                isLast={index === visible.length - 1}
                key={entry.order.id}
                onPress={() => router.push({
                  params: { id: entry.order.id },
                  pathname: "/maintenance/[id]",
                })}
              />
            ))}
          </Card>
        )}
      </Screen>

      {composing ? (
        <Sheet
          footer={
            <AnimatedButton
              accessibilityLabel="Open this work order"
              disabled={!canSubmit}
              fullWidth
              loading={busy}
              onPress={() => void create()}
              title="Open work order"
            />
          }
          onClose={() => setComposing(false)}
          title="New work order"
          visible
        >
          <View style={styles.composer}>
            <Text style={[styles.label, { color: theme.textMuted }]}>UNIT</Text>
            <View style={styles.chipRow}>
              {vehicles.map((vehicle) => (
                <SelectChip
                  key={vehicle.id}
                  label={`Unit ${vehicle.unitNumber}`}
                  onPress={() => setDraft((current) => ({ ...current, vehicleId: vehicle.id }))}
                  selected={draft.vehicleId === vehicle.id}
                />
              ))}
            </View>

            <Text style={[styles.label, { color: theme.textMuted }]}>KIND</Text>
            <View style={styles.chipRow}>
              {KIND_OPTIONS.map((option) => (
                <SelectChip
                  key={option.value}
                  label={option.label}
                  onPress={() => setDraft((current) => ({ ...current, kind: option.value }))}
                  selected={draft.kind === option.value}
                />
              ))}
            </View>

            <Text style={[styles.label, { color: theme.textMuted }]}>SEVERITY</Text>
            <View style={styles.chipRow}>
              {SEVERITY_OPTIONS.map((option) => (
                <SelectChip
                  key={option}
                  label={MAINTENANCE_SEVERITY_LABELS[option]}
                  onPress={() => setDraft((current) => ({ ...current, severity: option }))}
                  selected={draft.severity === option}
                />
              ))}
            </View>
            {draft.severity === "critical" ? (
              <View
                style={[
                  styles.criticalNote,
                  { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium },
                ]}
              >
                <Feather color={theme.danger} name="alert-octagon" size={ICON.sm} />
                <Text style={[styles.criticalText, { color: theme.text }]}>
                  A critical order takes the unit out of service and releases its driver.
                </Text>
              </View>
            ) : null}

            <TextField
              label="Summary"
              onChangeText={(summary) => setDraft((current) => ({ ...current, summary }))}
              placeholder="Aftertreatment fault — derate warning"
              value={draft.summary}
            />
            <TextArea
              label="Details"
              onChangeText={(description) => setDraft((current) => ({ ...current, description }))}
              placeholder="What the driver reported, and where the unit is now."
              value={draft.description}
            />
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}

function OrderRow({
  entry,
  isLast,
  onPress,
}: {
  readonly entry: MaintenanceEntry;
  readonly isLast: boolean;
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  const { order, vehicle } = entry;
  return (
    <ListRow
      isLast={isLast}
      leading={
        <View style={[styles.kindWell, { backgroundColor: theme.surfaceElevated }]}>
          <Feather
            color={theme.primaryLight}
            name={order.kind === "inspection" ? "check-square" : order.kind === "preventive" ? "calendar" : "tool"}
            size={ICON.md}
          />
        </View>
      }
      onPress={onPress}
      rich
      subtitle={`${vehicle ? `Unit ${vehicle.unitNumber}` : "Unknown unit"} · opened ${new Date(order.openedAt).toLocaleDateString()}`}
      title={order.summary}
      trailing={
        <View style={styles.trailing}>
          <StatusBadge size="sm" status={MAINTENANCE_STATUS_LABELS[order.status]} />
          <Badge
            label={MAINTENANCE_SEVERITY_LABELS[order.severity]}
            showDot={false}
            size="sm"
            tone={severityTone(order.severity)}
          />
        </View>
      }
    />
  );
}

function Total({
  label,
  tone,
  value,
}: {
  readonly label: string;
  readonly tone?: "danger";
  readonly value: number;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={`${value} ${label}`}
      style={[styles.total, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Text
        style={[
          styles.totalValue,
          { color: tone === "danger" && value > 0 ? theme.danger : theme.text },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.totalLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
  composer: { gap: SPACE.sm, paddingBottom: SPACE.md },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  criticalNote: {
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.xs,
    padding: SPACE.sm,
  },
  criticalText: { ...TYPO.caption, flex: 1 },
  fill: { flex: 1 },
  kindWell: { alignItems: "center", borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  label: { ...TYPO.label, marginTop: SPACE.xs },
  total: {
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingVertical: SPACE.md,
  },
  totalLabel: { ...TYPO.metricLabel },
  totalValue: { ...TYPO.metric },
  totalsRow: { flexDirection: "row", gap: SPACE.sm },
  trailing: { alignItems: "flex-end", gap: SPACE.xxs },
});
