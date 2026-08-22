import Feather from "@expo/vector-icons/Feather";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AnimatedButton,
  AnimatedPressable,
  Sheet,
  SwitchRow,
} from "@/components/ui";
import type {
  AvailabilityBlock,
  AvailabilityBlockInput,
  AvailabilityKind,
  AvailabilityRuleInput,
  Shipment,
} from "@/domain/types";
import { FONTS, ICON, RADIUS, RADIUS_DENSE, SPACE, TYPO, useTheme } from "@/theme";

import {
  MINUTES_PER_DAY,
  formatMinuteRange,
  isoToMinutes,
  loadRouteLabel,
  localDayStart,
  minutesToIso,
} from "../utils";
import { TimeRangeTrack } from "./TimeRangeTrack";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const QUICK_ACTIONS: readonly {
  readonly kind: AvailabilityKind;
  readonly label: string;
  readonly icon: keyof typeof Feather.glyphMap;
}[] = [
  { icon: "check-circle", kind: "available", label: "Available all day" },
  { icon: "slash", kind: "unavailable", label: "Unavailable all day" },
  { icon: "sun", kind: "time_off", label: "Time off" },
];

const KIND_LABELS: Record<AvailabilityKind, string> = {
  available: "Available",
  preferred: "Preferred",
  time_off: "Time off",
  unavailable: "Unavailable",
};

export interface DayEditorSheetProps {
  readonly dateKey: string | null;
  readonly blocks: readonly AvailabilityBlock[];
  readonly conflicts: readonly Shipment[];
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onSaveBlock: (input: AvailabilityBlockInput) => void;
  readonly onSaveRule: (input: AvailabilityRuleInput) => void;
  readonly onRemoveBlock: (blockId: string) => void;
  /** Called as the drag settles, so the screen owns the haptic policy. */
  readonly onDragSettle?: () => void;
}

export function DayEditorSheet({
  blocks,
  busy,
  conflicts,
  dateKey,
  onClose,
  onDragSettle,
  onRemoveBlock,
  onSaveBlock,
  onSaveRule,
}: DayEditorSheetProps) {
  const theme = useTheme();
  const [kind, setKind] = useState<AvailabilityKind>("unavailable");
  const [startMinute, setStartMinute] = useState(480);
  const [endMinute, setEndMinute] = useState(1_020);
  const [repeatWeekly, setRepeatWeekly] = useState(false);

  // Reopening on a different day starts from a clean default rather than the
  // range left behind by the day before it.
  useEffect(() => {
    if (!dateKey) {
      return;
    }
    setKind("unavailable");
    setStartMinute(480);
    setEndMinute(1_020);
    setRepeatWeekly(false);
  }, [dateKey]);

  const weekday = useMemo(
    () => (dateKey ? localDayStart(dateKey).getDay() : 0),
    [dateKey],
  );

  const onRangeChange = useCallback((nextStart: number, nextEnd: number) => {
    setStartMinute(nextStart);
    setEndMinute(nextEnd);
  }, []);

  if (!dateKey) {
    return null;
  }

  const heading = new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
  });

  const applyQuickAction = (quickKind: AvailabilityKind) => {
    setKind(quickKind);
    setStartMinute(0);
    setEndMinute(MINUTES_PER_DAY);
    onSaveBlock({
      endsAt: minutesToIso(dateKey, MINUTES_PER_DAY),
      kind: quickKind,
      startsAt: minutesToIso(dateKey, 0),
    });
  };

  const saveRange = () => {
    if (repeatWeekly) {
      onSaveRule({
        effectiveFrom: minutesToIso(dateKey, 0),
        endMinute,
        kind,
        startMinute,
        weekday: weekday as AvailabilityRuleInput["weekday"],
      });
      return;
    }
    onSaveBlock({
      endsAt: minutesToIso(dateKey, endMinute),
      kind,
      startsAt: minutesToIso(dateKey, startMinute),
    });
  };

  return (
    <Sheet
      footer={
        <AnimatedButton
          accessibilityLabel={repeatWeekly ? "Save weekly pattern" : "Save availability block"}
          fullWidth
          loading={busy}
          onPress={saveRange}
          title={repeatWeekly ? `Repeat every ${WEEKDAY_LABELS[weekday]}` : "Save this block"}
        />
      }
      onClose={onClose}
      title={heading}
      visible
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {conflicts.length > 0 ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.conflict,
              { backgroundColor: theme.warningMuted, borderColor: theme.tint.warning.medium },
            ]}
          >
            <Feather color={theme.warning} name="alert-triangle" size={ICON.sm} />
            <View style={styles.grow}>
              <Text style={[styles.conflictTitle, { color: theme.text }]}>
                {conflicts.length === 1 ? "A load already runs this day" : `${conflicts.length} loads already run this day`}
              </Text>
              {conflicts.map((load) => (
                <Text key={load.id} style={[styles.conflictBody, { color: theme.textSecondary }]}>
                  {load.loadNumber} · {loadRouteLabel(load)}
                </Text>
              ))}
              <Text style={[styles.conflictBody, { color: theme.textSecondary }]}>
                Blocking the day still saves. Dispatch sees the clash and reassigns.
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={[styles.label, { color: theme.textMuted }]}>QUICK ACTIONS</Text>
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((action) => (
            <AnimatedPressable
              accessibilityLabel={action.label}
              disabled={busy}
              haptic="selection"
              key={action.kind}
              onPress={() => applyQuickAction(action.kind)}
              style={[
                styles.quickChip,
                { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              ]}
            >
              <Feather color={theme.primaryLight} name={action.icon} size={ICON.sm} />
              <Text style={[styles.quickLabel, { color: theme.text }]}>{action.label}</Text>
            </AnimatedPressable>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textMuted }]}>OR CARVE A WINDOW</Text>
        <View style={styles.kindRow}>
          {(Object.keys(KIND_LABELS) as AvailabilityKind[]).map((option) => (
            <AnimatedPressable
              accessibilityLabel={`Mark as ${KIND_LABELS[option]}`}
              accessibilityState={{ selected: kind === option }}
              haptic="selection"
              key={option}
              onPress={() => setKind(option)}
              style={[
                styles.kindChip,
                { borderColor: theme.border },
                kind === option && {
                  backgroundColor: theme.tint.primary.medium,
                  borderColor: theme.primaryLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.kindLabel,
                  { color: kind === option ? theme.text : theme.textSecondary },
                ]}
              >
                {KIND_LABELS[option]}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        <TimeRangeTrack
          accessibilityLabel={`${KIND_LABELS[kind]} window`}
          disabled={busy}
          endMinute={endMinute}
          onChange={onRangeChange}
          onSettle={onDragSettle}
          startMinute={startMinute}
        />

        <SwitchRow
          description={`Applies to every ${WEEKDAY_LABELS[weekday]} from this date forward.`}
          label="Repeat weekly"
          onValueChange={setRepeatWeekly}
          value={repeatWeekly}
        />

        {blocks.length > 0 ? (
          <>
            <Text style={[styles.label, { color: theme.textMuted }]}>ON THIS DAY</Text>
            <View style={[styles.blockList, { borderColor: theme.border }]}>
              {blocks.map((block, index) => (
                <View
                  key={block.id}
                  style={[
                    styles.blockRow,
                    index < blocks.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 },
                  ]}
                >
                  <View style={styles.grow}>
                    <Text style={[styles.blockTitle, { color: theme.text }]}>
                      {KIND_LABELS[block.kind]}
                      {block.ruleId ? " · weekly" : ""}
                    </Text>
                    <Text style={[styles.blockMeta, { color: theme.textSecondary }]}>
                      {formatMinuteRange(
                        isoToMinutes(block.startsAt, dateKey),
                        isoToMinutes(block.endsAt, dateKey),
                      )}
                      {block.note ? ` · ${block.note}` : ""}
                    </Text>
                  </View>
                  {block.ruleId ? (
                    // A rule-derived block has no record of its own to delete;
                    // the pattern is managed from the weekly-patterns list.
                    <Feather color={theme.textMuted} name="repeat" size={ICON.sm} />
                  ) : (
                    <AnimatedPressable
                      accessibilityLabel={`Remove ${KIND_LABELS[block.kind]} block`}
                      disabled={busy}
                      haptic="light"
                      onPress={() => onRemoveBlock(block.id)}
                      style={styles.removeButton}
                    >
                      <Feather color={theme.danger} name="x" size={ICON.sm} />
                    </AnimatedPressable>
                  )}
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  blockList: { borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden" },
  blockMeta: { ...TYPO.caption, marginTop: 2 },
  blockRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACE.sm,
    minHeight: 56,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  blockTitle: { ...TYPO.rowTitle },
  conflict: {
    alignItems: "flex-start",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
  },
  conflictBody: { ...TYPO.caption, marginTop: 2 },
  conflictTitle: { ...TYPO.captionStrong },
  content: { gap: SPACE.md, paddingBottom: SPACE.md },
  grow: { flex: 1, minWidth: 0 },
  kindChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
  },
  kindLabel: { ...TYPO.caption, fontFamily: FONTS.medium },
  kindRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
  label: { ...TYPO.label },
  quickChip: {
    alignItems: "center",
    borderRadius: RADIUS_DENSE.lg,
    borderWidth: 1,
    flexBasis: "31%",
    flexGrow: 1,
    gap: SPACE.xs,
    justifyContent: "center",
    minHeight: 76,
    paddingHorizontal: SPACE.xs,
    paddingVertical: SPACE.sm,
  },
  quickLabel: { ...TYPO.subtitle, textAlign: "center" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
  removeButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
});
