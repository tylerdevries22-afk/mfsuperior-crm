import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FleetRow } from "@/route-support/fleet/FleetRow";
import {
  EmptyState,
  Header,
  Screen,
  SegmentedControl,
} from "@/components/ui";
import {
  buildFleetEntries,
  summarizeFleet,
} from "@/route-support/fleet/utils";
import { useOperations } from "@/store";
import { RADIUS, SPACE, TYPO, useTheme } from "@/theme";

type FleetFilter = "all" | "trailer";

export type FleetScreenProps = {
  readonly isTab?: boolean;
};

const FILTER_OPTIONS = [
  { label: "All", value: "all" as const },
  { label: "Trailers", value: "trailer" as const },
];

export function FleetScreen({ isTab = false }: FleetScreenProps = {}) {
  const router = useRouter();
  const theme = useTheme();
  const {
    complianceDocuments,
    effectiveRole,
    maintenanceOrders,
    state,
    vehicles,
  } = useOperations();
  const [filter, setFilter] = useState<FleetFilter>("all");

  const entries = useMemo(
    () => buildFleetEntries(vehicles, state.drivers, maintenanceOrders, complianceDocuments),
    [complianceDocuments, maintenanceOrders, state.drivers, vehicles],
  );
  const visible = useMemo(
    () => filter === "all" ? entries : entries.filter((entry) => entry.vehicle.type === filter),
    [entries, filter],
  );
  const totals = useMemo(() => summarizeFleet(entries), [entries]);

  if (effectiveRole !== "admin") {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Fleet" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="truck" size={36} />}
            message="The fleet register is a dispatch console. Switch to an admin account to open it."
            title="Admin role required"
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header
        onBack={isTab ? undefined : () => router.back()}
        showBack={!isTab}
        subtitle={`${totals.total} units · ${totals.active} active`}
        title="Fleet"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <View style={styles.totalsRow}>
          <Total label="Active" value={totals.active} />
          <Total label="Down" tone={totals.down > 0 ? "warning" : undefined} value={totals.down} />
          <Total label="Unassigned" value={totals.unassigned} />
        </View>

        <SegmentedControl
          accessibilityLabel="Filter fleet by type"
          onChange={setFilter}
          options={FILTER_OPTIONS}
          value={filter}
        />

        {visible.length === 0 ? (
          <EmptyState
            icon={<Feather color={theme.textMuted} name="truck" size={36} />}
            message="No units match this filter."
            title="Nothing here"
          />
        ) : (
          <View style={styles.cardGrid}>
            {visible.map((entry) => (
              <FleetRow
                entry={entry}
                key={entry.vehicle.id}
                onPress={() => router.push({
                  params: { id: entry.vehicle.id },
                  pathname: "/fleet/[id]",
                })}
              />
            ))}
          </View>
        )}
      </Screen>
    </View>
  );
}

export default FleetScreen;

function Total({
  label,
  tone,
  value,
}: {
  readonly label: string;
  readonly tone?: "warning";
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
          { color: tone === "warning" && value > 0 ? theme.warning : theme.text },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.totalLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { gap: SPACE.sm, paddingBottom: SPACE.xxl },
  cardGrid: { gap: SPACE.sm },
  totalsRow: { flexDirection: "row", gap: SPACE.sm },
  total: { flex: 1, alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, gap: 2, paddingVertical: 10 },
  totalValue: { ...TYPO.heading },
  totalLabel: { ...TYPO.metricLabel, fontSize: 10 },
});
