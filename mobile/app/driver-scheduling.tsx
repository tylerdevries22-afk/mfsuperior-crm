import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { Card, EmptyState, Header, ListRow, Screen, SectionHeader, StatusBadge } from "@/components/ui";
import { AssignSheet } from "@/route-support/driver-scheduling/_components/AssignSheet";
import { ScheduleBoard } from "@/route-support/driver-scheduling/_components/ScheduleBoard";
import { WeekNav } from "@/route-support/driver-scheduling/_components/WeekNav";
import { styles } from "@/route-support/driver-scheduling/styles";
import {
  buildDriverWeeks,
  summarizeWeek,
  unassignedLoads,
  weekDayKeys,
} from "@/route-support/driver-scheduling/utils";
import { formatTime, scheduledStart } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { useTheme } from "@/theme";

export default function DriverSchedulingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const {
    actions,
    availabilityBlocks,
    availabilityRules,
    effectiveRole,
    shipments,
    state,
  } = useOperations();

  const [weekOffset, setWeekOffset] = useState(0);
  const [assigning, setAssigning] = useState<{ driverId: string; dateKey: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const dayKeys = useMemo(() => {
    const anchor = new Date();
    anchor.setDate(anchor.getDate() + weekOffset * 7);
    return weekDayKeys(anchor);
  }, [weekOffset]);

  const weeks = useMemo(
    () => buildDriverWeeks(state.drivers, shipments, availabilityBlocks, availabilityRules, dayKeys),
    [availabilityBlocks, availabilityRules, dayKeys, shipments, state.drivers],
  );
  const openLoads = useMemo(() => unassignedLoads(shipments), [shipments]);
  const totals = useMemo(
    () => summarizeWeek(weeks, openLoads, dayKeys),
    [dayKeys, openLoads, weeks],
  );

  const assign = useCallback(async (shipmentId: string) => {
    if (!assigning) {
      return;
    }
    setBusy(true);
    const assigned = await actions.assignShipment(shipmentId, assigning.driverId);
    setBusy(false);
    if (assigned) {
      setAssigning(null);
    }
  }, [actions, assigning]);

  if (effectiveRole !== "admin") {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Driver scheduling" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="users" size={36} />}
            message="The scheduling board is an admin console. Switch to an admin account to open it."
            title="Admin role required"
          />
        </Screen>
      </View>
    );
  }

  const assigningDriver = assigning
    ? state.drivers.find((driver) => driver.id === assigning.driverId) ?? null
    : null;

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header
        centered
        onBack={() => router.back()}
        showBack
        subtitle={`${totals.assigned} assigned · ${totals.unassigned} open`}
        title="Driver scheduling"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <WeekNav
          conflicts={totals.conflicts}
          dayKeys={dayKeys}
          onNext={() => setWeekOffset((current) => current + 1)}
          onPrevious={() => setWeekOffset((current) => current - 1)}
          onThisWeek={() => setWeekOffset(0)}
          showThisWeek={weekOffset !== 0}
        />

        <SectionHeader title="Drivers" />
        <ScheduleBoard
          dayKeys={dayKeys}
          onOpenCell={(driverId, dateKey) => setAssigning({ dateKey, driverId })}
          weeks={weeks}
        />

        <SectionHeader
          action="Dispatch board"
          onAction={() => router.push("/jobs")}
          title={`Unassigned loads (${openLoads.length})`}
        />
        {openLoads.length === 0 ? (
          <Card variant="tinted">
            <Text style={[styles.emptyNote, { color: theme.textSecondary }]}>
              Every load has a driver.
            </Text>
          </Card>
        ) : (
          <Card padding="none">
            {openLoads.map((load, index) => (
              <ListRow
                isLast={index === openLoads.length - 1}
                key={load.id}
                onPress={() => router.push({ params: { id: load.id }, pathname: "/load/[id]" })}
                subtitle={scheduledStart(load) ? formatTime(scheduledStart(load) as string) : "Unscheduled"}
                title={load.loadNumber}
                trailing={<StatusBadge size="sm" status={load.status} />}
              />
            ))}
          </Card>
        )}
      </Screen>

      {assigning ? (
        <AssignSheet
          busy={busy}
          driver={assigningDriver}
          loads={openLoads}
          onAssign={(shipmentId) => void assign(shipmentId)}
          onClose={() => setAssigning(null)}
        />
      ) : null}
    </View>
  );
}
