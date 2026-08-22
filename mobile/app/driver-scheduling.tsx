import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import {
  AnimatedPressable,
  Card,
  EmptyState,
  Header,
  IconButton,
  ListRow,
  Screen,
  SectionHeader,
  Sheet,
  StatusBadge,
} from "@/components/ui";
import type { Shipment } from "@/domain/types";
import {
  buildDriverWeeks,
  dayNumber,
  shortDayLabel,
  summarizeWeek,
  unassignedLoads,
  weekDayKeys,
  weekRangeLabel,
  type DriverWeek,
  type ScheduleCell,
} from "@/route-support/driver-scheduling/utils";
import { driverFullName, formatTime, scheduledStart } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { ICON, RADIUS, RADIUS_DENSE, SPACE, TYPO, useTheme } from "@/theme";

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
        <Card>
          <View style={styles.weekHeader}>
            <IconButton
              icon="chevron-left"
              label="Previous week"
              onPress={() => setWeekOffset((current) => current - 1)}
              variant="surface"
            />
            <View style={styles.weekLabelWrap}>
              <Text style={[styles.weekLabel, { color: theme.text }]}>
                {weekRangeLabel(dayKeys)}
              </Text>
              {weekOffset !== 0 ? (
                <AnimatedPressable
                  accessibilityLabel="Jump to this week"
                  haptic="selection"
                  onPress={() => setWeekOffset(0)}
                >
                  <Text style={[styles.todayLink, { color: theme.primaryLight }]}>This week</Text>
                </AnimatedPressable>
              ) : null}
            </View>
            <IconButton
              icon="chevron-right"
              label="Next week"
              onPress={() => setWeekOffset((current) => current + 1)}
              variant="surface"
            />
          </View>

          {totals.conflicts > 0 ? (
            <View
              accessibilityRole="alert"
              style={[
                styles.conflictBanner,
                { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium },
              ]}
            >
              <Feather color={theme.danger} name="alert-triangle" size={ICON.sm} />
              <Text style={[styles.conflictText, { color: theme.text }]}>
                {totals.conflicts} day{totals.conflicts === 1 ? "" : "s"} where a driver is carrying
                a load through time they marked off.
              </Text>
            </View>
          ) : null}
        </Card>

        <SectionHeader title="Drivers" />
        <Card padding="none">
          <View style={[styles.dayHeaderRow, { borderBottomColor: theme.border }]}>
            <View style={styles.driverColumn} />
            {dayKeys.map((dateKey) => (
              <View key={dateKey} style={styles.dayHeader}>
                <Text style={[styles.dayHeaderLabel, { color: theme.textMuted }]}>
                  {shortDayLabel(dateKey)}
                </Text>
                <Text style={[styles.dayHeaderNumber, { color: theme.textSecondary }]}>
                  {dayNumber(dateKey)}
                </Text>
              </View>
            ))}
          </View>

          {weeks.map((week, index) => (
            <DriverRow
              isLast={index === weeks.length - 1}
              key={week.driver.id}
              onOpenCell={(dateKey) => setAssigning({ dateKey, driverId: week.driver.id })}
              week={week}
            />
          ))}
        </Card>

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
        <Sheet
          onClose={() => setAssigning(null)}
          title={assigningDriver ? `Assign to ${driverFullName(assigningDriver)}` : "Assign a load"}
          visible
        >
          <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {openLoads.length === 0 ? (
              <Text style={[styles.emptyNote, { color: theme.textSecondary }]}>
                There are no unassigned loads to place.
              </Text>
            ) : (
              openLoads.map((load, index) => (
                <UnassignedRow
                  busy={busy}
                  isLast={index === openLoads.length - 1}
                  key={load.id}
                  load={load}
                  onPress={() => void assign(load.id)}
                />
              ))
            )}
          </ScrollView>
        </Sheet>
      ) : null}
    </View>
  );
}

function DriverRow({
  isLast,
  onOpenCell,
  week,
}: {
  readonly isLast: boolean;
  readonly onOpenCell: (dateKey: string) => void;
  readonly week: DriverWeek;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.driverRow, !isLast && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}
    >
      <View style={styles.driverColumn}>
        <DriverAvatar driver={week.driver} ring={false} size={28} />
        <Text numberOfLines={1} style={[styles.driverName, { color: theme.text }]}>
          {week.driver.firstName}
        </Text>
      </View>
      {week.cells.map((cell) => (
        <Cell
          cell={cell}
          driverName={driverFullName(week.driver)}
          key={cell.dateKey}
          onPress={() => onOpenCell(cell.dateKey)}
        />
      ))}
    </View>
  );
}

function Cell({
  cell,
  driverName,
  onPress,
}: {
  readonly cell: ScheduleCell;
  readonly driverName: string;
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  const { conflicted, loads, summary } = cell;

  const background = conflicted
    ? theme.dangerMuted
    : loads.length > 0
      ? theme.tint.primary.medium
      : summary.coverage === "off"
        ? theme.surfaceElevated
        : summary.coverage === "partial"
          ? theme.warningMuted
          : "transparent";

  const label = conflicted
    ? "carrying a load through blocked time"
    : loads.length > 0
      ? `${loads.length} load${loads.length === 1 ? "" : "s"}`
      : summary.coverage === "off"
        ? "unavailable"
        : summary.coverage === "partial" ? "partly blocked" : "open";

  return (
    <AnimatedPressable
      accessibilityLabel={`${driverName}, ${cell.dateKey}, ${label}`}
      haptic="selection"
      onPress={onPress}
      style={[styles.cell, { backgroundColor: background }]}
    >
      {conflicted ? (
        <Feather color={theme.danger} name="alert-triangle" size={12} />
      ) : loads.length > 0 ? (
        <Text style={[styles.cellCount, { color: theme.text }]}>{loads.length}</Text>
      ) : summary.coverage === "off" ? (
        <View style={[styles.offBar, { backgroundColor: theme.textMuted }]} />
      ) : null}
    </AnimatedPressable>
  );
}

function UnassignedRow({
  busy,
  isLast,
  load,
  onPress,
}: {
  readonly busy: boolean;
  readonly isLast: boolean;
  readonly load: Shipment;
  readonly onPress: () => void;
}) {
  const startsAt = scheduledStart(load);
  return (
    <ListRow
      disabled={busy}
      isLast={isLast}
      onPress={onPress}
      subtitle={`${startsAt ? formatTime(startsAt) : "Unscheduled"} · ${load.distanceMiles.toLocaleString()} mi`}
      title={load.loadNumber}
      trailing={<StatusBadge size="sm" status={load.status} />}
    />
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: "center",
    borderRadius: RADIUS_DENSE.md,
    flex: 1,
    height: 34,
    justifyContent: "center",
    marginHorizontal: 1,
  },
  cellCount: { ...TYPO.subtitle, fontSize: 11 },
  conflictBanner: {
    alignItems: "flex-start",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.xs,
    padding: SPACE.sm,
  },
  conflictText: { ...TYPO.caption, flex: 1 },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  dayHeader: { alignItems: "center", flex: 1, marginHorizontal: 1 },
  dayHeaderLabel: { ...TYPO.subtitle, fontSize: 10 },
  dayHeaderNumber: { ...TYPO.subtitle, fontSize: 11 },
  dayHeaderRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    paddingTop: SPACE.sm,
  },
  driverColumn: { alignItems: "center", gap: 2, width: 60 },
  driverName: { ...TYPO.subtitle, fontSize: 10 },
  driverRow: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
  },
  emptyNote: { ...TYPO.body },
  fill: { flex: 1 },
  offBar: { borderRadius: 1, height: 2, width: 14 },
  sheetBody: { paddingBottom: SPACE.md },
  todayLink: { ...TYPO.subtitle },
  weekHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  weekLabel: { ...TYPO.cardTitle },
  weekLabelWrap: { alignItems: "center", gap: 2 },
});
