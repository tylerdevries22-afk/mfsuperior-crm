import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
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
  statusLabel,
  StatusBadge,
} from "@/components/ui";
import type { Shipment } from "@/domain/types";
import { findAvailabilityConflicts } from "@/route-support/availability/utils";
import {
  JOB_LANE_LABELS,
  JOB_LANES,
  assignableDrivers,
  buildJobEntries,
  driversBlockedFor,
  entriesInLane,
  laneCounts,
  type JobEntry,
  type JobLane,
} from "@/route-support/jobs/utils";
import { driverFullName, formatTime, scheduledEnd, scheduledStart } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

export default function JobsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const {
    actions,
    availabilityBlocks,
    availabilityRules,
    effectiveRole,
    isDemo,
    shipments,
    state,
  } = useOperations();

  const [lane, setLane] = useState<JobLane>("unassigned");
  const [assigningTo, setAssigningTo] = useState<Shipment | null>(null);
  const [busy, setBusy] = useState(false);

  const openExceptionIds = useMemo(
    () => new Set(
      state.exceptions
        .filter((exception) => exception.status !== "resolved")
        .map((exception) => exception.shipmentId),
    ),
    [state.exceptions],
  );

  const entries = useMemo(
    () => buildJobEntries(shipments, state.drivers, openExceptionIds),
    [openExceptionIds, shipments, state.drivers],
  );
  const counts = useMemo(() => laneCounts(entries), [entries]);
  const visible = useMemo(() => entriesInLane(entries, lane), [entries, lane]);

  const laneOptions = useMemo(
    () => JOB_LANES.map((option) => ({
      label: `${JOB_LANE_LABELS[option]}${counts[option] > 0 ? ` (${counts[option]})` : ""}`,
      value: option,
    })),
    [counts],
  );

  const blockedDriverIds = useMemo(
    () => assigningTo
      ? driversBlockedFor(
          state.drivers,
          availabilityBlocks,
          availabilityRules,
          scheduledStart(assigningTo),
          scheduledEnd(assigningTo) ?? scheduledStart(assigningTo),
        )
      : new Set<string>(),
    [assigningTo, availabilityBlocks, availabilityRules, state.drivers],
  );

  const candidates = useMemo(
    () => assignableDrivers(state.drivers, blockedDriverIds),
    [blockedDriverIds, state.drivers],
  );

  const assign = useCallback(async (driverId: string) => {
    if (!assigningTo) {
      return;
    }
    setBusy(true);
    const assigned = await actions.assignShipment(assigningTo.id, driverId);
    setBusy(false);
    if (assigned) {
      setAssigningTo(null);
    }
  }, [actions, assigningTo]);

  const respond = useCallback(async (shipmentId: string, response: "accepted" | "declined") => {
    setBusy(true);
    await actions.respondToTender(shipmentId, response);
    setBusy(false);
  }, [actions]);

  const addDemoLoad = useCallback(async () => {
    if (!isDemo) {
      return;
    }
    setBusy(true);
    const added = await actions.addDemoUnassignedLoad();
    setBusy(false);
    if (added) {
      setLane("unassigned");
    }
  }, [actions, isDemo]);

  if (effectiveRole !== "admin") {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Jobs" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="clipboard" size={36} />}
            message="The dispatch board is an admin console. Switch to an admin account to open it."
            title="Admin role required"
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
        subtitle={`${counts.unassigned} need a driver · ${counts.active} moving`}
        title="Jobs"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        {isDemo ? (
          <Card variant="tinted">
            <View style={styles.demoLoadCopy}>
              <Text style={[styles.demoLoadTitle, { color: theme.text }]}>Demo load generator</Text>
              <Text style={[styles.demoLoadDescription, { color: theme.textSecondary }]}>Add a realistic accepted load to the unassigned lane without contacting a carrier or partner.</Text>
            </View>
            <AnimatedButton
              accessibilityLabel="Add demo unassigned load"
              fullWidth
              icon={<Feather color={theme.primaryForeground} name="plus" size={16} />}
              loading={busy}
              onPress={() => void addDemoLoad()}
              title="Add unassigned load"
            />
          </Card>
        ) : null}
        <SegmentedControl
          accessibilityLabel="Dispatch lane"
          onChange={setLane}
          options={laneOptions}
          value={lane}
        />

        {visible.length === 0 ? (
          <EmptyState
            icon={<Feather color={theme.textMuted} name="check-circle" size={36} />}
            message={`Nothing in ${JOB_LANE_LABELS[lane].toLowerCase()}.`}
            title="All clear"
          />
        ) : (
          visible.map((entry) => (
            <JobCard
              busy={busy}
              entry={entry}
              key={entry.shipment.id}
              onAssign={() => setAssigningTo(entry.shipment)}
              onOpen={() => router.push({
                params: { id: entry.shipment.id },
                pathname: "/load/[id]",
              })}
              onRespond={(response) => void respond(entry.shipment.id, response)}
            />
          ))
        )}
      </Screen>

      {assigningTo ? (
        <Sheet
          onClose={() => setAssigningTo(null)}
          title={`Assign ${assigningTo.loadNumber}`}
          visible
        >
          <View style={styles.sheetBody}>
            {candidates.map((driver, index) => {
              const blocked = blockedDriverIds.has(driver.id);
              const conflicts = findAvailabilityConflicts(
                shipments,
                driver.id,
                scheduledStart(assigningTo) ?? "",
                scheduledEnd(assigningTo) ?? "",
              );
              return (
                <ListRow
                  disabled={busy}
                  isLast={index === candidates.length - 1}
                  key={driver.id}
                  leading={<DriverAvatar driver={driver} ring={false} size={36} />}
                  onPress={() => void assign(driver.id)}
                  rich={blocked || conflicts.length > 0}
                  subtitle={blocked
                    ? "Marked unavailable for this window"
                    : conflicts.length > 0
                      ? `Already on ${conflicts.map((load) => load.loadNumber).join(", ")}`
                      : statusLabel(driver.status)}
                  title={driverFullName(driver)}
                  trailing={
                    blocked || conflicts.length > 0
                      ? <Feather color={theme.warning} name="alert-triangle" size={ICON.md} />
                      : <Feather color={theme.textMuted} name="chevron-right" size={ICON.md} />
                  }
                />
              );
            })}
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}

function JobCard({
  busy,
  entry,
  onAssign,
  onOpen,
  onRespond,
}: {
  readonly busy: boolean;
  readonly entry: JobEntry;
  readonly onAssign: () => void;
  readonly onOpen: () => void;
  readonly onRespond: (response: "accepted" | "declined") => void;
}) {
  const theme = useTheme();
  const { destination, driver, hasOpenException, origin, shipment, startsAt } = entry;

  return (
    <Card onPress={onOpen}>
      <View style={styles.jobHead}>
        <View style={styles.grow}>
          <Text style={[styles.loadNumber, { color: theme.text }]}>{shipment.loadNumber}</Text>
          <Text style={[styles.route, { color: theme.textSecondary }]}>
            {origin} → {destination}
          </Text>
        </View>
        <StatusBadge size="sm" status={shipment.status} />
      </View>

      <View style={styles.metaRow}>
        <Meta icon="calendar" label={startsAt ? formatTime(startsAt) : "Unscheduled"} />
        <Meta icon="navigation" label={`${shipment.distanceMiles.toLocaleString()} mi`} />
        <Meta icon="package" label={shipment.commodity} />
      </View>

      {hasOpenException ? (
        <View
          accessibilityRole="alert"
          style={[
            styles.exception,
            { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium },
          ]}
        >
          <Feather color={theme.danger} name="alert-octagon" size={ICON.sm} />
          <Text style={[styles.exceptionText, { color: theme.text }]}>
            An open exception is holding this load.
          </Text>
        </View>
      ) : null}

      <View style={[styles.jobFooter, { borderTopColor: theme.border }]}>
        {driver ? (
          <View style={styles.driverRow}>
            <DriverAvatar driver={driver} ring={false} size={24} />
            <Text style={[styles.driverName, { color: theme.textSecondary }]}>
              {driverFullName(driver)}
            </Text>
          </View>
        ) : (
          <Badge label="No driver" size="sm" tone="warning" />
        )}

        {entry.lane === "tendered" ? (
          <View style={styles.actions}>
            <AnimatedButton
              accessibilityLabel={`Decline ${shipment.loadNumber}`}
              disabled={busy}
              onPress={() => onRespond("declined")}
              size="sm"
              title="Decline"
              variant="ghost"
            />
            <AnimatedButton
              accessibilityLabel={`Accept ${shipment.loadNumber}`}
              disabled={busy}
              onPress={() => onRespond("accepted")}
              size="sm"
              title="Accept"
            />
          </View>
        ) : entry.lane === "closed" ? null : (
          <AnimatedButton
            accessibilityLabel={driver ? `Reassign ${shipment.loadNumber}` : `Assign ${shipment.loadNumber}`}
            disabled={busy}
            onPress={onAssign}
            size="sm"
            title={driver ? "Reassign" : "Assign"}
            variant={driver ? "ghost" : "primary"}
          />
        )}
      </View>
    </Card>
  );
}

function Meta({
  icon,
  label,
}: {
  readonly icon: keyof typeof Feather.glyphMap;
  readonly label: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.meta}>
      <Feather color={theme.textMuted} name={icon} size={ICON.xs} />
      <Text numberOfLines={1} style={[styles.metaLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: SPACE.xs },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  demoLoadCopy: { gap: SPACE.xs, marginBottom: SPACE.md },
  demoLoadDescription: { ...TYPO.caption },
  demoLoadTitle: { ...TYPO.cardTitle },
  driverName: { ...TYPO.caption },
  driverRow: { alignItems: "center", flexDirection: "row", gap: SPACE.xs },
  exception: {
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.xs,
    padding: SPACE.sm,
  },
  exceptionText: { ...TYPO.caption, flex: 1 },
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  jobFooter: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    justifyContent: "space-between",
    paddingTop: SPACE.sm,
  },
  jobHead: { alignItems: "flex-start", flexDirection: "row", gap: SPACE.sm },
  loadNumber: { ...TYPO.cardTitle },
  meta: { alignItems: "center", flexDirection: "row", gap: 3, maxWidth: "33%" },
  metaLabel: { ...TYPO.subtitle },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  route: { ...TYPO.caption, marginTop: 2 },
  sheetBody: { paddingBottom: SPACE.md },
});
