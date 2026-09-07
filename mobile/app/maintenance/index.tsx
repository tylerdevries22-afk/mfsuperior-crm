import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";

import {
  AnimatedButton,
  Card,
  EmptyState,
  Header,
  Screen,
  SegmentedControl,
} from "@/components/ui";
import { MaintenanceTotals } from "@/route-support/maintenance/_components/MaintenanceTotals";
import { OrderRow } from "@/route-support/maintenance/_components/OrderRow";
import {
  WorkOrderSheet,
  type WorkOrderDraft,
} from "@/route-support/maintenance/_components/WorkOrderSheet";
import { styles } from "@/route-support/maintenance/styles";
import {
  buildMaintenanceEntries,
  summarizeMaintenance,
} from "@/route-support/maintenance/utils";
import { formatCents } from "@/route-support/trip-history/utils";
import { useOperations } from "@/store";
import { useTheme } from "@/theme";

type ShopFilter = "open" | "all";

const FILTER_OPTIONS = [
  { label: "Open", value: "open" as const },
  { label: "All", value: "all" as const },
];

export default function MaintenanceScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { actions, effectiveRole, maintenanceOrders, state, vehicles } = useOperations();

  const [filter, setFilter] = useState<ShopFilter>("open");
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<WorkOrderDraft>({
    description: "",
    kind: "repair",
    severity: "medium",
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
        <MaintenanceTotals
          critical={totals.critical}
          open={totals.open}
          scheduled={totals.scheduled}
        />

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
        <WorkOrderSheet
          busy={busy}
          canSubmit={canSubmit}
          draft={draft}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          onClose={() => setComposing(false)}
          onSubmit={() => void create()}
          vehicles={vehicles}
        />
      ) : null}
    </View>
  );
}
