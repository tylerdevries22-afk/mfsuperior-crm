import { DriverAvatar } from "@/components/operations";
import {
  Header
} from "@/components/ui";
import { DayEditorSheet } from "@/route-support/availability/_components/DayEditorSheet";
import {
  blocksForDay,
  findAvailabilityConflicts,
  minutesToIso
} from "@/route-support/availability/utils";
import {
  driverFullName,
  formatDateKey
} from "@/route-support/schedule/utils";
import { Feather } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { CoverageInbox } from './CoverageInbox';
import { CoverageSheet } from './CoverageSheet';
import { DayHeader, DriverRow, LegendDot, Metric } from './ScheduleBoardCells';
import { ShiftDetailSheet } from './ShiftDetailSheet';
import { ShiftEditorSheet } from './ShiftEditorSheet';
import { startOfWeek, weekRangeLabel } from './unifiedHelpers';
import { styles } from './unifiedStyles';
import { UnifiedScheduleScreenProps } from './unifiedTypes';
import { useUnifiedSchedule } from "./useUnifiedSchedule";
export function UnifiedScheduleScreen({ mode }: UnifiedScheduleScreenProps) {
  const { theme, actions, availabilityBlocks, availabilityRules, currentDriver, driverShifts, isHydrated, scheduleSyncStatuses, shipments, shiftCoverageRequests, state, drivers, currentMode, setWeekAnchor, selectedDateKey, setSelectedDateKey, selectedDriverId, setSelectedDriverId, setBlockDriverId, shiftEditor, setShiftEditor, detailShift, setDetailShift, coverageShift, setCoverageShift, blockDateKey, setBlockDateKey, busy, weekDates, boardDrivers, selectedBlockDriver, pendingSyncCount, conflictCount, gapCount, runAction, changeWeek, cellContent, openCell, handleBlockSave, handleRuleSave, handleDeleteBlock, openLoad } = useUnifiedSchedule(mode);
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
            <Feather color={theme.primaryLight} name="plus" size={21} />
          </Pressable>
        )}
        subtitle={currentMode === "admin" ? "Dispatch board · changes are live" : "Your shifts, loads, and blocked time"}
        title="Schedule"
      />
      <ScrollView contentContainerStyle={styles.scheduleContent} showsVerticalScrollIndicator={false}>
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
        <ScrollView style={styles.driverFilterScroll} contentContainerStyle={styles.driverFilterContent} horizontal showsHorizontalScrollIndicator={false}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: !selectedDriverId }} onPress={() => setSelectedDriverId(null)} style={[styles.driverFilter, !selectedDriverId && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
            <Text style={[styles.driverFilterText, { color: !selectedDriverId ? theme.primaryForeground : theme.textSecondary }]}>All drivers</Text>
          </Pressable>
          {drivers.map((driver) => {
            const selected = selectedDriverId === driver.id;
            return (
              <Pressable accessibilityLabel={`Filter ${driverFullName(driver)}`} accessibilityRole="button" accessibilityState={{ selected }} key={driver.id} onPress={() => setSelectedDriverId(selected ? null : driver.id)} style={[styles.driverFilter, { borderColor: theme.border }, selected && { backgroundColor: theme.tint.primary.medium, borderColor: theme.primaryLight }]}>
                <DriverAvatar driver={driver} ring={false} size={24} />
                <Text style={[styles.driverFilterText, { color: selected ? theme.text : theme.textSecondary }]}>{driver.firstName}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <View style={[styles.metricsRow, { borderColor: theme.separator }]}>
        <Metric label="Gaps" value={String(gapCount)} tone={gapCount > 0 ? theme.warning : theme.primary} />
        <Metric label="Conflicts" value={String(conflictCount)} tone={conflictCount > 0 ? theme.danger : theme.primary} />
        <Metric label="Target sync" value={String(pendingSyncCount)} tone={pendingSyncCount > 0 ? theme.warning : theme.primary} />
      </View>
      <View style={styles.boardScroll}>
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
          <LegendDot color="#32ADE6" label="Load" theme={theme} />
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
      </View>
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
          if (await runAction(() => actions.setDriverShift(input))) setShiftEditor(null);
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
          if (await runAction(() => actions.requestShiftCoverage({ shiftId, targetDriverId }))) setCoverageShift(null);
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
