import {
  AnimatedButton,
  AnimatedPressable,
  Sheet,
  SwitchRow,
} from "@/components/ui";
import type {
  AvailabilityKind
} from "@/domain/types";
import {
  formatMinuteRange,
  isoToMinutes,
  loadRouteLabel
} from "@/route-support/availability/utils";
import { ICON } from "@/theme";
import Feather from "@expo/vector-icons/Feather";
import { ScrollView, Text, View } from "react-native";
import { TimeRangeTrack } from "./TimeRangeTrack";
import { DayEditorSheetProps, KIND_LABELS, QUICK_ACTIONS, styles, WEEKDAY_LABELS } from "./dayEditorParts";
import { useDayEditorSheet } from "./useDayEditorSheet";

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
  const { theme, kind, setKind, weekday, startMinute, endMinute, repeatWeekly, setRepeatWeekly, onRangeChange, heading, applyQuickAction, saveRange } = useDayEditorSheet({ blocks, busy, conflicts, dateKey, onClose, onDragSettle, onRemoveBlock, onSaveBlock, onSaveRule });
  if (!dateKey) {
    return null;
  }
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
