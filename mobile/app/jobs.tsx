import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";

import { EmptyState, Header, Screen, SegmentedControl } from "@/components/ui";
import type { Shipment } from "@/domain/types";
import { AssignDriverSheet } from "@/route-support/jobs/_components/AssignDriverSheet";
import { DemoLoadCard } from "@/route-support/jobs/_components/DemoLoadCard";
import { JobCard } from "@/route-support/jobs/_components/JobCard";
import { styles } from "@/route-support/jobs/styles";
import {
  JOB_LANE_EMPTY_SUFFIX,
  JOB_LANE_SEGMENT_LABELS,
  JOB_LANES,
  assignableDrivers,
  buildJobEntries,
  driversBlockedFor,
  entriesInLane,
  laneCounts,
  type JobLane,
} from "@/route-support/jobs/utils";
import { scheduledEnd, scheduledStart } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { useTheme } from "@/theme";

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

  // No counts in the segment titles: iOS segmented controls carry a bare word,
  // and appending "(1)" pushed every label into an ellipsis. The operative
  // counts are already in the header subtitle.
  const laneOptions = useMemo(
    () => JOB_LANES.map((option) => ({
      label: JOB_LANE_SEGMENT_LABELS[option],
      value: option,
    })),
    [],
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
        {isDemo ? <DemoLoadCard busy={busy} onAdd={() => void addDemoLoad()} /> : null}
        <SegmentedControl
          accessibilityLabel="Dispatch lane"
          onChange={setLane}
          options={laneOptions}
          value={lane}
        />

        {visible.length === 0 ? (
          <EmptyState
            icon={<Feather color={theme.textMuted} name="check-circle" size={36} />}
            message={`No loads ${JOB_LANE_EMPTY_SUFFIX[lane]}.`}
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
        <AssignDriverSheet
          blockedDriverIds={blockedDriverIds}
          busy={busy}
          candidates={candidates}
          onAssign={(driverId) => void assign(driverId)}
          onClose={() => setAssigningTo(null)}
          shipment={assigningTo}
          shipments={shipments}
        />
      ) : null}
    </View>
  );
}
