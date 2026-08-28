import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DriverAvatar } from "@/components/operations";
import {
  AnimatedButton,
  Button,
  Header,
  SegmentedControl,
  Sheet,
  TextField,
} from "@/components/ui";
import type {
  AvailabilityBlockInput,
  AvailabilityRuleInput,
  Driver,
  DriverShift,
  DriverShiftInput,
  ShiftCoverageRequest,
} from "@/domain/types";
import { eligibleCoverageDrivers, driverShiftConflict } from "@/domain/scheduling";
import { DayEditorSheet } from "@/route-support/availability/_components/DayEditorSheet";
import { TimeRangeTrack } from "@/route-support/availability/_components/TimeRangeTrack";
import {
  blocksForDay,
  findAvailabilityConflicts,
  formatMinuteRange,
  isoToMinutes,
  loadTouchesDay,
  localDayStart,
  minutesToIso,
} from "@/route-support/availability/utils";
import {
  driverFullName,
  formatDateKey,
  formatTime,
  getDuration,
  scheduledStart,
} from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { FONTS, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

const DAY_WIDTH = 128;
const DRIVER_LABEL_WIDTH = 122;
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 16 * 60;

type CalendarMode = "admin" | "driver";

interface UnifiedScheduleScreenProps {
  readonly mode?: CalendarMode;
}

interface CellContent {
  readonly blocks: ReturnType<typeof blocksForDay>;
  readonly loads: ReturnType<typeof useOperations>["shipments"];
  readonly shifts: readonly DriverShift[];
}

export function UnifiedScheduleScreen({ mode }: UnifiedScheduleScreenProps) {
  const router = useRouter();
  const theme = useTheme();
  const operations = useOperations();
  const {
    actions,
    availabilityBlocks,
    availabilityRules,
    currentDriver,
    driverShifts,
    effectiveRole,
    isHydrated,
    scheduleSyncStatuses,
    shipments,
    shiftCoverageRequests,
    state,
  } = operations;
  const drivers = state.drivers;
  const isAdmin = mode === "admin" || effectiveRole === "admin";
  const currentMode: CalendarMode = isAdmin ? "admin" : "driver";
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey(new Date()));
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [blockDriverId, setBlockDriverId] = useState<string | null>(null);
  const [shiftEditor, setShiftEditor] = useState<{
    readonly dateKey: string;
    readonly shift?: DriverShift;
    readonly driverId?: string;
  } | null>(null);
  const [detailShift, setDetailShift] = useState<DriverShift | null>(null);
  const [coverageShift, setCoverageShift] = useState<DriverShift | null>(null);
  const [blockDateKey, setBlockDateKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekAnchor, index)),
    [weekAnchor],
  );
  const visibleDrivers = useMemo(() => {
    if (currentMode === "driver") return currentDriver ? [currentDriver] : [];
    if (!selectedDriverId) return drivers;
    return drivers.filter((driver) => driver.id === selectedDriverId);
  }, [currentDriver, currentMode, drivers, selectedDriverId]);
  const boardDrivers = currentMode === "driver" && currentDriver ? [currentDriver] : visibleDrivers;
  const selectedBlockDriver = currentMode === "driver"
    ? currentDriver
    : drivers.find((driver) => driver.id === (blockDriverId ?? selectedDriverId)) ?? drivers[0];
  const pendingSyncCount = scheduleSyncStatuses.filter((sync) => sync.status === "pending").length;
  const conflictCount = driverShifts.filter((shift) => driverShiftConflict(state, shift) !== null).length;
  const gapCount = shipments.filter((shipment) => (
    shipment.status !== "delivered" &&
    shipment.status !== "cancelled" &&
    (!shipment.assignedDriverId || !driverShifts.some((shift) => (
      shift.driverId === shipment.assignedDriverId &&
      scheduledStart(shipment) !== null &&
      loadTouchesDay(shipment, formatDateKey(new Date(shift.startsAt)))
    )))
  )).length;

  useEffect(() => {
    if (!isAdmin && currentDriver && !selectedDriverId) setSelectedDriverId(currentDriver.id);
  }, [currentDriver, isAdmin, selectedDriverId]);

  const runAction = async (action: () => Promise<boolean>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const changeWeek = (delta: number) => {
    const next = addDays(weekAnchor, delta * 7);
    setWeekAnchor(next);
    setSelectedDateKey(formatDateKey(next));
  };

  const cellContent = (driverId: string, dateKey: string): CellContent => ({
    blocks: blocksForDay(
      availabilityBlocks.filter((block) => block.driverId === driverId),
      availabilityRules.filter((rule) => rule.driverId === driverId),
      dateKey,
    ),
    loads: shipments.filter((shipment) => (
      shipment.assignedDriverId === driverId && loadTouchesDay(shipment, dateKey)
    )),
    shifts: driverShifts.filter((shift) => shift.driverId === driverId && shiftTouchesDay(shift, dateKey)),
  });

  const openCell = (driver: Driver, dateKey: string) => {
    if (currentMode === "admin") {
      setShiftEditor({ dateKey, driverId: driver.id });
      return;
    }
    setBlockDriverId(driver.id);
    setBlockDateKey(dateKey);
  };

  const handleBlockSave = async (input: AvailabilityBlockInput) => {
    await runAction(() => actions.setAvailabilityBlock({ ...input, driverId: selectedBlockDriver?.id }));
    setBlockDateKey(null);
  };

  const handleRuleSave = async (input: AvailabilityRuleInput) => {
    await runAction(() => actions.setAvailabilityRule({ ...input, driverId: selectedBlockDriver?.id }));
    setBlockDateKey(null);
  };

  const handleDeleteBlock = async (blockId: string) => {
    await runAction(() => actions.removeAvailabilityBlock(blockId));
  };

  const openLoad = (shipmentId: string) => router.push({ pathname: "/load/[id]", params: { id: shipmentId } });

  if (!isHydrated) {
    return <View style={[styles.container, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.primary} size="large" /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header
        rightAction={(
          <Pressable
            accessibilityLabel={currentMode === "admin" ? "Add driver shift" : "Add blocked time"}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => currentMode === "admin"
              ? setShiftEditor({ dateKey: selectedDateKey, driverId: selectedDriverId ?? drivers[0]?.id })
              : setBlockDateKey(selectedDateKey)}
            style={styles.headerAction}
          >
            <Feather color={theme.primary} name="plus" size={21} />
          </Pressable>
        )}
        subtitle={currentMode === "admin" ? "Dispatch board · changes are live" : "Your shifts, loads, and blocked time"}
        title="Schedule"
      />

      <View style={styles.weekControls}>
        <Pressable accessibilityLabel="Previous week" accessibilityRole="button" onPress={() => changeWeek(-1)} style={styles.arrowButton}>
          <Feather color={theme.text} name="chevron-left" size={19} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setWeekAnchor(startOfWeek(new Date())); setSelectedDateKey(formatDateKey(new Date())); }} style={styles.weekLabelButton}>
          <Text style={[styles.weekLabel, { color: theme.text }]}>{weekRangeLabel(weekDates)}</Text>
          <Text style={[styles.weekHint, { color: theme.primaryLight }]}>Today</Text>
        </Pressable>
        <Pressable accessibilityLabel="Next week" accessibilityRole="button" onPress={() => changeWeek(1)} style={styles.arrowButton}>
          <Feather color={theme.text} name="chevron-right" size={19} />
        </Pressable>
      </View>

      {currentMode === "admin" ? (
        <ScrollView contentContainerStyle={styles.driverFilterContent} horizontal showsHorizontalScrollIndicator={false}>
          <Pressable accessibilityRole="button" onPress={() => setSelectedDriverId(null)} style={[styles.driverFilter, !selectedDriverId && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
            <Text style={[styles.driverFilterText, { color: !selectedDriverId ? theme.primaryForeground : theme.textSecondary }]}>All drivers</Text>
          </Pressable>
          {drivers.map((driver) => {
            const selected = selectedDriverId === driver.id;
            return (
              <Pressable accessibilityLabel={`Filter ${driverFullName(driver)}`} accessibilityRole="button" key={driver.id} onPress={() => setSelectedDriverId(selected ? null : driver.id)} style={[styles.driverFilter, { borderColor: theme.border }, selected && { backgroundColor: theme.tint.primary.medium, borderColor: theme.primaryLight }]}>
                <DriverAvatar driver={driver} ring={false} size={18} />
                <Text style={[styles.driverFilterText, { color: selected ? theme.text : theme.textSecondary }]}>{driver.firstName}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.metricsRow}>
        <Metric label="Gaps" value={String(gapCount)} tone={gapCount > 0 ? theme.warning : theme.primary} />
        <Metric label="Conflicts" value={String(conflictCount)} tone={conflictCount > 0 ? theme.danger : theme.primary} />
        <Metric label="Target sync" value={String(pendingSyncCount)} tone={pendingSyncCount > 0 ? theme.warning : theme.primary} />
      </View>

      <ScrollView contentContainerStyle={styles.boardScroll} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[styles.board, { borderColor: theme.border }]}>
            <View style={styles.boardHeader}>
              <View style={[styles.driverLabel, { borderRightColor: theme.border }]}><Text style={[styles.boardEyebrow, { color: theme.textMuted }]}>DRIVER</Text></View>
              {weekDates.map((date) => <DayHeader date={date} key={formatDateKey(date)} selected={formatDateKey(date) === selectedDateKey} theme={theme} onPress={() => setSelectedDateKey(formatDateKey(date))} />)}
            </View>
            {boardDrivers.length === 0 ? (
              <View style={styles.emptyBoard}><Feather color={theme.textMuted} name="users" size={28} /><Text style={[styles.emptyTitle, { color: theme.text }]}>No driver schedule yet</Text><Text style={[styles.emptyCopy, { color: theme.textSecondary }]}>Add a driver shift or sign in as a driver to see the unified calendar.</Text></View>
            ) : boardDrivers.map((driver) => (
              <DriverRow
                contentForCell={cellContent}
                dateKeys={weekDates.map(formatDateKey)}
                driver={driver}
                key={driver.id}
                onBlockPress={(dateKey) => { setBlockDriverId(driver.id); setBlockDateKey(dateKey); }}
                onCellPress={(dateKey) => openCell(driver, dateKey)}
                onLoadPress={openLoad}
                onShiftPress={setDetailShift}
                theme={theme}
              />
            ))}
          </View>
        </ScrollView>

        <View style={styles.legendRow}>
          <LegendDot color={theme.primary} label="Shift" theme={theme} />
          <LegendDot color="#7DD3FC" label="Load" theme={theme} />
          <LegendDot color={theme.danger} label="Blocked" theme={theme} />
          <Text style={[styles.legendHint, { color: theme.textMuted }]}>Tap an empty cell to add</Text>
        </View>

        <CoverageInbox
          currentDriver={currentDriver}
          drivers={drivers}
          isAdmin={currentMode === "admin"}
          onRespond={(requestId, response) => runAction(() => actions.respondToShiftCoverage(requestId, response))}
          requests={shiftCoverageRequests}
          shifts={driverShifts}
          theme={theme}
        />
        <View style={styles.bottomSpace} />
      </ScrollView>

      <ShiftEditorSheet
        busy={busy}
        dateKey={shiftEditor?.dateKey ?? null}
        driverId={shiftEditor?.driverId}
        drivers={drivers}
        onClose={() => setShiftEditor(null)}
        onDelete={shiftEditor?.shift ? async () => {
          await runAction(() => actions.removeDriverShift(shiftEditor.shift?.id ?? ""));
          setShiftEditor(null);
        } : undefined}
        onSave={async (input) => {
          await runAction(() => actions.setDriverShift(input));
          setShiftEditor(null);
        }}
        shift={shiftEditor?.shift}
      />

      <ShiftDetailSheet
        isAdmin={currentMode === "admin"}
        now={Date.parse(state.updatedAt)}
        onClose={() => setDetailShift(null)}
        onDelete={async (shiftId) => {
          await runAction(() => actions.removeDriverShift(shiftId));
          setDetailShift(null);
        }}
        onEdit={(shift) => { setDetailShift(null); setShiftEditor({ dateKey: formatDateKey(new Date(shift.startsAt)), shift, driverId: shift.driverId }); }}
        onFindCoverage={(shift) => { setDetailShift(null); setCoverageShift(shift); }}
        onRetrySync={(shiftId) => runAction(() => actions.retryScheduleSync(shiftId))}
        shift={detailShift}
        sync={detailShift ? scheduleSyncStatuses.find((status) => status.entityId === detailShift.id) : undefined}
        theme={theme}
      />

      <CoverageSheet
        busy={busy}
        onClose={() => setCoverageShift(null)}
        onSend={async (shiftId, targetDriverId) => {
          await runAction(() => actions.requestShiftCoverage({ shiftId, targetDriverId }));
          setCoverageShift(null);
        }}
        shift={coverageShift}
        state={state}
        theme={theme}
      />

      <DayEditorSheet
        blocks={blockDateKey && selectedBlockDriver ? blocksForDay(
          availabilityBlocks.filter((block) => block.driverId === selectedBlockDriver.id),
          availabilityRules.filter((rule) => rule.driverId === selectedBlockDriver.id),
          blockDateKey,
        ) : []}
        busy={busy}
        conflicts={blockDateKey && selectedBlockDriver ? findAvailabilityConflicts(
          shipments,
          selectedBlockDriver.id,
          minutesToIso(blockDateKey, 0),
          minutesToIso(blockDateKey, 1_440),
        ) : []}
        dateKey={blockDateKey}
        onClose={() => { setBlockDateKey(null); setBlockDriverId(null); }}
        onRemoveBlock={handleDeleteBlock}
        onSaveBlock={handleBlockSave}
        onSaveRule={handleRuleSave}
      />
    </View>
  );
}

function DriverRow({
  contentForCell,
  dateKeys,
  driver,
  onBlockPress,
  onCellPress,
  onLoadPress,
  onShiftPress,
  theme,
}: {
  readonly contentForCell: (driverId: string, dateKey: string) => CellContent;
  readonly dateKeys: readonly string[];
  readonly driver: Driver;
  readonly onBlockPress: (dateKey: string) => void;
  readonly onCellPress: (dateKey: string) => void;
  readonly onLoadPress: (shipmentId: string) => void;
  readonly onShiftPress: (shift: DriverShift) => void;
  readonly theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.driverRow, { borderTopColor: theme.border }]}>
      <View style={[styles.driverLabel, styles.driverLabelBody, { borderRightColor: theme.border }]}>
        <DriverAvatar driver={driver} ring={false} size={28} />
        <View style={styles.driverLabelCopy}><Text numberOfLines={1} style={[styles.driverName, { color: theme.text }]}>{driver.firstName} {driver.lastName[0]}.</Text><Text style={[styles.driverStatus, { color: driver.status === "suspended" ? theme.danger : theme.textMuted }]}>{driver.status.replace("_", " ")}</Text></View>
      </View>
      {dateKeys.map((dateKey) => {
        const content = contentForCell(driver.id, dateKey);
        const hasEvents = content.shifts.length > 0 || content.loads.length > 0 || content.blocks.length > 0;
        return (
          <Pressable
            accessibilityLabel={`${driverFullName(driver)} ${dateKey}${hasEvents ? " schedule" : " empty schedule slot"}`}
            accessibilityRole="button"
            disabled={hasEvents}
            key={`${driver.id}-${dateKey}`}
            delayLongPress={220}
            onLongPress={() => onCellPress(dateKey)}
            onPress={() => onCellPress(dateKey)}
            style={[styles.dayCell, { borderRightColor: theme.border }, !hasEvents && styles.emptyCell]}
          >
            {content.shifts.map((shift) => <EventChip key={shift.id} label={`${formatTime(shift.startsAt)} shift`} onPress={() => onShiftPress(shift)} tone="shift" theme={theme} />)}
            {content.loads.slice(0, 2).map((load) => <EventChip key={load.id} label={`${load.loadNumber} load`} onPress={() => onLoadPress(load.id)} tone="load" theme={theme} />)}
            {content.blocks.filter((block) => block.kind === "unavailable" || block.kind === "time_off").slice(0, 2).map((block) => <EventChip key={block.id} label={`${formatMinuteRange(isoToMinutes(block.startsAt, dateKey), isoToMinutes(block.endsAt, dateKey))} blocked`} onPress={() => onBlockPress(dateKey)} tone="blocked" theme={theme} />)}
            {content.loads.length > 2 ? <Text style={[styles.moreEvents, { color: theme.textMuted }]}>+{content.loads.length - 2} more loads</Text> : null}
            {!hasEvents ? <Feather color={theme.borderLight} name="plus" size={16} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function EventChip({ label, onPress, tone, theme }: { readonly label: string; readonly onPress: () => void; readonly tone: "shift" | "load" | "blocked"; readonly theme: ReturnType<typeof useTheme> }) {
  const toneColor = tone === "shift" ? theme.primary : tone === "load" ? "#7DD3FC" : theme.danger;
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={[styles.eventChip, { backgroundColor: `${toneColor}22`, borderColor: `${toneColor}70` }]}><View style={[styles.eventDot, { backgroundColor: toneColor }]} /><Text numberOfLines={1} style={[styles.eventText, { color: theme.text }]}>{label}</Text></Pressable>;
}

function DayHeader({ date, onPress, selected, theme }: { readonly date: Date; readonly onPress: () => void; readonly selected: boolean; readonly theme: ReturnType<typeof useTheme> }) {
  const key = formatDateKey(date);
  return <Pressable accessibilityLabel={key} accessibilityRole="button" onPress={onPress} style={[styles.dayHeader, { borderRightColor: theme.border }, selected && { backgroundColor: theme.tint.primary.medium }]}><Text style={[styles.dayHeaderLabel, { color: selected ? theme.primaryLight : theme.textMuted }]}>{date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</Text><Text style={[styles.dayHeaderNumber, { color: selected ? theme.text : theme.textSecondary }]}>{date.getDate()}</Text></Pressable>;
}

function Metric({ label, tone, value }: { readonly label: string; readonly tone: string; readonly value: string }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: tone }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function LegendDot({ color, label, theme }: { readonly color: string; readonly label: string; readonly theme: ReturnType<typeof useTheme> }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>{label}</Text></View>;
}

function CoverageInbox({
  currentDriver,
  drivers,
  isAdmin,
  onRespond,
  requests,
  shifts,
  theme,
}: {
  readonly currentDriver: Driver | null;
  readonly drivers: readonly Driver[];
  readonly isAdmin: boolean;
  readonly onRespond: (requestId: string, response: "accepted" | "declined") => void;
  readonly requests: readonly ShiftCoverageRequest[];
  readonly shifts: readonly DriverShift[];
  readonly theme: ReturnType<typeof useTheme>;
}) {
  const visible = requests.filter((request) => request.status === "pending" && (isAdmin || request.targetDriverId === currentDriver?.id || request.fromDriverId === currentDriver?.id));
  if (visible.length === 0) return null;
  return <View style={[styles.inbox, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={styles.sectionHeading}><View><Text style={[styles.sectionEyebrow, { color: theme.primaryLight }]}>{isAdmin ? "COVERAGE QUEUE" : "ACTION NEEDED"}</Text><Text style={[styles.sectionTitle, { color: theme.text }]}>{isAdmin ? "Waiting for driver approval" : "Shift coverage requests"}</Text></View><Feather color={theme.primaryLight} name="repeat" size={18} /></View>{visible.map((request) => { const shift = shifts.find((candidate) => candidate.id === request.shiftId); const from = drivers.find((driver) => driver.id === request.fromDriverId); const target = drivers.find((driver) => driver.id === request.targetDriverId); if (!shift) return null; return <View key={request.id} style={[styles.requestRow, { borderTopColor: theme.border }]}><View style={styles.requestCopy}><Text style={[styles.requestTitle, { color: theme.text }]}>{from?.firstName ?? "Driver"} → {target?.firstName ?? "Driver"}</Text><Text style={[styles.requestMeta, { color: theme.textSecondary }]}>{formatDateKey(new Date(shift.startsAt))} · {formatTime(shift.startsAt)}–{formatTime(shift.endsAt)}</Text><Text style={[styles.requestMeta, { color: theme.textMuted }]}>Only this shift moves · linked loads stay assigned</Text></View>{!isAdmin && request.targetDriverId === currentDriver?.id ? <View style={styles.requestActions}><Button onPress={() => onRespond(request.id, "declined")} size="sm" title="Decline" variant="ghost" /><Button onPress={() => onRespond(request.id, "accepted")} size="sm" title="Accept" /></View> : null}</View>; })}</View>;
}

function ShiftEditorSheet({
  busy,
  dateKey,
  driverId,
  drivers,
  onClose,
  onDelete,
  onSave,
  shift,
}: {
  readonly busy: boolean;
  readonly dateKey: string | null;
  readonly driverId?: string;
  readonly drivers: readonly Driver[];
  readonly onClose: () => void;
  readonly onDelete?: () => void;
  readonly onSave: (input: DriverShiftInput) => void;
  readonly shift?: DriverShift;
}) {
  const theme = useTheme();
  const [selectedDriverId, setSelectedDriverId] = useState(driverId ?? drivers[0]?.id ?? "");
  const [startMinute, setStartMinute] = useState(DEFAULT_START);
  const [endMinute, setEndMinute] = useState(DEFAULT_END);
  const [status, setStatus] = useState<DriverShift["status"]>("scheduled");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!dateKey) return;
    setSelectedDriverId(shift?.driverId ?? driverId ?? drivers[0]?.id ?? "");
    setStartMinute(shift ? isoToMinutes(shift.startsAt, dateKey) : DEFAULT_START);
    setEndMinute(shift ? isoToMinutes(shift.endsAt, dateKey) : DEFAULT_END);
    setStatus(shift?.status ?? "scheduled");
    setNote(shift?.note ?? "");
  }, [dateKey, driverId, drivers, shift]);

  if (!dateKey) return null;
  const heading = shift ? "Edit driver shift" : "Schedule driver shift";
  return <Sheet footer={<><AnimatedButton accessibilityLabel={shift ? "Save shift changes" : "Schedule shift"} fullWidth loading={busy} onPress={() => onSave({ driverId: selectedDriverId, endsAt: minutesToIso(dateKey, endMinute), id: shift?.id, note, startsAt: minutesToIso(dateKey, startMinute), status })} title={shift ? "Save changes" : "Schedule shift"} />{onDelete ? <Button disabled={busy} fullWidth onPress={onDelete} title="Remove shift" variant="danger" /> : null}</>} onClose={onClose} title={heading} visible><ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}><Text style={[styles.sheetLabel, { color: theme.textMuted }]}>DRIVER</Text><ScrollView contentContainerStyle={styles.sheetDriverRow} horizontal showsHorizontalScrollIndicator={false}>{drivers.map((driver) => <Pressable accessibilityState={{ selected: selectedDriverId === driver.id }} accessibilityRole="radio" key={driver.id} onPress={() => setSelectedDriverId(driver.id)} style={[styles.sheetDriver, { borderColor: theme.border }, selectedDriverId === driver.id && { backgroundColor: theme.tint.primary.medium, borderColor: theme.primaryLight }]}><DriverAvatar driver={driver} ring={false} size={22} /><Text style={[styles.sheetDriverText, { color: theme.text }]}>{driver.firstName}</Text></Pressable>)}</ScrollView><Text style={[styles.sheetDate, { color: theme.text }]}>{formatSheetDate(dateKey)}</Text><Text style={[styles.sheetLabel, { color: theme.textMuted }]}>SHIFT WINDOW</Text><TimeRange valueEnd={endMinute} valueStart={startMinute} onChange={(start, end) => { setStartMinute(start); setEndMinute(end); }} /><Text style={[styles.sheetLabel, { color: theme.textMuted }]}>STATUS</Text><SegmentedControl accessibilityLabel="Shift status" onChange={setStatus} options={[{ label: "Scheduled", value: "scheduled" }, { label: "Confirmed", value: "confirmed" }, { label: "In progress", value: "in_progress" }]} value={status === "completed" || status === "cancelled" ? "scheduled" : status} /><TextField label="Notes" onChangeText={setNote} placeholder="Lane, call-out, or dispatch notes" value={note} /></ScrollView></Sheet>;
}

function TimeRange({ onChange, valueEnd, valueStart }: { readonly onChange: (start: number, end: number) => void; readonly valueEnd: number; readonly valueStart: number }) {
  // The shared availability track gives shifts the same 15-minute precision as blocked time.
  return <TimeRangeTrack accessibilityLabel="Shift time window" endMinute={valueEnd} onChange={onChange} startMinute={valueStart} />;
}

function ShiftDetailSheet({
  isAdmin,
  now,
  onClose,
  onDelete,
  onEdit,
  onFindCoverage,
  onRetrySync,
  shift,
  sync,
  theme,
}: {
  readonly isAdmin: boolean;
  readonly now: number;
  readonly onClose: () => void;
  readonly onDelete: (shiftId: string) => void;
  readonly onEdit: (shift: DriverShift) => void;
  readonly onFindCoverage: (shift: DriverShift) => void;
  readonly onRetrySync: (shiftId: string) => void;
  readonly shift: DriverShift | null;
  readonly sync?: ReturnType<typeof useOperations>["scheduleSyncStatuses"][number];
  readonly theme: ReturnType<typeof useTheme>;
}) {
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  useEffect(() => setShowSyncDetails(false), [shift?.id]);
  if (!shift) return null;
  const future = Date.parse(shift.startsAt) > now;
  return <Sheet onClose={onClose} title="Shift details" visible><ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}><View style={styles.detailTitleRow}><View><Text style={[styles.detailTitle, { color: theme.text }]}>{formatSheetDate(formatDateKey(new Date(shift.startsAt)))}</Text><Text style={[styles.detailTime, { color: theme.primaryLight }]}>{formatTime(shift.startsAt)} – {formatTime(shift.endsAt)} · {getDuration(shift.startsAt, shift.endsAt)}</Text></View><SyncBadge onPress={() => setShowSyncDetails((current) => !current)} status={sync?.status ?? "pending"} theme={theme} /></View><DetailRow label="Status" value={shift.status.replace("_", " ")} theme={theme} /><DetailRow label="Notes" value={shift.note ?? "No notes"} theme={theme} /><View style={[styles.detailCallout, { backgroundColor: theme.tint.primary.soft, borderColor: theme.tint.primary.medium }]}><Feather color={theme.primaryLight} name="link" size={16} /><Text style={[styles.detailCalloutText, { color: theme.textSecondary }]}>Coverage transfers this shift occurrence only. Linked loads stay with their original driver.</Text></View>{showSyncDetails ? <View style={[styles.syncDetails, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><Text style={[styles.detailRowLabel, { color: theme.textMuted }]}>TARGET SYNC AUDIT</Text><Text style={[styles.syncCopy, { color: theme.textSecondary }]}>{sync?.status === "pending" ? "Waiting for Target credentials or the next integration retry." : sync?.lastError ?? "Target accepted this schedule change."}</Text><Text style={[styles.syncCopy, { color: theme.textMuted }]}>Attempts: {sync?.attempts ?? 0}{sync?.lastAttemptAt ? ` · Last attempt ${formatTime(sync.lastAttemptAt)}` : ""}</Text>{isAdmin ? <Button onPress={() => onRetrySync(shift.id)} size="sm" title="Retry Target sync" variant="outline" /> : null}</View> : null}<View style={styles.sheetActions}>{future ? <Button fullWidth icon={<Feather color={theme.primaryForeground} name="users" size={16} />} onPress={() => onFindCoverage(shift)} title="Find coverage" /> : null}{isAdmin ? <Button fullWidth onPress={() => onEdit(shift)} title="Edit shift" variant="secondary" /> : null}{isAdmin ? <Button fullWidth onPress={() => onDelete(shift.id)} title="Remove shift" variant="danger" /> : null}</View></ScrollView></Sheet>;
}

function CoverageSheet({ busy, onClose, onSend, shift, state, theme }: { readonly busy: boolean; readonly onClose: () => void; readonly onSend: (shiftId: string, targetDriverId: string) => void; readonly shift: DriverShift | null; readonly state: ReturnType<typeof useOperations>["state"]; readonly theme: ReturnType<typeof useTheme> }) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  useEffect(() => setSelectedDriverId(null), [shift?.id]);
  if (!shift) return null;
  const candidates = eligibleCoverageDrivers(state, shift);
  return <Sheet footer={<AnimatedButton accessibilityLabel="Send coverage request" disabled={!selectedDriverId} fullWidth loading={busy} onPress={() => selectedDriverId && onSend(shift.id, selectedDriverId)} title="Send request" />} onClose={onClose} title="Find shift coverage" visible><ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}><Text style={[styles.coverageIntro, { color: theme.textSecondary }]}>Only qualified, available drivers without a shift, blocked time, or load conflict are shown.</Text><View style={[styles.coverageShift, { backgroundColor: theme.tint.primary.soft, borderColor: theme.tint.primary.medium }]}><Text style={[styles.coverageShiftTitle, { color: theme.text }]}>{formatSheetDate(formatDateKey(new Date(shift.startsAt)))}</Text><Text style={[styles.coverageShiftMeta, { color: theme.primaryLight }]}>{formatTime(shift.startsAt)} – {formatTime(shift.endsAt)}</Text></View><Text style={[styles.sheetLabel, { color: theme.textMuted }]}>RANKED ELIGIBLE DRIVERS</Text>{candidates.length === 0 ? <View style={styles.noCandidates}><Feather color={theme.warning} name="alert-triangle" size={22} /><Text style={[styles.noCandidateTitle, { color: theme.text }]}>No eligible drivers</Text><Text style={[styles.noCandidateCopy, { color: theme.textSecondary }]}>Adjust the shift window or resolve a conflict before requesting coverage.</Text></View> : candidates.map(({ driver, rank }) => { const selected = driver.id === selectedDriverId; return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} key={driver.id} onPress={() => setSelectedDriverId(driver.id)} style={[styles.candidateRow, { borderColor: theme.border }, selected && { backgroundColor: theme.tint.primary.medium, borderColor: theme.primaryLight }]}><DriverAvatar driver={driver} ring={false} size={32} /><View style={styles.candidateCopy}><Text style={[styles.candidateName, { color: theme.text }]}>{driverFullName(driver)}</Text><Text style={[styles.candidateMeta, { color: theme.textSecondary }]}>{driver.status.replace("_", " ")} · {rank === 0 ? "Best match" : "No schedule conflicts"}</Text></View>{selected ? <Feather color={theme.primaryLight} name="check-circle" size={19} /> : <Feather color={theme.textMuted} name="circle" size={19} />}</Pressable>; })}</ScrollView></Sheet>;
}

function SyncBadge({ onPress, status, theme }: { readonly onPress: () => void; readonly status: "pending" | "synced" | "failed"; readonly theme: ReturnType<typeof useTheme> }) {
  const color = status === "synced" ? theme.primary : status === "failed" ? theme.danger : theme.warning;
  const label = status === "synced" ? "Target synced" : status === "failed" ? "Sync failed" : "Target pending";
  return <Pressable accessibilityLabel={`${label}. Show sync details`} accessibilityRole="button" onPress={onPress} style={[styles.syncBadge, { backgroundColor: `${color}20`, borderColor: `${color}80` }]}><View style={[styles.syncDot, { backgroundColor: color }]} /><Text style={[styles.syncBadgeText, { color }]}>{label}</Text></Pressable>;
}

function DetailRow({ label, theme, value }: { readonly label: string; readonly theme: ReturnType<typeof useTheme>; readonly value: string }) {
  return <View style={[styles.detailRow, { borderBottomColor: theme.border }]}><Text style={[styles.detailRowLabel, { color: theme.textMuted }]}>{label}</Text><Text style={[styles.detailRowValue, { color: theme.text }]}>{value}</Text></View>;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function addDays(date: Date, count: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

function shiftTouchesDay(shift: DriverShift, dateKey: string): boolean {
  const start = localDayStart(dateKey).getTime();
  const end = addDays(localDayStart(dateKey), 1).getTime();
  return Date.parse(shift.startsAt) < end && Date.parse(shift.endsAt) > start;
}

function weekRangeLabel(dates: readonly Date[]): string {
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return "Schedule";
  const firstLabel = first.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const lastLabel = last.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  return `${firstLabel} – ${lastLabel}`;
}

function formatSheetDate(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "long", timeZone: "UTC", weekday: "long" });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerAction: { alignItems: "center", justifyContent: "center", minHeight: 40, minWidth: 40 },
  weekControls: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
  arrowButton: { alignItems: "center", borderRadius: RADIUS.md, height: 40, justifyContent: "center", width: 40 },
  weekLabelButton: { alignItems: "center", flex: 1, gap: 2 },
  weekLabel: { ...TYPO.cardTitle, fontFamily: FONTS.bold },
  weekHint: { ...TYPO.captionStrong },
  driverFilterContent: { gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingBottom: SPACE.sm },
  driverFilter: { alignItems: "center", borderRadius: RADIUS.pill, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 34, paddingHorizontal: SPACE.sm },
  driverFilterText: { ...TYPO.captionStrong },
  metricsRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#FFFFFF18", flexDirection: "row", marginBottom: SPACE.sm, marginHorizontal: SPACE.lg },
  metric: { alignItems: "center", flex: 1, paddingVertical: SPACE.sm },
  metricValue: { ...TYPO.heading, fontFamily: FONTS.bold },
  metricLabel: { ...TYPO.caption, color: "#93A1A5" },
  boardScroll: { paddingHorizontal: SPACE.lg },
  board: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: "hidden" },
  boardHeader: { flexDirection: "row", minHeight: 62 },
  driverLabel: { alignItems: "flex-start", justifyContent: "center", paddingHorizontal: SPACE.sm, width: DRIVER_LABEL_WIDTH },
  driverLabelBody: { flexDirection: "row", gap: SPACE.sm, minHeight: 100 },
  boardEyebrow: { ...TYPO.subtitle, letterSpacing: 1 },
  dayHeader: { alignItems: "center", borderRightWidth: StyleSheet.hairlineWidth, justifyContent: "center", width: DAY_WIDTH },
  dayHeaderLabel: { ...TYPO.subtitle, fontFamily: FONTS.bold, letterSpacing: 1 },
  dayHeaderNumber: { ...TYPO.heading, fontFamily: FONTS.bold, marginTop: 3 },
  driverRow: { flexDirection: "row", minHeight: 100, borderTopWidth: StyleSheet.hairlineWidth },
  driverLabelCopy: { flex: 1, minWidth: 0 },
  driverName: { ...TYPO.captionStrong },
  driverStatus: { ...TYPO.subtitle, marginTop: 2, textTransform: "capitalize" },
  dayCell: { borderRightWidth: StyleSheet.hairlineWidth, gap: 4, justifyContent: "flex-start", padding: 5, width: DAY_WIDTH },
  emptyCell: { alignItems: "center", justifyContent: "center" },
  eventChip: { alignItems: "center", borderRadius: 6, borderWidth: 1, flexDirection: "row", gap: 4, minHeight: 25, paddingHorizontal: 5 },
  eventDot: { borderRadius: 3, height: 6, width: 6 },
  eventText: { ...TYPO.subtitle, flex: 1, fontFamily: FONTS.semibold },
  moreEvents: { ...TYPO.subtitle, paddingLeft: 2 },
  emptyBoard: { alignItems: "center", gap: SPACE.sm, padding: SPACE.xl, width: DRIVER_LABEL_WIDTH + DAY_WIDTH * 7 },
  emptyTitle: { ...TYPO.cardTitle },
  emptyCopy: { ...TYPO.caption, maxWidth: 260, textAlign: "center" },
  legendRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: SPACE.md, paddingVertical: SPACE.md },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 5 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendText: { ...TYPO.caption },
  legendHint: { ...TYPO.caption, marginLeft: "auto" },
  inbox: { borderRadius: RADIUS.lg, borderWidth: 1, marginTop: SPACE.sm, overflow: "hidden" },
  sectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", padding: SPACE.md },
  sectionEyebrow: { ...TYPO.subtitle, fontFamily: FONTS.bold, letterSpacing: 1 },
  sectionTitle: { ...TYPO.cardTitle, marginTop: 3 },
  requestRow: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: SPACE.sm, padding: SPACE.md },
  requestCopy: { flex: 1 },
  requestTitle: { ...TYPO.bodyStrong },
  requestMeta: { ...TYPO.caption, marginTop: 3 },
  requestActions: { alignItems: "flex-end", justifyContent: "center" },
  sheetContent: { gap: SPACE.md, paddingBottom: SPACE.md },
  sheetLabel: { ...TYPO.subtitle, fontFamily: FONTS.bold, letterSpacing: 1, marginTop: SPACE.sm },
  sheetDriverRow: { gap: SPACE.sm },
  sheetDriver: { alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: SPACE.sm },
  sheetDriverText: { ...TYPO.captionStrong },
  sheetDate: { ...TYPO.heading, fontFamily: FONTS.bold },
  detailTitleRow: { alignItems: "flex-start", flexDirection: "row", gap: SPACE.sm, justifyContent: "space-between" },
  detailTitle: { ...TYPO.heading, fontFamily: FONTS.bold },
  detailTime: { ...TYPO.bodyStrong, marginTop: 4 },
  detailRow: { borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: SPACE.md, paddingVertical: SPACE.sm },
  detailRowLabel: { ...TYPO.captionStrong, width: 70 },
  detailRowValue: { ...TYPO.caption, flex: 1, textTransform: "capitalize" },
  detailCallout: { alignItems: "flex-start", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, padding: SPACE.md },
  detailCalloutText: { ...TYPO.caption, flex: 1 },
  syncBadge: { alignItems: "center", borderRadius: RADIUS.pill, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 8, paddingVertical: 5 },
  syncDot: { borderRadius: 4, height: 7, width: 7 },
  syncBadgeText: { ...TYPO.subtitle, fontFamily: FONTS.bold },
  syncDetails: { borderRadius: RADIUS.md, borderWidth: 1, gap: SPACE.sm, padding: SPACE.md },
  syncCopy: { ...TYPO.caption },
  sheetActions: { gap: SPACE.sm, marginTop: SPACE.sm },
  coverageIntro: { ...TYPO.body },
  coverageShift: { borderRadius: RADIUS.md, borderWidth: 1, gap: 3, padding: SPACE.md },
  coverageShiftTitle: { ...TYPO.bodyStrong },
  coverageShiftMeta: { ...TYPO.captionStrong },
  candidateRow: { alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, padding: SPACE.sm },
  candidateCopy: { flex: 1 },
  candidateName: { ...TYPO.bodyStrong },
  candidateMeta: { ...TYPO.caption, marginTop: 2, textTransform: "capitalize" },
  noCandidates: { alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.lg },
  noCandidateTitle: { ...TYPO.bodyStrong },
  noCandidateCopy: { ...TYPO.caption, textAlign: "center" },
  bottomSpace: { height: 60 },
});
