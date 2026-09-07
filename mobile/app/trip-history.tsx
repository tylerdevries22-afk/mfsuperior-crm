import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import {
  Card,
  EmptyState,
  Header,
  Screen,
  SectionHeader,
  SegmentedControl,
} from "@/components/ui";
import { formatDayHeader } from "@/route-support/schedule/utils";
import { TripRow } from "@/route-support/trip-history/_components/TripRow";
import { TripSummaryCard } from "@/route-support/trip-history/_components/TripSummaryCard";
import { styles } from "@/route-support/trip-history/styles";
import {
  TRIP_PERIOD_LABELS,
  TRIP_PERIODS,
  buildTrips,
  groupTripsByDay,
  summarizeTrips,
  type TripPeriod,
} from "@/route-support/trip-history/utils";
import { useOperations } from "@/store";
import { useTheme } from "@/theme";

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

        <TripSummaryCard totals={totals} />

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
