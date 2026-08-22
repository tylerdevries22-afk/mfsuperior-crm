import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, EmptyState, Header, IconButton, ListRow, Screen, SectionHeader } from "@/components/ui";
import type { AvailabilityBlockInput, AvailabilityRuleInput } from "@/domain/types";
import { DayEditorSheet } from "@/route-support/availability/_components/DayEditorSheet";
import { MonthGrid } from "@/route-support/availability/_components/MonthGrid";
import {
  MINUTES_PER_DAY,
  blocksForDay,
  buildMonthGrid,
  findAvailabilityConflicts,
  formatMinuteRange,
  minutesToIso,
  monthLabel,
  shiftMonth,
  summarizeDay,
  type DaySummary,
} from "@/route-support/availability/utils";
import { formatDateKey } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const LEGEND = [
  { key: "off", label: "Unavailable", tone: "danger" as const },
  { key: "partial", label: "Partly blocked", tone: "warning" as const },
  { key: "load", label: "Load scheduled", tone: "info" as const },
];

export default function AvailabilityScreen() {
  const router = useRouter();
  const theme = useTheme();
  const {
    actions,
    availabilityBlocks,
    availabilityRules,
    currentDriver,
    effectiveRole,
    shipments,
  } = useOperations();

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);
  const [cursor, setCursor] = useState(() => ({
    month: today.getMonth(),
    year: today.getFullYear(),
  }));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor.month, cursor.year],
  );

  const summaries = useMemo(() => {
    const map = new Map<string, DaySummary>();
    for (const cell of cells) {
      map.set(
        cell.dateKey,
        summarizeDay(cell.dateKey, availabilityBlocks, availabilityRules, shipments),
      );
    }
    return map;
  }, [availabilityBlocks, availabilityRules, cells, shipments]);

  const selectedBlocks = useMemo(
    () => selectedKey ? blocksForDay(availabilityBlocks, availabilityRules, selectedKey) : [],
    [availabilityBlocks, availabilityRules, selectedKey],
  );

  const selectedConflicts = useMemo(() => {
    if (!selectedKey || !currentDriver) {
      return [];
    }
    return findAvailabilityConflicts(
      shipments,
      currentDriver.id,
      minutesToIso(selectedKey, 0),
      minutesToIso(selectedKey, MINUTES_PER_DAY),
    );
  }, [currentDriver, selectedKey, shipments]);

  const monthTotals = useMemo(() => {
    let off = 0;
    let partial = 0;
    let conflicts = 0;
    for (const cell of cells) {
      if (!cell.inMonth) {
        continue;
      }
      const summary = summaries.get(cell.dateKey);
      if (summary?.coverage === "off") off += 1;
      if (summary?.coverage === "partial") partial += 1;
      if (summary?.hasConflict) conflicts += 1;
    }
    return { conflicts, off, partial };
  }, [cells, summaries]);

  const tick = useCallback(() => {
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);

  const runWrite = useCallback(async (write: () => Promise<boolean>) => {
    setBusy(true);
    const saved = await write();
    setBusy(false);
    if (saved) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    }
    return saved;
  }, []);

  const onSaveBlock = useCallback((input: AvailabilityBlockInput) => {
    void runWrite(() => actions.setAvailabilityBlock(input));
  }, [actions, runWrite]);

  const onSaveRule = useCallback(async (input: AvailabilityRuleInput) => {
    const saved = await runWrite(() => actions.setAvailabilityRule(input));
    if (saved) {
      setSelectedKey(null);
    }
  }, [actions, runWrite]);

  const onRemoveBlock = useCallback((blockId: string) => {
    void runWrite(() => actions.removeAvailabilityBlock(blockId));
  }, [actions, runWrite]);

  /**
   * A dragged range writes one block spanning every day it covers, rather than
   * one block per day. A week of leave is one decision and should be one row
   * the driver can undo in one tap.
   */
  const onSelectRange = useCallback((startKey: string, endKey: string) => {
    void runWrite(() => actions.setAvailabilityBlock({
      endsAt: minutesToIso(endKey, MINUTES_PER_DAY),
      kind: "time_off",
      note: "Blocked from the calendar",
      startsAt: minutesToIso(startKey, 0),
    }));
  }, [actions, runWrite]);

  const onSelectDay = useCallback((dateKey: string) => {
    tick();
    setSelectedKey(dateKey);
  }, [tick]);

  const stepMonth = useCallback((delta: number) => {
    tick();
    setCursor((current) => shiftMonth(current.year, current.month, delta));
  }, [tick]);

  if (effectiveRole !== "driver" || !currentDriver) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Availability" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="calendar" size={36} />}
            message="Availability is a driver's own calendar. Switch to a driver account to manage it."
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
        subtitle="Tap a day, or drag across several"
        title="Availability"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <Card>
          <View style={styles.monthHeader}>
            <IconButton
              icon="chevron-left"
              label="Previous month"
              onPress={() => stepMonth(-1)}
              variant="surface"
            />
            <Text style={[styles.monthTitle, { color: theme.text }]}>
              {monthLabel(cursor.year, cursor.month)}
            </Text>
            <IconButton
              icon="chevron-right"
              label="Next month"
              onPress={() => stepMonth(1)}
              variant="surface"
            />
          </View>

          <MonthGrid
            cells={cells}
            onRangeProgress={tick}
            onSelectDay={onSelectDay}
            onSelectRange={onSelectRange}
            selectedKey={selectedKey}
            summaries={summaries}
            todayKey={todayKey}
          />

          <View style={[styles.legend, { borderTopColor: theme.border }]}>
            {LEGEND.map((entry) => (
              <View key={entry.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme[entry.tone] }]} />
                <Text style={[styles.legendLabel, { color: theme.textMuted }]}>{entry.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={styles.summaryRow}>
          <SummaryTile label="Days off" value={monthTotals.off} />
          <SummaryTile label="Partly blocked" value={monthTotals.partial} />
          <SummaryTile
            label="Conflicts"
            tone={monthTotals.conflicts > 0 ? "danger" : undefined}
            value={monthTotals.conflicts}
          />
        </View>

        <SectionHeader title="Weekly patterns" />
        {availabilityRules.length === 0 ? (
          <Card variant="tinted">
            <Text style={[styles.emptyRules, { color: theme.textSecondary }]}>
              No standing pattern yet. Open a day, carve a window, and turn on Repeat weekly to
              hold it every week.
            </Text>
          </Card>
        ) : (
          <Card padding="none">
            {availabilityRules.map((rule, index) => (
              <ListRow
                isLast={index === availabilityRules.length - 1}
                key={rule.id}
                leading={<Feather color={theme.primaryLight} name="repeat" size={ICON.sm} />}
                onPress={() => void runWrite(() => actions.removeAvailabilityRule(rule.id))}
                subtitle={formatMinuteRange(rule.startMinute, rule.endMinute)}
                title={`Every ${WEEKDAY_LABELS[rule.weekday]}`}
                trailing={<Feather color={theme.danger} name="trash-2" size={ICON.sm} />}
              />
            ))}
          </Card>
        )}
      </Screen>

      <DayEditorSheet
        blocks={selectedBlocks}
        busy={busy}
        conflicts={selectedConflicts}
        dateKey={selectedKey}
        onClose={() => setSelectedKey(null)}
        onDragSettle={tick}
        onRemoveBlock={onRemoveBlock}
        onSaveBlock={onSaveBlock}
        onSaveRule={(input) => void onSaveRule(input)}
      />
    </View>
  );
}

function SummaryTile({
  label,
  tone,
  value,
}: {
  readonly label: string;
  readonly tone?: "danger";
  readonly value: number;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={`${value} ${label}`}
      style={[
        styles.summaryTile,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Text
        style={[
          styles.summaryValue,
          { color: tone === "danger" && value > 0 ? theme.danger : theme.text },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  emptyRules: { ...TYPO.body },
  fill: { flex: 1 },
  legend: { borderTopWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: SPACE.md, paddingTop: SPACE.sm },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: SPACE.xxs },
  legendLabel: { ...TYPO.subtitle },
  monthHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  monthTitle: { ...TYPO.cardTitle },
  summaryLabel: { ...TYPO.subtitle, textAlign: "center" },
  summaryRow: { flexDirection: "row", gap: SPACE.sm },
  summaryTile: {
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingVertical: SPACE.md,
  },
  summaryValue: { ...TYPO.metric },
});
