import type { DaySummary, MonthCell } from "@/route-support/availability/utils";
import { FONTS, RADIUS_DENSE, SPACE, TYPO, useTheme } from "@/theme";
import {
  StyleSheet,
  Text,
  View
} from "react-native";

export function DayCell({
  cell,
  inDrag,
  isSelected,
  isToday,
  summary,
}: {
  readonly cell: MonthCell;
  readonly inDrag: boolean;
  readonly isSelected: boolean;
  readonly isToday: boolean;
  readonly summary: DaySummary | undefined;
}) {
  const theme = useTheme();
  const coverage = summary?.coverage ?? "open";
  const ringColor = coverage === "off"
    ? theme.danger
    : coverage === "partial"
      ? theme.warning
      : theme.tint.primary.medium;

  return (
    <View
      accessibilityLabel={describeCell(cell, summary, isToday)}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      style={[
        styles.cell,
        inDrag && { backgroundColor: theme.tint.primary.muted },
        isSelected && { backgroundColor: theme.tint.primary.strong },
      ]}
    >
      <View
        style={[
          styles.dayWell,
          { borderColor: coverage === "open" ? "transparent" : ringColor },
          isToday && { backgroundColor: theme.primary },
        ]}
      >
        <Text
          style={[
            styles.dayText,
            { color: cell.inMonth ? theme.text : theme.textMuted },
            isToday && { color: theme.primaryForeground, fontFamily: FONTS.bold },
            !cell.inMonth && styles.dayTextOutside,
          ]}
        >
          {cell.day}
        </Text>
      </View>

      <View style={styles.markers}>
        {summary && summary.loadCount > 0 ? (
          <View
            style={[
              styles.loadDot,
              { backgroundColor: summary.hasConflict ? theme.danger : theme.info },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

export function describeCell(cell: MonthCell, summary: DaySummary | undefined, isToday: boolean): string {
  const date = new Date(`${cell.dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
  });
  const coverage = summary?.coverage === "off"
    ? "unavailable all day"
    : summary?.coverage === "partial" ? "partly blocked" : "available";
  const loads = summary && summary.loadCount > 0
    ? `, ${summary.loadCount} load${summary.loadCount === 1 ? "" : "s"}${summary.hasConflict ? ", conflicts with blocked time" : ""}`
    : "";
  return `${isToday ? "Today, " : ""}${date}, ${coverage}${loads}`;
}

export const styles = StyleSheet.create({
  cell: {
    alignItems: "center",
    borderRadius: RADIUS_DENSE.lg,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    paddingVertical: 4,
  },
  dayText: { ...TYPO.body, fontFamily: FONTS.medium },
  dayTextOutside: { opacity: 0.45 },
  dayWell: {
    alignItems: "center",
    borderRadius: 17,
    borderWidth: 1.5,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  grid: { gap: 2 },
  loadDot: { borderRadius: 2.5, height: 5, width: 5 },
  markers: { alignItems: "center", flexDirection: "row", gap: 3, height: 6 },
  row: { flexDirection: "row", gap: 2 },
  weekday: { ...TYPO.label, flex: 1, textAlign: "center" },
  weekdayRow: { flexDirection: "row", gap: 2 },
  wrapper: { gap: SPACE.xs },
});

export const ROWS = 6;

export const COLUMNS = 7;

export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export interface MonthGridProps {
  readonly cells: readonly MonthCell[];
  readonly summaries: ReadonlyMap<string, DaySummary>;
  readonly todayKey: string;
  readonly selectedKey: string | null;
  readonly onSelectDay: (dateKey: string) => void;
  readonly onSelectRange: (startKey: string, endKey: string) => void;
  /** Fires as the drag crosses into a new day, so the caller can tick haptics. */
  readonly onRangeProgress?: () => void;
}
