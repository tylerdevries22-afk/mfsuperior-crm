import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  Card,
  EmptyState,
  Header,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatusBadge,
} from "@/components/ui";
import {
  TRIP_PERIOD_LABELS,
  TRIP_PERIODS,
  buildTrips,
  formatCents,
  formatDuration,
  groupTripsByDay,
  summarizeTrips,
  wasOnTime,
  type Trip,
  type TripPeriod,
} from "@/route-support/trip-history/utils";
import { formatDayHeader } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { ICON, SPACE, TYPO, useTheme } from "@/theme";

const PERIOD_OPTIONS = TRIP_PERIODS.map((period) => ({
  label: TRIP_PERIOD_LABELS[period],
  value: period,
}));

export default function TripHistoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentDriver, effectiveRole, shipments } = useOperations();
  const [period, setPeriod] = useState<TripPeriod>("month");

  const trips = useMemo(
    () => currentDriver ? buildTrips(shipments, currentDriver.id, period) : [],
    [currentDriver, period, shipments],
  );
  const totals = useMemo(() => summarizeTrips(trips), [trips]);
  const groups = useMemo(() => groupTripsByDay(trips), [trips]);

  if (effectiveRole !== "driver" || !currentDriver) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Trip history" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="map" size={36} />}
            message="Trip history follows a driver's own delivered loads. Switch to a driver account to see it."
            title="Driver role required"
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header
        centered
        onBack={() => router.back()}
        showBack
        subtitle="Delivered loads and what they earned"
        title="Trip history"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <SegmentedControl
          accessibilityLabel="Trip history period"
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
          value={period}
        />

        <Card>
          <View style={styles.totalsRow}>
            <Total label="Loads" value={String(totals.loads)} />
            <Total label="Miles" value={totals.miles.toLocaleString()} />
            <Total label="Earned" value={formatCents(totals.earningsCents)} />
          </View>
          {totals.onTimeRate !== null ? (
            <View style={[styles.onTimeRow, { borderTopColor: theme.border }]}>
              <Feather
                color={totals.onTimeRate >= 0.95 ? theme.success : theme.warning}
                name="clock"
                size={ICON.sm}
              />
              <Text style={[styles.onTimeText, { color: theme.textSecondary }]}>
                {Math.round(totals.onTimeRate * 100)}% delivered inside the appointment window
              </Text>
            </View>
          ) : null}
          <Text style={[styles.estimateNote, { color: theme.textMuted }]}>
            Earnings are what each load is worth at your pay rate. Your settlement ledger is the
            record of what was paid.
          </Text>
        </Card>

        {groups.length === 0 ? (
          <EmptyState
            icon={<Feather color={theme.textMuted} name="map" size={36} />}
            message={`No delivered loads ${period === "all" ? "yet" : `in ${TRIP_PERIOD_LABELS[period].toLowerCase()}`}.`}
            title="Nothing to show"
          />
        ) : (
          groups.map((group) => (
            <View key={group.dateKey} style={styles.group}>
              <SectionHeader title={formatDayHeader(group.dateKey)} />
              <Card padding="none">
                {group.trips.map((trip, index) => (
                  <TripRow
                    isLast={index === group.trips.length - 1}
                    key={trip.shipment.id}
                    onPress={() => router.push({
                      params: { id: trip.shipment.id },
                      pathname: "/load/[id]",
                    })}
                    trip={trip}
                  />
                ))}
              </Card>
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}

function TripRow({
  isLast,
  onPress,
  trip,
}: {
  readonly isLast: boolean;
  readonly onPress: () => void;
  readonly trip: Trip;
}) {
  const theme = useTheme();
  const onTime = wasOnTime(trip.shipment);
  return (
    <ListRow
      isLast={isLast}
      onPress={onPress}
      rich
      subtitle={`${trip.origin} → ${trip.destination}`}
      title={trip.shipment.loadNumber}
      trailing={
        <View style={styles.trailing}>
          <Text style={[styles.trailingValue, { color: theme.text }]}>
            {formatCents(trip.earningsCents)}
          </Text>
          <Text style={[styles.trailingMeta, { color: theme.textMuted }]}>
            {trip.miles.toLocaleString()} mi · {formatDuration(trip.durationMinutes)}
          </Text>
          {onTime === false ? (
            <StatusBadge showDot={false} size="sm" status="late" />
          ) : null}
        </View>
      }
    />
  );
}

function Total({ label, value }: { readonly label: string; readonly value: string }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel={`${value} ${label}`} style={styles.total}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        numberOfLines={1}
        style={[styles.totalValue, { color: theme.text }]}
      >
        {value}
      </Text>
      <Text style={[styles.totalLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  estimateNote: { ...TYPO.subtitle, lineHeight: 16 },
  fill: { flex: 1 },
  group: { gap: SPACE.xs },
  onTimeRow: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: SPACE.xs,
    paddingTop: SPACE.sm,
  },
  onTimeText: { ...TYPO.caption, flex: 1 },
  total: { alignItems: "center", flex: 1, gap: 2 },
  totalLabel: { ...TYPO.metricLabel },
  totalValue: { ...TYPO.metric, fontSize: 22, lineHeight: 26 },
  totalsRow: { flexDirection: "row", gap: SPACE.sm },
  trailing: { alignItems: "flex-end", gap: 2, maxWidth: 140 },
  trailingMeta: { ...TYPO.subtitle },
  trailingValue: { ...TYPO.rowTitle },
});
